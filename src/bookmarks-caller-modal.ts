import { App, Modal, setIcon } from 'obsidian';
import { OpenBookmarksCallerSettings, Settings } from './settings';
import {
	BookmarksPluginInstance,
	BookmarkItem,
	FileExplorerPluginInstance,
	GlobalSearchPluginInstance,
	GraphPluginInstance,
	CorePlugins,
} from './types';
import {
	getDisplayName,
	getEnabledPluginById,
	getTypeIcon,
	openBookmarkOfFile,
	openBookmarkOfFolder,
	openBookmarkOfGraph,
	openBookmarkOfSearch,
	openChildFiles,
} from './util';
import { VIEW_TYPE_BC_TMP } from './view';

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
const getButtonId = (bookmark?: BookmarkItem): string => {
	if (!bookmark) {
		return '';
	}
	const idPrefix = (bookmark.title ?? bookmark.path) as string;
	return `${idPrefix}_${bookmark.ctime}`;
};

type History = {
	items: BookmarkItem[];
	pagePosition: number;
	focusPosition: number;
}

export class BookmarksCallerModal extends Modal {
	settings: Settings;
	corePlugins: CorePlugins = {
		bookmarks: void 0,
		fileExplorer: void 0,
		globalSearch: void 0,
		graph: void 0,
	};
	chars: string[] = [];
	histories: History[] = [];
	buttonMap: Map<string, HTMLButtonElement> = new Map();
	pagePosition = 0;
	focusPosition = 0;
	groups: string[] = ['.'];
	buttonsViewEl: HTMLDivElement;
	headerTextEl: HTMLSpanElement;
	footerEl: HTMLDivElement;
	eventListenerFunc: (ev: KeyboardEvent) => void;

	private _currentLayerItems: BookmarkItem[] = [];

	set currentLayerItems(value: BookmarkItem[]) {
		this._currentLayerItems = value;
	}

	get currentLayerItems(): BookmarkItem[] {
		return this._currentLayerItems;
	}

	get viewItems(): BookmarkItem[] {
		return this._currentLayerItems.slice(this.pagePosition * this.chars.length, this.chars.length + this.pagePosition * this.chars.length);
	}

	get modalSettings(): OpenBookmarksCallerSettings {
		return this.settings.openBookmarksCaller;
	}

	constructor(app: App, settings: Settings, bookmarksPlugin: BookmarksPluginInstance) {
		super(app);
		this.settings = settings;
		this.chars = [...this.modalSettings.characters];
		this.currentLayerItems = bookmarksPlugin.items;
		this.histories.push({ items: this.currentLayerItems, pagePosition: 0, focusPosition: 0 });

		this.corePlugins.bookmarks = bookmarksPlugin;
		this.corePlugins.fileExplorer = getEnabledPluginById(this.app, 'file-explorer') as FileExplorerPluginInstance;
		this.corePlugins.globalSearch = getEnabledPluginById(this.app, 'global-search') as GlobalSearchPluginInstance;
		this.corePlugins.graph = getEnabledPluginById(this.app, 'graph') as GraphPluginInstance;
	}

	onOpen() {
		this.modalEl.addClasses(['bookmarks-caller-modal', 'bc-modal']);

		this.generateHeader(this.contentEl);
		this.buttonsViewEl = this.contentEl.createDiv('bc-buttons-view');
		this.generateContent(this.buttonsViewEl);
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

	private generateContent(contentEl: HTMLElement, pagePosition = 0, focusPosition = 0): void {
		contentEl.empty();
		this.focusPosition = focusPosition;
		this.pagePosition = pagePosition;

		if (this.viewItems.length) {
			this.generateButtons(contentEl);
			this.generateDummyButtons(contentEl);
			(this.buttonMap.get(getButtonId(this.viewItems.at(focusPosition))) as HTMLElement)?.focus();
			this.updateHeaderText();
		} else {
			contentEl.createSpan().setText('No items found in this group.');
		}
	}

	private generateButtons(contentEl: HTMLElement): void {
		this.viewItems.forEach((item, idx) => {
			contentEl.createDiv('bc-leaf-row', el => {
				const shortcutBtnEl = el.createEl('button', { text: this.chars.at(idx) });
				shortcutBtnEl.setAttr('tabIndex', -1);
				shortcutBtnEl.addClass('bc-shortcut-btn');
				shortcutBtnEl.addEventListener('click', () => this.clickItemButton(item, idx));

				const itemBtnEl = el.createEl('button');
				itemBtnEl.addClass('bc-leaf-name-btn');
				itemBtnEl.addEventListener('click', () => this.clickItemButton(item, idx));
				setIcon(itemBtnEl, getTypeIcon(item));

				const name = getDisplayName(this.app, item);
				itemBtnEl.createSpan('bc-leaf-name').setText(name || '');

				this.buttonMap.set(getButtonId(item), itemBtnEl);
			});
		});
	}

	private generateDummyButtons(contentEl: HTMLElement): void {
		const dummyButtonCount = this.chars.length - this.viewItems.length;
		for (let i = 0; i < dummyButtonCount; i++) {			
			contentEl.createDiv('bc-leaf-row bc-leaf-row-invisible', el => {
				const itemBtnEl = el.createEl('button');
				itemBtnEl.addClass('bc-leaf-name-btn');
				itemBtnEl.setAttr('disabled', true);
				
				const itemNameEl = itemBtnEl.createSpan('bc-leaf-name');
				itemNameEl.setText('-');
			});
		}
	}

	private generateFooter(contentEl: HTMLElement): void {
		this.footerEl?.empty();
		if (!this.viewItems.length) { 
			return;
		}
		this.footerEl = contentEl.createDiv('bc-footer', el => {
			if (this.modalSettings.showFooterButtons) {
				el.createDiv('bc-page-nav', navEl => {
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
				});
			}

			if (this.modalSettings.showLegends) {
				FOOTER_ITEMS.forEach(item => {
					el.createDiv('bc-legend', el => {
						let keys = item.keys;
						if (keys === 'all') {
							keys = this.modalSettings.allBtn;
						}
						if (keys === 'back') {
							keys = this.modalSettings.backBtn;
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

	private async clickItemButton(bookmark: BookmarkItem, idx: number): Promise<void> {
		switch (bookmark.type) {
			case 'group': {
				this.openBookmarkOfGroup(bookmark, idx);
				break;
			}
			case 'file': {
				openBookmarkOfFile(this.app, bookmark);
				this.close();
				break;
			}
			case 'folder': {
				openBookmarkOfFolder(this.app, bookmark, this.corePlugins.fileExplorer);
				this.close();
				break;
			}
			case 'search': {
				openBookmarkOfSearch(bookmark, this.corePlugins.globalSearch);
				this.close();
				break;
			}
			case 'graph': {
				await openBookmarkOfGraph(this.app, bookmark, this.corePlugins.bookmarks, this.corePlugins.graph);
				this.close();
				break;
			}
			default:
				// nop
				break;
		}
	}

	private openBookmarkOfGroup(bookmark: BookmarkItem, idx: number): void {
		const history = this.histories.at(-1) as History;
		history.pagePosition = this.pagePosition;
		history.focusPosition = idx;

		this.currentLayerItems = bookmark.items || [];
		this.groups.push(`${bookmark.title}`);
		this.histories.push({ items: this.currentLayerItems, pagePosition: 0, focusPosition: 0 });
		this.generateContent(this.buttonsViewEl);
		this.generateFooter(this.contentEl);
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

		if (ev.key === this.modalSettings.backBtn) {
			this.backToParentLayer();
			ev.preventDefault();
			return;
		}

		if (ev.key === this.modalSettings.allBtn) {
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
				this.generateContent(this.buttonsViewEl, this.pagePosition);
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
				this.generateContent(this.buttonsViewEl, this.pagePosition);
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

			const { items, pagePosition, focusPosition} = this.histories.at(-1) as History;
			this.currentLayerItems = items;
			this.generateContent(this.buttonsViewEl, pagePosition, focusPosition);
			this.generateFooter(this.contentEl);
		}
	}

	private async openAllFiles(items: BookmarkItem[], isTeardown = true): Promise<void> {
		if (isTeardown) {
			await this.app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE_BC_TMP });
		}
		const isRecursivelyOpen = this.modalSettings.recursivelyOpen;
		await openChildFiles(this.app, items, isRecursivelyOpen);
		if (isTeardown) {
			this.app.workspace.detachLeavesOfType(VIEW_TYPE_BC_TMP);
			this.close();
		}
	}
}
