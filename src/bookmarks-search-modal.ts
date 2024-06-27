import { App, FuzzyMatch, FuzzySuggestModal, Platform, setIcon } from 'obsidian';
import { SearchBookmarksSettings, Settings } from './settings';
import {
	BookmarkItem,
	BookmarksPluginInstance,
	CorePlugins,
	FileExplorerPluginInstance,
	GlobalSearchPluginInstance,
	GraphPluginInstance,
} from './types';
import { getDisplayName,
	getEnabledPluginById,
	getTypeIcon,
	openBookmarkOfFile,
	openBookmarkOfFolder,
	openBookmarkOfGraph,
	openBookmarkOfSearch,
	openChildFiles,
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

export class BookmarksSearchModal extends FuzzySuggestModal<BookmarkItem> {
	settings: Settings;
	bookmarks: BookmarkItem[] = [];
	currentLayerItems: BookmarkItem[] = [];
	corePlugins: CorePlugins = {
		bookmarks: void 0,
		fileExplorer: void 0,
		globalSearch: void 0,
		graph: void 0,
	};
	upperLayers: BookmarkItem[][] = [];
	eventListenerFunc: (ev: KeyboardEvent) => void;

	get modalSettings(): SearchBookmarksSettings {
		return this.settings.searchBookmarks;
	}

	constructor(app: App, settings: Settings, bookmarksPlugin: BookmarksPluginInstance, bookmarks: BookmarkItem[], upperLayers: BookmarkItem[][] = []) {
		super(app);
		this.settings = settings;
		this.bookmarks = this.modalSettings.structureType === 'original' ? bookmarks : this.convertToFlatStructure(bookmarks);
		this.currentLayerItems = this.bookmarks;
		this.upperLayers = upperLayers;

		this.corePlugins.bookmarks = bookmarksPlugin;
		this.corePlugins.fileExplorer = getEnabledPluginById(this.app, 'file-explorer') as FileExplorerPluginInstance;
		this.corePlugins.globalSearch = getEnabledPluginById(this.app, 'global-search') as GlobalSearchPluginInstance;
		this.corePlugins.graph = getEnabledPluginById(this.app, 'graph') as GraphPluginInstance;

		this.setPlaceholder('Search bookmarks');

		this.eventListenerFunc = this.handlingKeyupEvent.bind(this);
		window.addEventListener('keyup', this.eventListenerFunc);
		this.generateFooter(this.modalEl);
		this.modalEl.addClasses(['bookmarks-search-modal', 'bs-modal']);
	}

	onClose() {
		window.removeEventListener('keyup', this.eventListenerFunc);
	}

	getItems(): BookmarkItem[] {
		return this.currentLayerItems;
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
					openBtnEl.addEventListener('click', () => this.openAllFiles(this.currentLayerItems));
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
				openBookmarkOfFolder(this.app, bookmark, this.corePlugins.fileExplorer);
				break;
			}
			case 'search': {
				openBookmarkOfSearch(bookmark, this.corePlugins.globalSearch);
				break;
			}
			case 'graph': {
				await openBookmarkOfGraph(this.app, bookmark, this.corePlugins.bookmarks, this.corePlugins.graph);
				break;
			}
			default:
				// nop
				break;
		}
	}

	renderSuggestion(item: FuzzyMatch<BookmarkItem>, suggestionItemEl: HTMLElement): HTMLElement {
		const bookmark = item.item;
		setIcon(suggestionItemEl, getTypeIcon(bookmark));
		suggestionItemEl.createSpan('', spanEl => spanEl.setText(getDisplayName(this.app, bookmark)));
		return suggestionItemEl;
	}

	private openBookmarkOfGroup(bookmark: BookmarkItem): void {
		if (this.corePlugins.bookmarks) {
			const bookmarks = bookmark.items || [];
			const upperLayers = [...this.upperLayers, bookmarks];
			new BookmarksSearchModal(this.app, this.settings, this.corePlugins.bookmarks, bookmarks, upperLayers).open();
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
			this.openAllFiles(this.currentLayerItems);
			ev.preventDefault();
			return;
		}
	}

	private backToParentLayer(): void {
		if (this.upperLayers.length <= 1) {
			return;
		}
		if (this.corePlugins.bookmarks) {
			this.upperLayers.pop();
			const bookmarks = this.upperLayers.at(-1) || [];
			new BookmarksSearchModal(this.app, this.settings, this.corePlugins.bookmarks, bookmarks, this.upperLayers).open();
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
