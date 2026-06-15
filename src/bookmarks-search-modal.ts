import {
  App,
  FuzzyMatch,
  FuzzySuggestModal,
  Platform,
  prepareFuzzySearch,
  renderResults,
  setIcon,
} from 'obsidian';
import { SORT_ORDER, STRUCTURE_TYPE, SearchBookmarksSettings, Settings } from './settings';
import { BookmarkItem, BookmarksPluginInstance } from './types';
import { filterExistingBookmarks, getDisplayName, openBookmark, openChildFiles, setBookmarkIcon } from './util';
import { VIEW_TYPE_BC_TMP } from './view';

const SHORTCUT_KEY = {
  all: 'Enter',
  back: 'Backspace',
};

const FOOTER_ITEMS = [
  { keys: '↑ | ↓', description: 'Move focus' },
  { keys: 'back', description: 'Back to parent group' },
  { keys: 'Enter', description: 'Open focused item' },
  { keys: 'all', description: 'Open all files in current group' },
];

const compareCreationTime =
  (isNewer: boolean) =>
  (a: BookmarkItem, b: BookmarkItem): number => {
    if (isNewer) {
      return b.ctime - a.ctime;
    } else {
      return a.ctime - b.ctime;
    }
  };

export class BookmarksSearchModal extends FuzzySuggestModal<BookmarkItem> {
  private _currentLayerItems: BookmarkItem[] = [];

  private get modalSettings(): SearchBookmarksSettings {
    return this._settings.searchBookmarks;
  }

  constructor(
    app: App,
    private _settings: Settings,
    private _bookmarksPlugin: BookmarksPluginInstance,
    private _bookmarks: BookmarkItem[],
    private _upperLayers: BookmarkItem[][] = [],
  ) {
    super(app);

    const clone = filterExistingBookmarks(this.app, structuredClone(this._bookmarks));
    const items =
      this.modalSettings.structureType === STRUCTURE_TYPE.original
        ? clone
        : this.convertToFlatStructure(clone);
    const sort = this.modalSettings.sortOrder;
    this._bookmarks =
      sort === SORT_ORDER.original
        ? items
        : items.sort(compareCreationTime(sort === SORT_ORDER.newer));
    this._currentLayerItems = this._bookmarks;

    this.setPlaceholder('Search bookmarks');

    this.registerShortcutKeys();

    this.generateFooter(this.modalEl);
    this.modalEl.addClasses(['bookmarks-search-modal', 'bs-modal']);
  }

  onOpen(): void {
    void super.onOpen();
    this.modalEl.style.setProperty('--search-modal-focus-color', this.modalSettings.focusColor);
  }

  onClose(): void {
    super.onClose();
    this.modalEl.style.removeProperty('--search-modal-focus-color');
  }

  getItems(): BookmarkItem[] {
    return this._currentLayerItems;
  }

  getItemText(bookmark: BookmarkItem): string {
    return getDisplayName(this.app, bookmark);
  }

  private generateFooter(contentEl: HTMLElement): void {
    contentEl.createDiv('bs-footer', (footerEl) => {
      if (this.modalSettings.showFooterButtons || this.modalSettings.showLegends) {
        footerEl.addClass('bs-footer-visible');
      }
      if (this.modalSettings.showFooterButtons) {
        footerEl.createDiv('bs-button', (el) => {
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
          openBtnEl.addEventListener('click', () => { void this.openAllFiles(this._currentLayerItems); });
        });
      }

      if (this.modalSettings.showLegends) {
        const modifier = Platform.isMacOS || Platform.isIosApp ? '⇧' : 'Shift + ';
        FOOTER_ITEMS.forEach((item) => {
          footerEl.createDiv('bs-legend', (el) => {
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

  onChooseItem(bookmark: BookmarkItem): void {
    if (bookmark.type === 'group') {
      this.openBookmarkOfGroup(bookmark);
    } else {
      void openBookmark(this.app, bookmark).then(() => this.close());
    }
  }

  renderSuggestion(item: FuzzyMatch<BookmarkItem>, suggestionItemEl: HTMLElement): void {
    const bookmark = item.item;
    void setBookmarkIcon(this.app, suggestionItemEl, bookmark);
    suggestionItemEl.createSpan('', (spanEl) =>
      this.renderSearchMatch(getDisplayName(this.app, bookmark), spanEl),
    );
  }

  private renderSearchMatch(str: string, el: HTMLElement): void {
    const query = this.inputEl.value;
    const search = prepareFuzzySearch(query);
    const result = search(str);
    if (result) {
      renderResults(el, str, result);
    } else {
      el.setText(str);
    }
  }

  private openBookmarkOfGroup(bookmark: BookmarkItem): void {
    if (this._bookmarksPlugin) {
      const bookmarks = bookmark.items || [];
      const upperLayers = [...this._upperLayers, bookmarks];
      new BookmarksSearchModal(
        this.app,
        this._settings,
        this._bookmarksPlugin,
        bookmarks,
        upperLayers,
      ).open();
    }
  }

  private convertToFlatStructure(bookmarks: BookmarkItem[]): BookmarkItem[] {
    const items: BookmarkItem[] = [];
    bookmarks.forEach((bookmark) => {
      items.push(bookmark);
      if (bookmark.type === 'group') {
        items.push(...this.convertToFlatStructure(bookmark.items || []));
      }
    });
    return items;
  }

  private registerShortcutKeys(): void {
    this.scope.register(['Shift'], SHORTCUT_KEY.back, (ev) => {
      this.backToParentLayer();
      ev.preventDefault();
    });

    this.scope.register(['Shift'], SHORTCUT_KEY.all, (ev) => {
      void this.openAllFiles(this._currentLayerItems);
      ev.preventDefault();
    });
  }

  private backToParentLayer(): void {
    if (this._upperLayers.length <= 1) {
      return;
    }
    if (this._bookmarksPlugin) {
      this._upperLayers.pop();
      const bookmarks = this._upperLayers.at(-1) || [];
      new BookmarksSearchModal(
        this.app,
        this._settings,
        this._bookmarksPlugin,
        bookmarks,
        this._upperLayers,
      ).open();
      this.close();
    }
  }

  private async openAllFiles(items: BookmarkItem[], isTeardown = true): Promise<void> {
    if (isTeardown) {
      await this.app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE_BC_TMP });
    }
    const isRecursivelyOpen =
      this.modalSettings.recursivelyOpen && this.modalSettings.structureType === 'original';
    try {
      await openChildFiles(this.app, items, isRecursivelyOpen);
    } finally {
      if (isTeardown) {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_BC_TMP);
        this.close();
      }
    }
  }
}
