import { ItemView, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_BC_TMP = 'bc-tmp-view';

export class BcTmpView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_BC_TMP;
	}

	getDisplayText(): string {
		return '';
	}

	async onOpen(): Promise<void> {
		// nop
	}

	async onClose(): Promise<void> {
		// Nothing to clean up.
	}
}
