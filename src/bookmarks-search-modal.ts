import { App, FuzzyMatch, FuzzySuggestModal, Platform, TFile, TFolder, setIcon } from 'obsidian';
import { BookmarkItem, BookmarksPluginInstance, FileExplorerPluginInstance, GlobalSearchPluginInstance, GraphPluginInstance } from './types';
import { getEnabledPluginById } from './util';
import { VIEW_TYPE_BC_TMP } from './view';
import { Settings } from './settings';

const VIEW_TYPE_EMPTY = 'empty'
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

type CorePlugins = {
	bookmarks: BookmarksPluginInstance | null,
	fileExplorer: FileExplorerPluginInstance | null,
	globalSearch: GlobalSearchPluginInstance | null,
	graph: GraphPluginInstance | null,
};

export class BookmarksSearchModal extends FuzzySuggestModal<BookmarkItem> {
	settings: Settings;
	bookmarks: BookmarkItem[] = [];
	currentLayerItems: BookmarkItem[] = [];
	corePlugins: CorePlugins = {
		bookmarks: null,
		fileExplorer: null,
		globalSearch: null,
		graph: null,
	};
	upperLayers: BookmarkItem[][] = [];
	eventListenerFunc: (ev: KeyboardEvent) => void;

	constructor(app: App, settings: Settings, bookmarksPlugin: BookmarksPluginInstance, bookmarks: BookmarkItem[], upperLayers: BookmarkItem[][] = []) {
		super(app);
		this.settings = settings;
		this.bookmarks = this.settings.bsStructureType === 'default' ? bookmarks : this.convertToFlatStructure(bookmarks);
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
		return this.getDisplayName(bookmark);
	}

	private generateFooter(contentEl: HTMLElement): void {
		contentEl.createDiv('bs-footer', footerEl => {
			if (this.settings.bsShowFooterButtons) {
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

			if (this.settings.bsShowLegends) {
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
				if (this.corePlugins.bookmarks) {
					const bookmarks = bookmark.items || [];
					const upperLayers = [...this.upperLayers, bookmarks];
					new BookmarksSearchModal(this.app, this.settings, this.corePlugins.bookmarks, bookmarks, upperLayers).open();
				}
				break;
			}
			case 'file': {
				const file = this.app.vault.getAbstractFileByPath(bookmark.path || '');
				if (file instanceof TFile) {
					this.app.workspace.getLeaf(true).openFile(file, { eState: { subpath: bookmark.subpath } });
				}
				break;
			}
			case 'folder': {
				const folder = this.app.vault.getAbstractFileByPath(bookmark.path ?? '');
				if (folder instanceof TFolder && this.corePlugins.fileExplorer) {
					this.corePlugins.fileExplorer.revealInFolder(folder);
				}
				break;
			}
			case 'search': {
				if (this.corePlugins.globalSearch) {
					this.corePlugins.globalSearch.openGlobalSearch(bookmark.query ?? '');
				}
				break;
			}
			case 'graph': {
				if (this.corePlugins.graph && this.corePlugins.bookmarks) {	
					await this.app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE_EMPTY, active: true });
					await this.corePlugins.bookmarks.openBookmark(bookmark, 'tab');
				}
				break;
			}
			default:
				// nop
				break;
		}
	}

	renderSuggestion(item: FuzzyMatch<BookmarkItem>, suggestionItemEl: HTMLElement): HTMLElement {
		const bookmark = item.item;
		setIcon(suggestionItemEl, this.getTypeIcon(bookmark));
		suggestionItemEl.createSpan('', spanEl => spanEl.setText(this.getDisplayName(bookmark)));
		return suggestionItemEl;
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

	private getTypeIcon(bookmark: BookmarkItem): string {
		switch (bookmark.type) {
			case 'group':
				return 'chevron-right';
			case 'folder':
				return 'folder-closed';
			case 'file':
				if (bookmark.subpath) {
					return bookmark.subpath.slice(0, 2) === '#^' ? 'toy-brick' : 'heading';
				} else {
					return 'file';
				}
			case 'search':
				return 'search';
			case 'graph':
				return 'git-fork';
			default:
				return '';
		}
	}

	private getDisplayName(bookmark: BookmarkItem): string {
		if (bookmark.title) {
			return bookmark.title;
		}
		switch (bookmark.type) {
			case 'folder':
				return bookmark.path ?? '';
			case 'file': {
				const file = this.app.vault.getAbstractFileByPath(bookmark.path || '');
				return file instanceof TFile ? file.basename : '';
			}
			case 'search':
				return bookmark.query ?? '';
			case 'group':
			case 'graph':
			default:
				return '';
		}
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
		const bookmarks = this.settings.bsRecursivelyOpen && this.settings.bsStructureType === 'default' ? items : items.filter(item => item.type === 'file');
		for (const bookmark of bookmarks) {
			switch (bookmark.type) {
				case 'group':
					await this.openAllFiles(bookmark.items || [], false);
					break;
				case 'file': {
					const file = this.app.vault.getAbstractFileByPath(bookmark.path || '');
					if (file instanceof TFile) {
						await this.app.workspace.getLeaf(true).openFile(file, { eState: { subpath: bookmark.subpath } });
					}
					break;
				}
				// Not supported
				case 'folder':
				case 'search':
				case 'graph':
				default:
					// nop
					break;
			}
		}
		if (isTeardown) {
			this.app.workspace.detachLeavesOfType(VIEW_TYPE_BC_TMP);
			this.close();
		}
	}
}
