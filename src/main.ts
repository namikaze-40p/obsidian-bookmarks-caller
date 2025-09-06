import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, SettingTab, Settings } from './settings';
import { BookmarksPluginInstance } from './types';
import { BookmarksCallerModal } from './bookmarks-caller-modal';
import { BookmarksSearcherModal } from './bookmarks-searcher-modal';
import { MessageModal } from './message-modal';
import { BcTmpView, VIEW_TYPE_BC_TMP } from './view';
import { getEnabledPluginById } from './util';

export default class BookmarkCaller extends Plugin {
  settings: Settings;
  private _settingTab: SettingTab;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_BC_TMP, (leaf) => new BcTmpView(leaf));

    this.addRibbonIcon('bookmark', 'Open bookmarks caller', () => this.openBookmarksCallerModal());
    this.addRibbonIcon('bookmark-check', 'Search bookmarks', () =>
      this.openBookmarksSearcherModal(),
    );

    this.addCommand({
      id: 'open-bookmarks-caller',
      name: 'Open bookmarks caller',
      callback: () => this.openBookmarksCallerModal(),
    });

    this.addCommand({
      id: 'search-bookmarks',
      name: 'Search bookmarks',
      callback: () => this.openBookmarksSearcherModal(),
    });

    this.addCommand({
      id: 'copy-bookmarks-json',
      name: 'Copy bookmarks.json to clipboard',
      callback: () => this.copyBookmarksJson(),
    });

    this._settingTab = new SettingTab(this.app, this);
    this.addSettingTab(this._settingTab);
    this._settingTab.updateStyleSheet();
  }

  onunload(): void {
    this._settingTab.updateStyleSheet(true);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BC_TMP);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.migrateSettingValues();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private openBookmarksCallerModal(): void {
    const bookmarksPlugin = getEnabledPluginById(this.app, 'bookmarks') as BookmarksPluginInstance;
    if (bookmarksPlugin) {
      new BookmarksCallerModal(this.app, this.settings, bookmarksPlugin).open();
    } else {
      new MessageModal(this.app).open();
    }
  }

  private openBookmarksSearcherModal(): void {
    const bookmarksPlugin = getEnabledPluginById(this.app, 'bookmarks') as BookmarksPluginInstance;
    if (bookmarksPlugin) {
      const bookmarks = bookmarksPlugin.items;
      new BookmarksSearcherModal(this.app, this.settings, bookmarksPlugin, bookmarks, [
        bookmarks,
      ]).open();
    } else {
      new MessageModal(this.app).open();
    }
  }

  private copyBookmarksJson(): void {
    const bookmarksPlugin = getEnabledPluginById(this.app, 'bookmarks') as BookmarksPluginInstance;
    if (bookmarksPlugin) {
      if (navigator.clipboard) {
        const data = JSON.stringify({ items: bookmarksPlugin.items });
        navigator.clipboard
          .writeText(data)
          .then(() => new Notice('Copied bookmarks.json to clipboard.'));
      }
    } else {
      new MessageModal(this.app).open();
    }
  }

  private async migrateSettingValues(): Promise<void> {
    type OldSettings = {
      recursivelyOpen?: boolean;
      showFooterButtons?: boolean;
      showLegends?: boolean;
      focusColor?: string;
      characters?: string;
      allBtn?: string;
      backBtn?: string;
    };
    const oldSettings = this.settings as any as OldSettings;
    if (typeof oldSettings.recursivelyOpen === 'boolean') {
      this.settings.openBookmarksCaller.recursivelyOpen = oldSettings.recursivelyOpen;
      delete oldSettings.recursivelyOpen;
    }
    if (typeof oldSettings.showFooterButtons === 'boolean') {
      this.settings.openBookmarksCaller.showFooterButtons = oldSettings.showFooterButtons;
      delete oldSettings.showFooterButtons;
    }
    if (typeof oldSettings.showLegends === 'boolean') {
      this.settings.openBookmarksCaller.showLegends = oldSettings.showLegends;
      delete oldSettings.showLegends;
    }
    if (typeof oldSettings.focusColor === 'string') {
      this.settings.openBookmarksCaller.focusColor = oldSettings.focusColor;
      delete oldSettings.focusColor;
    }
    if (typeof oldSettings.characters === 'string') {
      this.settings.openBookmarksCaller.characters = oldSettings.characters;
      delete oldSettings.characters;
    }
    if (typeof oldSettings.allBtn === 'string') {
      this.settings.openBookmarksCaller.allBtn = oldSettings.allBtn;
      delete oldSettings.allBtn;
    }
    if (typeof oldSettings.backBtn === 'string') {
      this.settings.openBookmarksCaller.backBtn = oldSettings.backBtn;
      delete oldSettings.backBtn;
    }
    await this.saveSettings();
  }
}
