import { App, PaneType, Plugin, TAbstractFile } from 'obsidian';

export type CustomApp = App & {
	internalPlugins: {
		getEnabledPluginById: (pluginId: string) => PluginInstance,	
	},
};

export type CorePlugins = {
	bookmarks: BookmarksPluginInstance | undefined,
	fileExplorer: FileExplorerPluginInstance | undefined,
	globalSearch: GlobalSearchPluginInstance | undefined,
	graph: GraphPluginInstance | undefined,
};

export type PluginInstance = BookmarksPluginInstance | FileExplorerPluginInstance | GlobalSearchPluginInstance | GraphPluginInstance;

type BasicPluginParams = {
	app: App,
	defaultOn: boolean,
	description: string,
	id: string,
	name: string,
	plugin: Plugin,
};

export type BookmarksPluginInstance = BasicPluginParams & {
	items: BookmarkItem[],
	openBookmark: (bookmark: BookmarkItem, type: PaneType | boolean, eState?: { focus: boolean }) => Promise<void>,
};

export type FileExplorerPluginInstance = BasicPluginParams & {
	revealInFolder: (path: TAbstractFile) => void,
};

export type GlobalSearchPluginInstance = BasicPluginParams & {
	openGlobalSearch: (query: string) => void,
};

export type GraphPluginInstance = BasicPluginParams;

export type BookmarkType = 'group' | 'folder' | 'file' | 'graph' | 'search';

export type BookmarkItem = {
	cTime: number;
	type: BookmarkType;
	title?: string;
	items?: BookmarkItem[];
	path?: string;
	subpath?: string;
	query?: string;
}
