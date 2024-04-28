import { App, Plugin } from 'obsidian';

export type APP_WITH_CORE_PLUGINS = App & {
	internalPlugins: {
		getEnabledPluginById: (pluginId: string) => PLUGIN_INSTANCE,	
	},
};

export type PLUGIN_INSTANCE = BOOKMARKS_PLUGIN_INSTANCE | FILE_EXPLORER_PLUGIN_INSTANCE | GLOBAL_SEARCH_PLUGIN_INSTANCE | GRAPH_PLUGIN_INSTANCE;

type BASIC_PLUGIN_PARAMS = {
	app: App,
	defaultOn: boolean,
	description: string,
	id: string,
	name: string,
	plugin: Plugin,
};

export type BOOKMARKS_PLUGIN_INSTANCE = BASIC_PLUGIN_PARAMS & {
	items: BOOKMARK_ITEM[],
};

export type FILE_EXPLORER_PLUGIN_INSTANCE = BASIC_PLUGIN_PARAMS;

export type GLOBAL_SEARCH_PLUGIN_INSTANCE = BASIC_PLUGIN_PARAMS & {
	openGlobalSearch: (query: string) => void,
};

export type GRAPH_PLUGIN_INSTANCE = BASIC_PLUGIN_PARAMS;

export type BOOKMARK_TYPE = 'group' | 'folder' | 'file' | 'graph' | 'search';

export type BOOKMARK_ITEM = {
	cTime: number;
	type: BOOKMARK_TYPE;
	title?: string;
	items?: BOOKMARK_ITEM[];
	path?: string;
	subpath?: string;
	query?: string;
}
