import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, SettingTab, Settings } from './settings';
import { APP_WITH_CORE_PLUGINS } from './types';
import { BookmarksCallerModal } from './bookmarks-caller-modal';
import { MessageModal } from './message-modal';

export default class BookmarkCaller extends Plugin {
	settings: Settings;
	settingTab: SettingTab;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('bookmark', 'Open bookmarks caller', () => this.openBookmarksCallerModal());

		this.addCommand({
			id: 'open-bookmarks-caller',
			name: 'Open bookmarks caller',
			callback: () => this.openBookmarksCallerModal(),
		});

		this.settingTab = new SettingTab(this.app, this);
		this.addSettingTab(this.settingTab);
		this.settingTab.updateStyleSheet();
	}

	onunload() {
		this.settingTab.updateStyleSheet(true);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private openBookmarksCallerModal(): void {
		const bookmarksPlugin = (this.app as APP_WITH_CORE_PLUGINS).internalPlugins.plugins.bookmarks;
		if (bookmarksPlugin) {
			const bookmarks = bookmarksPlugin.instance.items;
			new BookmarksCallerModal(this.app, this.settings, bookmarks).open();
		} else {
			new MessageModal(this.app).open();
		}
	}
}
