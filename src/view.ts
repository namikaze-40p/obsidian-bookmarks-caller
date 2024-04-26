import { ItemView, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_BC_TMP = 'bc-tmp-view';

export class BcTmpView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_BC_TMP;
  }

  getDisplayText() {
    return '';
  }

  async onOpen() {
	// nop
  }

  async onClose() {
    // Nothing to clean up.
  }
}
