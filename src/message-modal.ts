import { App, Modal } from 'obsidian';

export class MessageModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		this.modalEl.addClasses(['bookmarks-message-modal', 'bm-modal']);

		const divEl = this.contentEl.createDiv('bm-contents');
		const notionEl = divEl.createDiv('bm-content');
		notionEl.createSpan().setText('This plugin needs bookmarks plugin, but bookmarks plugin is disabled.');
		notionEl.createSpan().setText('You can enable bookmarks plugin under `Settings` → `Core plugins` → `Bookmarks`.');
		
		const referenceEl = divEl.createDiv('bm-content');
		referenceEl.createSpan().setText('Please check the following page for bookmarks.');
		const anchorEl = referenceEl.createEl('a');
		const link = 'https://help.obsidian.md/Plugins/Bookmarks';
		anchorEl.setText(link);
		anchorEl.setAttr('href', link);
	}

	onClose() {
		this.contentEl.empty();
	}
}
