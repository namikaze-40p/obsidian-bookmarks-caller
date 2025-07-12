import { App, Modal, setIcon } from 'obsidian';
import { OpenBookmarksCallerSettings, Settings } from './settings';
import {
	BookmarkItem,
	BookmarksPluginInstance,
	CorePlugins,
	FileExplorerPluginInstance,
	GlobalSearchPluginInstance,
	GraphPluginInstance,
	WebViewerPluginInstance,
} from './types';
import {
	getDisplayName,
	getEnabledPluginById,
	openBookmarkOfFile,
	openBookmarkOfFolder,
	openBookmarkOfGraph,
	openBookmarkOfSearch,
	openBookmarkOfUrl,
	openChildFiles,
	setBookmarkIcon
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
	private _corePlugins: CorePlugins = {
		bookmarks: void 0,
		fileExplorer: void 0,
		globalSearch: void 0,
		graph: void 0,
		webViewer: void 0,
	};
	private _chars: string[] = [];
	private _currentLayerItems: BookmarkItem[] = [];
	private _histories: History[] = [];
	private _buttonMap: Map<string, HTMLButtonElement> = new Map();
	private _pagePosition = 0;
	private _focusPosition = 0;
	private _groups: string[] = ['.'];
	private _buttonsViewEl: HTMLDivElement;
	private _headerTextEl: HTMLSpanElement;
	private _footerEl: HTMLDivElement;
	private _eventListenerFunc: (ev: KeyboardEvent) => void;

	private get viewItems(): BookmarkItem[] {
		return this._currentLayerItems.slice(this._pagePosition * this._chars.length, this._chars.length + this._pagePosition * this._chars.length);
	}

	private get modalSettings(): OpenBookmarksCallerSettings {
		return this._settings.openBookmarksCaller;
	}

	constructor(app: App, private _settings: Settings, private _bookmarksPlugin: BookmarksPluginInstance) {
		super(app);

		this._chars = [...this.modalSettings.characters];
		this._currentLayerItems = this._bookmarksPlugin.items;
		this._histories.push({ items: this._currentLayerItems, pagePosition: 0, focusPosition: 0 });

		this._corePlugins = {
			bookmarks: this._bookmarksPlugin,
			fileExplorer: getEnabledPluginById(this.app, 'file-explorer') as FileExplorerPluginInstance,
			globalSearch: getEnabledPluginById(this.app, 'global-search') as GlobalSearchPluginInstance,
			graph: getEnabledPluginById(this.app, 'graph') as GraphPluginInstance,
			webViewer: getEnabledPluginById(this.app, 'webviewer') as WebViewerPluginInstance,
		};
	}

	onOpen(): void {
		this.modalEl.addClasses(['bookmarks-caller-modal', 'bc-modal']);

		this.generateHeader(this.contentEl);
		this._buttonsViewEl = this.contentEl.createDiv('bc-buttons-view');
		this.generateContent(this._buttonsViewEl);
		this.generateFooter(this.contentEl);

		this._eventListenerFunc = this.handlingKeyupEvent.bind(this);
		window.addEventListener('keyup', this._eventListenerFunc);
	}

	onClose(): void {
		window.removeEventListener('keyup', this._eventListenerFunc);
		this.contentEl.empty();
	}

	private generateHeader(contentEl: HTMLElement): void {
		contentEl.createDiv('bc-header', el => {
			this._headerTextEl = el.createSpan('');
			this.updateHeaderText();
		});
	}

	private async generateContent(contentEl: HTMLElement, pagePosition = 0, focusPosition = 0): Promise<void> {
		contentEl.empty();
		this._focusPosition = focusPosition;
		this._pagePosition = pagePosition;

		if (this.viewItems.length) {
			await this.generateButtons(contentEl);
			this.generateDummyButtons(contentEl);
			(this._buttonMap.get(getButtonId(this.viewItems.at(focusPosition))) as HTMLElement)?.focus();
			this.updateHeaderText();
		} else {
			contentEl.createSpan().setText('No items found in this group.');
		}
	}

	private async generateButtons(contentEl: HTMLElement): Promise<void> {
		for (const [idx, item] of this.viewItems.entries()) {
			const el = contentEl.createDiv('bc-leaf-row');
			const shortcutBtnEl = el.createEl('button', { text: this._chars.at(idx) });
			shortcutBtnEl.setAttr('tabIndex', -1);
			shortcutBtnEl.addClass('bc-shortcut-btn');
			shortcutBtnEl.addEventListener('click', () => this.clickItemButton(item, idx));

			const itemBtnEl = el.createEl('button');
			itemBtnEl.addClass('bc-leaf-name-btn');
			itemBtnEl.addEventListener('click', () => this.clickItemButton(item, idx));
			await setBookmarkIcon(itemBtnEl, item, this._corePlugins.webViewer);

			const name = getDisplayName(this.app, item);
			itemBtnEl.createSpan('bc-leaf-name').setText(name || '');

			this._buttonMap.set(getButtonId(item), itemBtnEl);
		}
	}

	private generateDummyButtons(contentEl: HTMLElement): void {
		const dummyButtonCount = this._chars.length - this.viewItems.length;
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
		this._footerEl?.empty();
		if (!this.viewItems.length) { 
			return;
		}
		this._footerEl = contentEl.createDiv('bc-footer', el => {
			if (this.modalSettings.showFooterButtons) {
				el.createDiv('bc-page-nav', navEl => {
					const backBtnEl = navEl.createEl('button');
					setIcon(backBtnEl, 'undo-2');
					backBtnEl.createSpan('').setText('Back');
					backBtnEl.setAttr('tabIndex', -1);
					backBtnEl.addClass('bc-nav-btn');
					backBtnEl.addEventListener('click', () => this.backToParentLayer());

					if (this._currentLayerItems.length > this._chars.length) {
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
					openBtnEl.addEventListener('click', () => this.openAllFiles(this._currentLayerItems));
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
							keys = `${this._chars.slice(0, 2).join(' | ')} | ... | ${this._chars.slice(-2).join(' | ')}`;
						}
						el.createSpan('bc-keys').setText(keys);
						el.createSpan('bc-description').setText(item.description);
					});
				});
			}
		});
	}

	private updateHeaderText(): void {
		const path = this._groups.length === 1 ? `${this._groups.at(0)}/` : `.../${this._groups.at(-1)}/`;
		this._headerTextEl.setText(path);
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
				openBookmarkOfFolder(this.app, bookmark, this._corePlugins.fileExplorer);
				this.close();
				break;
			}
			case 'search': {
				openBookmarkOfSearch(bookmark, this._corePlugins.globalSearch);
				this.close();
				break;
			}
			case 'graph': {
				await openBookmarkOfGraph(this.app, bookmark, this._corePlugins.bookmarks, this._corePlugins.graph);
				this.close();
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

	private openBookmarkOfGroup(bookmark: BookmarkItem, idx: number): void {
		const history = this._histories.at(-1) as History;
		history.pagePosition = this._pagePosition;
		history.focusPosition = idx;

		this._currentLayerItems = bookmark.items || [];
		this._groups.push(`${bookmark.title}`);
		this._histories.push({ items: this._currentLayerItems, pagePosition: 0, focusPosition: 0 });
		this.generateContent(this._buttonsViewEl);
		this.generateFooter(this.contentEl);
	}

	private handlingKeyupEvent(ev: KeyboardEvent): void {
		if (this._chars.includes(ev.key)) {
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
			this.openAllFiles(this._currentLayerItems);
			ev.preventDefault();
			return;
		}
	}

	private keyupShortcutKeys(key: string): void {
		const idx = this._chars.indexOf(key);
		const item = this.viewItems.at(idx);
		this._buttonMap.get(getButtonId(item))?.click();
	}

	private keyupArrowKeys(key: string): void {
		switch (key) {
			case UP_KEY:
				if (this._focusPosition === 0) {
					(this._buttonMap.get(getButtonId(this.viewItems.at(-1))) as HTMLElement).focus();
					this._focusPosition = this.viewItems.length - 1;
				} else {
					(this._buttonMap.get(getButtonId(this.viewItems[this._focusPosition - 1])) as HTMLElement).focus();
					this._focusPosition -= 1;
				}
				break;
			case DOWN_KEY:
				if (this._focusPosition === this.viewItems.length - 1) {
					(this._buttonMap.get(getButtonId(this.viewItems.at(0))) as HTMLElement).focus();
					this._focusPosition = 0;
				} else {
					(this._buttonMap.get(getButtonId(this.viewItems[this._focusPosition + 1])) as HTMLElement).focus();
					this._focusPosition += 1;
				}
				break;
			case LEFT_KEY: {
				const pageSize = this._currentLayerItems.length / this._chars.length;
				if (Math.ceil(pageSize) === 1) {
					break;
				}
				if (this._pagePosition === 0) {
					this._pagePosition = this._currentLayerItems.length % this._chars.length === 0 ? Math.floor(pageSize) - 1 : Math.floor(pageSize);
				} else {
					this._pagePosition -= 1;
				}
				this.generateContent(this._buttonsViewEl, this._pagePosition);
				break;
			}
			case RIGHT_KEY: {
				const pageSize = this._currentLayerItems.length / this._chars.length;
				if (Math.ceil(pageSize) === 1) {
					break;
				}
				const lastPage = this._currentLayerItems.length % this._chars.length === 0 ? (pageSize) - 1 : Math.floor(pageSize);
				if (this._pagePosition === lastPage) {
					this._pagePosition = 0;
				} else {
					this._pagePosition += 1;
				}
				this.generateContent(this._buttonsViewEl, this._pagePosition);
				break;
			}
			default:
				// nop
				break;
		}
	}

	private backToParentLayer(): void {
		if (this._histories.length > 1) {
			this._groups.pop();
			this._histories.pop();

			const { items, pagePosition, focusPosition} = this._histories.at(-1) as History;
			this._currentLayerItems = items;
			this.generateContent(this._buttonsViewEl, pagePosition, focusPosition);
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
