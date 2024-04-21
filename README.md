# Obsidian Bookmarks Caller

This is an [Obsidian](https://obsidian.md/) plugin which can easily open bookmarks without leaving the keyboard home position.

## How to use

1. Set bookmarks for core plugins.
    1. Enable bookmarks plugin under `Settings` → `Core plugins` → `Bookmarks`.
    1. Add bookmarks. (See [this official help page](https://help.obsidian.md/Plugins/Bookmarks) for instructions on how to add them.)
1. Call the modal in one of the following ways.
    1. Using hotkey. (**recommend**)
    1. Selecting `Bookmarks Caller: Open bookmarks caller` from the command palette.
1. Select the bookmark you wish to open in one of the following ways.
    1. Press the one-letter key displayed to the left of the tab name. (**recommend**)
    1. Move the cursor with arrow keys and select the tab.
    1. Click on the tab name with the mouse cursor.
1. If you want to open all of the bookmarks in the current folder, in one of the following ways.
    1. Using shortcut key. (**recommend**)
    1. Click "All" button.

![demo](https://raw.githubusercontent.com/namikaze-40p/obsidian-bookmarks-caller/main/demo/open-bookmarks.gif)

> [!NOTE]
>
> - supported: The following bookmark types.
>   - Bookmark a file
>   - Bookmark a folder
>   - Bookmark a heading
>   - Bookmark a block
> - Not supported: The following bookmark types.
>   - Bookmark a search term
>   - Bookmark a graph

## Installation

Install the plugin in one of the following ways.

- [Community Plugins browser (In preparation)](#community-plugins-browser-in-preparation)
- [Manually](#manually)
- [BRAT Plugin Manager](#brat-plugin-manager)

### Community Plugins browser (In preparation)

It's not on the community plugin yet, because now waiting Obsidian team for review.

### Manually

If you want to use this plugin, you can install in the following way.

1. Access to [Releases](https://github.com/namikaze-40p/obsidian-bookmarks-caller/releases), and download the 3 files(`main.js`, `manifest.json`, `style.css`) of latest version.
1. Create a new folder named `bookmarks-caller`.
1. Move download the 3 files to the `bookmarks-caller` folder.
1. Place the folder in your `.obsidian/plugins` directory. If you don't know where that is, you can go to Community Plugins inside Obsidian. There is a folder icon on the right of Installed Plugins. Click that and it opens your plugins folder.
1. Reload plugins. (the easiest way is just restarting Obsidian)
1. Activate the plugin as normal.

### BRAT Plugin Manager

If you want to use this plugin, you can install it using the BRAT plugin.

1. Install BRAT using the Obsidian Plugin manager
1. In your Obsidian settings on the left, select BRAT in the list.
1. In BRAT settings, click the button Add Beta Plugin
1. In the textbox, supply the URL to this repo => `https://github.com/namikaze-40p/obsidian-bookmarks-caller`
1. Once `Bookmarks Caller` is installed, activate it in your Obsidian settings.
