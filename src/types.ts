import { App } from 'obsidian';

export type APP_WITH_CORE_PLUGINS = App & {
	internalPlugins: {
		plugins: {
			bookmarks?: {
				instance: {
					items: BOOKMARK_ITEM[],
				},
			},
		},
	},
};

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

export type HISTORY = {
	items: BOOKMARK_ITEM[];
	pagePosition: number;
	focusPosition: number;
}
