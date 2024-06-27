import { App, TFile, TFolder } from 'obsidian';
import {
	BookmarkItem,
	BookmarksPluginInstance,
	CustomApp,
	FileExplorerPluginInstance,
	GlobalSearchPluginInstance,
	GraphPluginInstance,
	PluginInstance,
} from './types';

const VIEW_TYPE_EMPTY = 'empty'
const STYLES_ID = 'bookmarks-caller-styles';

export const getEnabledPluginById = (app: App, pluginId: string): PluginInstance | null => {
	return (app as CustomApp)?.internalPlugins?.getEnabledPluginById(pluginId) || null;
};

export const getTypeIcon = (bookmark: BookmarkItem): string => {
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

export const getDisplayName = (app: App, bookmark: BookmarkItem): string => {
	if (bookmark.title) {
		return bookmark.title;
	}
	switch (bookmark.type) {
		case 'folder':
			return bookmark.path ?? '';
		case 'file': {
			const file = app.vault.getAbstractFileByPath(bookmark.path || '');
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

export const openBookmarkOfFile = (app: App, bookmark: BookmarkItem): void => {
	const file = app.vault.getAbstractFileByPath(bookmark.path || '');
	if (file instanceof TFile) {
		app.workspace.getLeaf(true).openFile(file, { eState: { subpath: bookmark.subpath } });
	}
}

export const openBookmarkOfFolder = (app: App, bookmark: BookmarkItem, fileExplorerPlugin?: FileExplorerPluginInstance): void => {
	const folder = app.vault.getAbstractFileByPath(bookmark.path ?? '');
	if (folder instanceof TFolder && fileExplorerPlugin) {
		fileExplorerPlugin.revealInFolder(folder);
	}
}

export const openBookmarkOfSearch = (bookmark: BookmarkItem, globalSearchPlugin?: GlobalSearchPluginInstance): void => {
	if (globalSearchPlugin) {
		globalSearchPlugin.openGlobalSearch(bookmark.query ?? '');
	}
}

export const openBookmarkOfGraph = async (app: App, bookmark: BookmarkItem, bookmarksPlugin?: BookmarksPluginInstance, graphPlugin?: GraphPluginInstance): Promise<void> => {
	if (graphPlugin && bookmarksPlugin) {	
		await app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE_EMPTY, active: true });
		await bookmarksPlugin.openBookmark(bookmark, 'tab');
	}
}

export const openChildFiles = async (app: App, items: BookmarkItem[], isRecursivelyOpen: boolean): Promise<void> => {
	const bookmarks = isRecursivelyOpen ? items : items.filter(item => item.type === 'file');
	for (const bookmark of bookmarks) {
		switch (bookmark.type) {
			case 'group':
				await openChildFiles(app, bookmark.items || [], isRecursivelyOpen);
				break;
			case 'file': {
				const file = app.vault.getAbstractFileByPath(bookmark.path || '');
				if (file instanceof TFile) {
					await app.workspace.getLeaf(true).openFile(file, { eState: { subpath: bookmark.subpath } });
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
}

export const deleteStyles = () => {
	const styleElm = document.getElementById(STYLES_ID);
	if (styleElm) {
		document.getElementsByTagName('HEAD')[0].removeChild(styleElm);
	}
};

export const createStyles = (styles: { selector: string, property: string, value: string }[]): void => {
	const styleSheet = document.createElement('style');
	setAttributes(styleSheet, { type: 'text/css', id: STYLES_ID });

	const header = document.getElementsByTagName('HEAD')[0];
	header.appendChild(styleSheet);

	styles.forEach(({ selector, property, value }) => {
		addNewStyle(selector, `${property}: ${value}`, styleSheet);
	});
};

const setAttributes = (element: HTMLElement, attributes: { [key: string]: string }): void => {
	for (const key in attributes) {
		element.setAttribute(key, attributes[key]);
	}
};

const addNewStyle = (selector: string, style: string, sheet: HTMLElement): void => {
	sheet.textContent += selector + `{${style}}`;
};
