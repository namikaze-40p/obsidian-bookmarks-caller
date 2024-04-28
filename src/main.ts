import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, SettingTab, Settings } from './settings';
import { APP_WITH_CORE_PLUGINS, BOOKMARKS_PLUGIN_INSTANCE } from './types';
import { BookmarksCallerModal } from './bookmarks-caller-modal';
import { MessageModal } from './message-modal';
import { BcTmpView, VIEW_TYPE_BC_TMP } from './view';
import { getEnabledPluginById } from './util';

export default class BookmarkCaller extends Plugin {
	settings: Settings;
	settingTab: SettingTab;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_BC_TMP,
			(leaf) => new BcTmpView(leaf)
		);

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
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_BC_TMP);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private openBookmarksCallerModal(): void {
		const bookmarksPlugin = getEnabledPluginById(this.app, 'bookmarks') as BOOKMARKS_PLUGIN_INSTANCE;
		if (bookmarksPlugin) {
			const bookmarks = bookmarksPlugin.items;
			new BookmarksCallerModal(this.app, this.settings, bookmarks).open();
		} else {
			new MessageModal(this.app).open();
		}
	}
}
