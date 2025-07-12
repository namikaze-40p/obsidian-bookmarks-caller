import { App, TFile, TFolder, setIcon } from 'obsidian';
import {
	BookmarkItem,
	BookmarksPluginInstance,
	CustomApp,
	FileExplorerPluginInstance,
	GlobalSearchPluginInstance,
	GraphPluginInstance,
	PluginInstance,
	WebViewerPluginInstance,
} from './types';

const VIEW_TYPE_EMPTY = 'empty'
const STYLES_ID = 'bookmarks-caller-styles';

export const getEnabledPluginById = (app: App, pluginId: string): PluginInstance | null => {
	return (app as CustomApp)?.internalPlugins?.getEnabledPluginById(pluginId) || null;
};

export const setBookmarkIcon = async (el: HTMLElement, bookmark: BookmarkItem, webViewerPlugin?: WebViewerPluginInstance): Promise<void> => {
	switch (bookmark.type) {
		case 'group':
			return setIcon(el, 'chevron-right');
		case 'folder':
			return setIcon(el, 'folder-closed');
		case 'file':
			if (bookmark.subpath) {
				return setIcon(el, bookmark.subpath.slice(0, 2) === '#^' ? 'toy-brick' : 'heading');
			} else {
				return setIcon(el, 'file');
			}
		case 'search':
			return setIcon(el, 'search');
		case 'graph':
			return setIcon(el, 'git-fork');
		case 'url':
			if (webViewerPlugin?.db) {
				const domain = new URL(bookmark.url || '').hostname;
				const icon = await webViewerPlugin.db.loadIcon(domain, bookmark.url || '');
				if (icon) {
					el.createDiv('bc-favicon bs-favicon', iconEl => iconEl.style.backgroundImage = `url(${icon})`);
					return;
				}
			}
			return setIcon(el, 'globe-2');
		default:
			return;
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

export const openBookmarkOfUrl = (bookmark: BookmarkItem, webViewerPlugin?: WebViewerPluginInstance): void => {
	if (!bookmark.url) {
		return;
	}
	if (webViewerPlugin && webViewerPlugin.options?.openExternalURLs) {
		webViewerPlugin.openUrl(bookmark.url, true);
	} else {
		window.open(bookmark.url, '_blank');
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
			case 'url':
				openBookmarkOfUrl(bookmark, getEnabledPluginById(app, 'webviewer') as WebViewerPluginInstance);
				break;
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

export const deleteStyles = (): void => {
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
