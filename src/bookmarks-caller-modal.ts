import { App, Modal, TFile, TFolder, setIcon } from 'obsidian';
import { Settings } from './settings';
import { BOOKMARK_ITEM, FILE_EXPLORER_PLUGIN_INSTANCE, GLOBAL_SEARCH_PLUGIN_INSTANCE } from './types';
import { VIEW_TYPE_BC_TMP } from './view';
import { getEnabledPluginById } from './util';

const NOT_SUPPORTED_TYPES = ['graph'];
const UP_KEY = 'ArrowUp';
const DOWN_KEY = 'ArrowDown';
const LEFT_KEY = 'ArrowLeft';
const RIGHT_KEY = 'ArrowRight';
const FOOTER_ITEMS = [
	{ keys: '↑ | ↓', description: 'Move focus' },
	{ keys: '← | →', description: 'Switch pages' },
	{ keys: 'back', description: 'Back to parent group' },
	{ keys: 'Enter | Space', description: 'Open focused item' },
	{ keys: 'chars', description: 'Quickly open item' },
	{ keys: 'all', description: 'Open all files in current group' },
];
const getButtonId = (bookmark?: BOOKMARK_ITEM): string => {
	if (!bookmark) {
		return '';
	}
	const idPrefix = (bookmark.title ?? bookmark.path) as string;
	return `${idPrefix}_${bookmark.cTime}`;
};

type CORE_PLUGINS = {
	fileExplorer: FILE_EXPLORER_PLUGIN_INSTANCE | null,
	globalSearch: GLOBAL_SEARCH_PLUGIN_INSTANCE | null,
};

export type HISTORY = {
	items: BOOKMARK_ITEM[];
	pagePosition: number;
	focusPosition: number;
}

export class BookmarksCallerModal extends Modal {
	settings: Settings;
	corePlugins: CORE_PLUGINS = {
		fileExplorer: null,
		globalSearch: null,
	};
	chars: string[] = [];
	histories: HISTORY[] = [];
	buttonMap: Map<string, HTMLButtonElement> = new Map();
	pagePosition = 0;
	focusPosition = 0;
	groups: string[] = ['.'];
	buttonsViewEl: HTMLDivElement;
	headerTextEl: HTMLSpanElement;
	eventListenerFunc: (ev: KeyboardEvent) => void;

	private _currentLayerItems: BOOKMARK_ITEM[] = [];

	set currentLayerItems(value: BOOKMARK_ITEM[]) {
		this._currentLayerItems = value;
	}
	get currentLayerItems(): BOOKMARK_ITEM[] {
		return this._currentLayerItems;
	}
	get viewItems(): BOOKMARK_ITEM[] {
		return this._currentLayerItems.slice(this.pagePosition * this.chars.length, this.chars.length + this.pagePosition * this.chars.length);
	}

	constructor(app: App, settings: Settings, bookmarks: BOOKMARK_ITEM[]) {
		super(app);
		this.settings = settings;
		this.chars = [...this.settings.characters];
		this.currentLayerItems = bookmarks;
		this.histories.push({ items: this.currentLayerItems, pagePosition: 0, focusPosition: 0 });

		this.corePlugins.fileExplorer = getEnabledPluginById(this.app, 'file-explorer') as FILE_EXPLORER_PLUGIN_INSTANCE;
		this.corePlugins.globalSearch = getEnabledPluginById(this.app, 'global-search') as GLOBAL_SEARCH_PLUGIN_INSTANCE;
	}

	onOpen() {
		this.modalEl.addClasses(['bookmarks-caller-modal', 'bc-modal']);

		this.generateHeader(this.contentEl);
		this.buttonsViewEl = this.contentEl.createDiv('bc-buttons-view');
		this.generateButtons(this.buttonsViewEl);
		this.generateFooter(this.contentEl);

		this.eventListenerFunc = this.handlingKeyupEvent.bind(this);
		window.addEventListener('keyup', this.eventListenerFunc);
	}

	onClose() {
		window.removeEventListener('keyup', this.eventListenerFunc);
		this.contentEl.empty();
	}

	private generateHeader(contentEl: HTMLElement): void {
		contentEl.createDiv('bc-header', el => {
			this.headerTextEl = el.createSpan('');
			this.updateHeaderText();
		});
	}

	private generateButtons(contentEl: HTMLElement, pagePosition = 0, focusPosition = 0): void {
		contentEl.empty();
		this.focusPosition = focusPosition;
		this.pagePosition = pagePosition;

		if (!this.viewItems.length) {
			contentEl.createSpan().setText('No items found in this group.');
		}

		this.viewItems.forEach((item, idx) => {
			contentEl.createDiv('bc-leaf-row', el => {
				const shortcutBtnEl = el.createEl('button', { text: this.chars.at(idx) });
				shortcutBtnEl.setAttr('tabIndex', -1);
				shortcutBtnEl.addClass('bc-shortcut-btn');
				shortcutBtnEl.addEventListener('click', () => this.clickItemButton(item, idx));

				const itemBtnEl = el.createEl('button');
				itemBtnEl.addClass('bc-leaf-name-btn');
				itemBtnEl.addEventListener('click', () => this.clickItemButton(item, idx));
				setIcon(itemBtnEl, this.getTypeIcon(item));

				if (NOT_SUPPORTED_TYPES.includes(item.type)) {
					shortcutBtnEl.setAttr('readonly', '');
					itemBtnEl.setAttr('readonly', '');
				}

				const name = this.getDisplayName(item);
				itemBtnEl.createSpan('bc-leaf-name').setText(name || '');

				this.buttonMap.set(getButtonId(item), itemBtnEl);
			});
		});

		(this.buttonMap.get(getButtonId(this.viewItems.at(focusPosition))) as HTMLElement)?.focus();
		this.updateHeaderText();
	}

	private generateFooter(contentEl: HTMLElement): void {
		contentEl.createDiv('bc-footer', el => {
			el.createDiv('bc-page-nav', navEl => {
				if (this.settings.showFooterButtons) {
					const backBtnEl = navEl.createEl('button');
					setIcon(backBtnEl, 'undo-2');
					backBtnEl.createSpan('').setText('Back');
					backBtnEl.setAttr('tabIndex', -1);
					backBtnEl.addClass('bc-nav-btn');
					backBtnEl.addEventListener('click', () => this.backToParentLayer());

					if (this.currentLayerItems.length > this.chars.length) {
						const prevBtnEl = navEl.createEl('button', { text: '←' });
						prevBtnEl.setAttr('tabIndex', -1);
						prevBtnEl.addClass('bc-nav-btn');
						prevBtnEl.addEventListener('click', () => this.keyupArrowKeys(LEFT_KEY));
						
						const nextBtnEl = navEl.createEl('button', { text: '→' });
						nextBtnEl.setAttr('tabIndex', -1);
						nextBtnEl.addClass('bc-nav-btn');
						nextBtnEl.addEventListener('click', () => this.keyupArrowKeys(RIGHT_KEY));
					}

					const openBtnEl = navEl.createEl('button');
					setIcon(openBtnEl, 'square-stack');
					openBtnEl.createSpan('').setText('All');
					openBtnEl.setAttr('tabIndex', -1);
					openBtnEl.addClass('bc-nav-btn');
					openBtnEl.addEventListener('click', () => this.openAllFiles(this.currentLayerItems));
				}
			});

			if (this.settings.showLegends) {
				FOOTER_ITEMS.forEach(item => {
					el.createDiv('bc-legend', el => {
						let keys = item.keys;
						if (keys === 'all') {
							keys = this.settings.allBtn;
						}
						if (keys === 'back') {
							keys = this.settings.backBtn;
						}
						if (keys === 'chars') {
							keys = `${this.chars.slice(0, 2).join(' | ')} | ... | ${this.chars.slice(-2).join(' | ')}`;
						}
						el.createSpan('bc-keys').setText(keys);
						el.createSpan('bc-description').setText(item.description);
					});
				});
			}
		});
	}

	private updateHeaderText(): void {
		const path = this.groups.length === 1 ? `${this.groups.at(0)}/` : `.../${this.groups.at(-1)}/`;
		this.headerTextEl.setText(path);
	}

	private getTypeIcon(bookmark: BOOKMARK_ITEM): string {
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

	private getDisplayName(bookmark: BOOKMARK_ITEM): string {
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

	private async clickItemButton(bookmark: BOOKMARK_ITEM, idx: number): Promise<void> {
		switch (bookmark.type) {
			case 'group': {
				const history = this.histories.at(-1) as HISTORY;
				history.pagePosition = this.pagePosition;
				history.focusPosition = idx;
	
				this.currentLayerItems = bookmark.items || [];
				this.groups.push(`${bookmark.title}`);
				this.histories.push({ items: this.currentLayerItems, pagePosition: 0, focusPosition: 0 });
				this.generateButtons(this.buttonsViewEl);
				break;
			}
			case 'file': {
				const file = this.app.vault.getAbstractFileByPath(bookmark.path || '');
				if (file instanceof TFile) {
					this.app.workspace.getLeaf(true).openFile(file, { eState: { subpath: bookmark.subpath } });
				}
				this.close();
				break;
			}
			case 'folder': {
				const folder = this.app.vault.getAbstractFileByPath(bookmark.path ?? '');
				if (folder instanceof TFolder && this.corePlugins.fileExplorer) {
					this.corePlugins.fileExplorer.revealInFolder(folder);
				}
				this.close();
				break;
			}
			case 'search': {
				if (this.corePlugins.globalSearch) {
					this.corePlugins.globalSearch.openGlobalSearch(bookmark.query ?? '');
				}
				this.close();
				break;
			}
			// Not supported
			case 'graph':
			default:
				// nop
				break;
		}
	}

	private handlingKeyupEvent(ev: KeyboardEvent): void {
		if (this.chars.includes(ev.key)) {
			this.keyupShortcutKeys(ev.key);
			ev.preventDefault();
			return;
		}

		if ([UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY].includes(ev.key)) {
			this.keyupArrowKeys(ev.key);
			ev.preventDefault();
			return;
		}

		if (ev.key === this.settings.backBtn) {
			this.backToParentLayer();
			ev.preventDefault();
			return;
		}

		if (ev.key === this.settings.allBtn) {
			this.openAllFiles(this.currentLayerItems);
			ev.preventDefault();
			return;
		}
	}

	private keyupShortcutKeys(key: string): void {
		const idx = this.chars.indexOf(key);
		const item = this.viewItems.at(idx);
		this.buttonMap.get(getButtonId(item))?.click();
	}

	private keyupArrowKeys(key: string): void {
		switch (key) {
			case UP_KEY:
				if (this.focusPosition === 0) {
					(this.buttonMap.get(getButtonId(this.viewItems.at(-1))) as HTMLElement).focus();
					this.focusPosition = this.viewItems.length - 1;
				} else {
					(this.buttonMap.get(getButtonId(this.viewItems[this.focusPosition - 1])) as HTMLElement).focus();
					this.focusPosition -= 1;
				}
				break;
			case DOWN_KEY:
				if (this.focusPosition === this.viewItems.length - 1) {
					(this.buttonMap.get(getButtonId(this.viewItems.at(0))) as HTMLElement).focus();
					this.focusPosition = 0;
				} else {
					(this.buttonMap.get(getButtonId(this.viewItems[this.focusPosition + 1])) as HTMLElement).focus();
					this.focusPosition += 1;
				}
				break;
			case LEFT_KEY: {
				const pageSize = this.currentLayerItems.length / this.chars.length;
				if (Math.ceil(pageSize) === 1) {
					break;
				}
				if (this.pagePosition === 0) {
					this.pagePosition = this.currentLayerItems.length % this.chars.length === 0 ? Math.floor(pageSize) - 1 : Math.floor(pageSize);
				} else {
					this.pagePosition -= 1;
				}
				this.generateButtons(this.buttonsViewEl, this.pagePosition);
				break;
			}
			case RIGHT_KEY: {
				const pageSize = this.currentLayerItems.length / this.chars.length;
				if (Math.ceil(pageSize) === 1) {
					break;
				}
				const lastPage = this.currentLayerItems.length % this.chars.length === 0 ? (pageSize) - 1 : Math.floor(pageSize);
				if (this.pagePosition === lastPage) {
					this.pagePosition = 0;
				} else {
					this.pagePosition += 1;
				}
				this.generateButtons(this.buttonsViewEl, this.pagePosition);
				break;
			}
			default:
				// nop
				break;
		}
	}

	private backToParentLayer(): void {
		if (this.histories.length > 1) {
			this.groups.pop();
			this.histories.pop();

			const { items, pagePosition, focusPosition} = this.histories.at(-1) as HISTORY;
			this.currentLayerItems = items;
			this.generateButtons(this.buttonsViewEl, pagePosition, focusPosition);
		}
	}

	private async openAllFiles(items: BOOKMARK_ITEM[], isTeardown = true): Promise<void> {
		if (isTeardown) {
			await this.app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE_BC_TMP });
		}
		const bookmarks = this.settings.recursivelyOpen ? items : items.filter(item => item.type === 'file');
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
