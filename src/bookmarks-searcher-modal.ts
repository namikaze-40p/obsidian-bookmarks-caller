import { App, FuzzyMatch, FuzzySuggestModal, Platform, setIcon } from 'obsidian';
import { SORT_ORDER, STRUCTURE_TYPE, SearchBookmarksSettings, Settings } from './settings';
import {
	BookmarkItem,
	BookmarksPluginInstance,
	CorePlugins,
	FileExplorerPluginInstance,
	GlobalSearchPluginInstance,
	GraphPluginInstance,
	WebViewerPluginInstance,
} from './types';
import { getDisplayName,
	getEnabledPluginById,
	openBookmarkOfFile,
	openBookmarkOfFolder,
	openBookmarkOfSearch,
	openBookmarkOfGraph,
	openBookmarkOfUrl,
	openChildFiles,
	setBookmarkIcon,
} from './util';
import { VIEW_TYPE_BC_TMP } from './view';

const SHORTCUT_KEY = {
	all: 'Enter',
	back: 'Backspace',
}

const FOOTER_ITEMS = [
	{ keys: '↑ | ↓', description: 'Move focus' },
	{ keys: 'back', description: 'Back to parent group' },
	{ keys: 'Enter', description: 'Open focused item' },
	{ keys: 'all', description: 'Open all files in current group' },
];

const compareCreationTime = (isNewer: boolean) => (a: BookmarkItem, b: BookmarkItem): number => {
	if (isNewer) {
		return b.ctime - a.ctime;
	} else {
		return a.ctime - b.ctime;
	}
}

export class BookmarksSearcherModal extends FuzzySuggestModal<BookmarkItem> {
	private _currentLayerItems: BookmarkItem[] = [];
	private _corePlugins: CorePlugins = {
		bookmarks: void 0,
		fileExplorer: void 0,
		globalSearch: void 0,
		graph: void 0,
		webViewer: void 0,
	};
	private _eventListenerFunc: (ev: KeyboardEvent) => void;

	private get modalSettings(): SearchBookmarksSettings {
		return this._settings.searchBookmarks;
	}

	constructor(app: App, private _settings: Settings, private _bookmarksPlugin: BookmarksPluginInstance, private _bookmarks: BookmarkItem[], private _upperLayers: BookmarkItem[][] = []) {
		super(app);

		const clone = structuredClone(this._bookmarks);
		const items = this.modalSettings.structureType === STRUCTURE_TYPE.original ? clone : this.convertToFlatStructure(clone);
		const sort = this.modalSettings.sortOrder;
		this._bookmarks = sort === SORT_ORDER.original ? items : items.sort(compareCreationTime(sort === SORT_ORDER.newer));
		this._currentLayerItems = this._bookmarks;

		this._corePlugins = {
			bookmarks: this._bookmarksPlugin,
			fileExplorer: getEnabledPluginById(this.app, 'file-explorer') as FileExplorerPluginInstance,
			globalSearch: getEnabledPluginById(this.app, 'global-search') as GlobalSearchPluginInstance,
			graph: getEnabledPluginById(this.app, 'graph') as GraphPluginInstance,
			webViewer: getEnabledPluginById(this.app, 'webviewer') as WebViewerPluginInstance,
		};

		this.setPlaceholder('Search bookmarks');

		this._eventListenerFunc = this.handlingKeyupEvent.bind(this);
		window.addEventListener('keyup', this._eventListenerFunc);
		this.generateFooter(this.modalEl);
		this.modalEl.addClasses(['bookmarks-search-modal', 'bs-modal']);
	}

	onClose(): void {
		window.removeEventListener('keyup', this._eventListenerFunc);
	}

	getItems(): BookmarkItem[] {
		return this._currentLayerItems;
	}
  
	getItemText(bookmark: BookmarkItem): string {
		return getDisplayName(this.app, bookmark);
	}

	private generateFooter(contentEl: HTMLElement): void {
		contentEl.createDiv('bs-footer', footerEl => {
			if (this.modalSettings.showFooterButtons) {
				footerEl.createDiv('bs-button', el => {
					const backBtnEl = el.createEl('button');
					setIcon(backBtnEl, 'undo-2');
					backBtnEl.createSpan('').setText('Back');
					backBtnEl.setAttr('tabIndex', -1);
					backBtnEl.addClass('bs-btn');
					backBtnEl.addEventListener('click', () => this.backToParentLayer());

					const openBtnEl = el.createEl('button');
					setIcon(openBtnEl, 'square-stack');
					openBtnEl.createSpan('').setText('All');
					openBtnEl.setAttr('tabIndex', -1);
					openBtnEl.addClass('bs-btn');
					openBtnEl.addEventListener('click', () => this.openAllFiles(this._currentLayerItems));
				});
			}

			if (this.modalSettings.showLegends) {
				const modifier = Platform.isMacOS || Platform.isIosApp ? '⇧' : 'Shift + '
				FOOTER_ITEMS.forEach(item => {
					footerEl.createDiv('bs-legend', el => {
						let keys = item.keys;
						if (keys === 'all') {
							keys = `${modifier}${SHORTCUT_KEY.all}`;
						}
						if (keys === 'back') {
							keys = `${modifier}${SHORTCUT_KEY.back}`;
						}
						el.createSpan('bs-keys').setText(keys);
						el.createSpan('bs-description').setText(item.description);
					});
				});
			}
		});
	}
  
	async onChooseItem(bookmark: BookmarkItem): Promise<void> {
		switch (bookmark.type) {
			case 'group': {
				this.openBookmarkOfGroup(bookmark);
				break;
			}
			case 'file': {
				openBookmarkOfFile(this.app, bookmark);
				break;
			}
			case 'folder': {
				openBookmarkOfFolder(this.app, bookmark, this._corePlugins.fileExplorer);
				break;
			}
			case 'search': {
				openBookmarkOfSearch(bookmark, this._corePlugins.globalSearch);
				break;
			}
			case 'graph': {
				await openBookmarkOfGraph(this.app, bookmark, this._corePlugins.bookmarks, this._corePlugins.graph);
				break;
			}
			case 'url': {
				openBookmarkOfUrl(bookmark, this._corePlugins.webViewer);
				this.close();
				break;
			}
			default:
				// nop
				break;
		}
	}

	async renderSuggestion(item: FuzzyMatch<BookmarkItem>, suggestionItemEl: HTMLElement): Promise<HTMLElement> {
		const bookmark = item.item;
		await setBookmarkIcon(suggestionItemEl, bookmark, this._corePlugins.webViewer);
		suggestionItemEl.createSpan('', spanEl => spanEl.setText(getDisplayName(this.app, bookmark)));
		return suggestionItemEl;
	}

	private openBookmarkOfGroup(bookmark: BookmarkItem): void {
		if (this._corePlugins.bookmarks) {
			const bookmarks = bookmark.items || [];
			const upperLayers = [...this._upperLayers, bookmarks];
			new BookmarksSearcherModal(this.app, this._settings, this._corePlugins.bookmarks, bookmarks, upperLayers).open();
		}
	}

	private convertToFlatStructure(bookmarks: BookmarkItem[]): BookmarkItem[] {
		const items: BookmarkItem[] = [];
		bookmarks.forEach(bookmark => {
			items.push(bookmark);
			if (bookmark.type === 'group') {
				items.push(...this.convertToFlatStructure(bookmark.items || []));
			}
		});
		return items;
	}

	private handlingKeyupEvent(ev: KeyboardEvent): void {
		if (ev.key === SHORTCUT_KEY.back && ev.shiftKey) {
			this.backToParentLayer();
			ev.preventDefault();
			return;
		}

		if (ev.key === SHORTCUT_KEY.all && ev.shiftKey) {
			this.openAllFiles(this._currentLayerItems);
			ev.preventDefault();
			return;
		}
	}

	private backToParentLayer(): void {
		if (this._upperLayers.length <= 1) {
			return;
		}
		if (this._corePlugins.bookmarks) {
			this._upperLayers.pop();
			const bookmarks = this._upperLayers.at(-1) || [];
			new BookmarksSearcherModal(this.app, this._settings, this._corePlugins.bookmarks, bookmarks, this._upperLayers).open();
			this.close();
		}
	}

	private async openAllFiles(items: BookmarkItem[], isTeardown = true): Promise<void> {
		if (isTeardown) {
			await this.app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE_BC_TMP });
		}
		const isRecursivelyOpen = this.modalSettings.recursivelyOpen && this.modalSettings.structureType === 'original';
		await openChildFiles(this.app, items, isRecursivelyOpen);
		if (isTeardown) {
			this.app.workspace.detachLeavesOfType(VIEW_TYPE_BC_TMP);
			this.close();
		}
	}
}
