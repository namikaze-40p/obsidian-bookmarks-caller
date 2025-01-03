import { App, Notice, PluginSettingTab, Setting, TextComponent } from 'obsidian';
import BookmarkCaller from './main';
import { createStyles, deleteStyles } from './util';

const SETTING_TYPE = {
	openBookmarksCaller: 'openBookmarksCaller',
	searchBookmarks: 'searchBookmarks',
} as const;

export interface OpenBookmarksCallerSettings {
	recursivelyOpen: boolean;
	showFooterButtons: boolean;
	showLegends: boolean;
	focusColor: string;
	characters: string;
	allBtn: string;
	backBtn: string;
}

export interface SearchBookmarksSettings {
	structureType: string;
	sortOrder: string;
	recursivelyOpen: boolean;
	showFooterButtons: boolean;
	showLegends: boolean;
	focusColor: string;
}

export interface Settings {
	[SETTING_TYPE.openBookmarksCaller]: OpenBookmarksCallerSettings;
	[SETTING_TYPE.searchBookmarks]: SearchBookmarksSettings;
}

const BOOKMARKS_CALLER_DEFAULT_SETTINGS = {
	recursivelyOpen: true,
	showFooterButtons: true,
	showLegends: true,
	focusColor: '#00b4e0',
	characters: 'asdfghjkl;',
	allBtn: '/',
	backBtn: 'Backspace',
} as const;

const SEARCH_BOOKMARKS_DEFAULT_SETTINGS = {
	structureType: 'flat',
	sortOrder: 'original',
	recursivelyOpen: true,
	showFooterButtons: true,
	showLegends: true,
	focusColor: '#00b4e0',
} as const;

export const DEFAULT_SETTINGS: Settings = {
	[SETTING_TYPE.openBookmarksCaller]: BOOKMARKS_CALLER_DEFAULT_SETTINGS,
	[SETTING_TYPE.searchBookmarks]: SEARCH_BOOKMARKS_DEFAULT_SETTINGS,
} as const;

export const STRUCTURE_TYPE: Record<string, string> = {
	flat: 'flat',
	original: 'original',
} as const;

export const SORT_ORDER: Record<string, string> = {
	original: 'original',
	newer: 'newer',
	older: 'older',
} as const;

export const CHAR_LENGTH = {
	min: 4,
	max: 10,
} as const;

const NOTION_DURATION_MS = 5000 as const;
const DUPLICATE_MESSAGE = `Can't assign duplicate characters and shortcut keys.` as const;
const NUMBER_OF_CHARACTERS_MESSAGE = '4 to 10 characters are required.' as const;
const RESERVED_KEYS_MESSAGE = `The key can't be assigned because it's used preferentially by this plugin.` as const;
const RESERVED_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'];

export class SettingTab extends PluginSettingTab {
	plugin: BookmarkCaller;
	isOpen = {
		firstDetails: false,
		secondDetails: false,
	};
	allBtnText: TextComponent;
	backBtnText: TextComponent;
	bsAllBtnText: TextComponent;
	bsBackBtnText: TextComponent;

	constructor(app: App, plugin: BookmarkCaller) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.addClass('bc-settings');

		{
			const detailsEl = containerEl.createEl('details', '', el => {
				el.createEl('summary', '', summaryEl => {
					summaryEl.setText('For "Open bookmarks caller" command');
				});
			});
			if (this.isOpen.firstDetails) {
				detailsEl.setAttr('open', true);
			}
			detailsEl.addEventListener("toggle", () => this.isOpen.firstDetails = detailsEl.open);
			this.setForOpenBookmarksCallerCommand(detailsEl);
		}

		{
			const detailsEl = containerEl.createEl('details', '', el => {
				el.createEl('summary', '', summaryEl => {
					summaryEl.setText('For "Search bookmarks" command');
				});
			});
			if (this.isOpen.secondDetails) {
				detailsEl.setAttr('open', true);
			}
			detailsEl.addEventListener("toggle", () => this.isOpen.secondDetails = detailsEl.open);
			this.setForSearchBookmarksCommand(detailsEl);
		}
	}

	updateStyleSheet(isTeardown = false): void {
		deleteStyles();
		if (isTeardown) {
			return;
		}

		const { openBookmarksCaller, searchBookmarks } = this.plugin.settings;
		const { focusColor } = openBookmarksCaller;
		const { focusColor: sbFocusColor } = searchBookmarks;
		createStyles([
			{ selector: '.bc-leaf-name-btn:focus', property: 'outline', value: `2px solid ${focusColor}` },
			{ selector: '.bookmarks-search-modal .suggestion-item.is-selected', property: 'outline', value: `2px solid ${sbFocusColor}` },
		]);
	}

	private setForOpenBookmarksCallerCommand(detailsEl: HTMLDetailsElement): void {
		const settingType = SETTING_TYPE.openBookmarksCaller;
		const settings = this.plugin.settings[settingType];

		new Setting(detailsEl)
			.setName(`Recursively open files under groups`)
			.setDesc('When enabled, recursively open files under groups when selected “All” button.')
			.addToggle(toggle => toggle.setValue(settings.recursivelyOpen)
				.onChange(async value => {
					settings.recursivelyOpen = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);

		new Setting(detailsEl)
			.setName(`Show footer buttons`)
			.setDesc('When enabled, show footer buttons on modal.')
			.addToggle(toggle => toggle.setValue(settings.showFooterButtons)
				.onChange(async value => {
					settings.showFooterButtons = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);
		
		new Setting(detailsEl)
			.setName(`Show legends`)
			.setDesc('When enabled, show legends on modal.')
			.addToggle(toggle => toggle.setValue(settings.showLegends)
				.onChange(async value => {
					settings.showLegends = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);
		
		new Setting(detailsEl)
			.setName('Color of button frame on focus')
			.setDesc('Choice your favorite color.')
			.addColorPicker(colorPicker => colorPicker.setValue(settings.focusColor)
				.onChange(async value => {
					settings.focusColor = value;
					await this.plugin.saveData(this.plugin.settings);
					this.updateStyleSheet();
				}),
			)
			.then(settingEl => {
				const setDefaultValue = () => settings.focusColor = DEFAULT_SETTINGS[settingType].focusColor;
				this.addResetButton(settingEl, setDefaultValue);
			});

		new Setting(detailsEl)
			.setName('Characters used for button hints')
			.setDesc(`Enter ${CHAR_LENGTH.min}~${CHAR_LENGTH.max} non-duplicate alphanumeric characters or symbols.`)
			.addText(text => {
				let orgCharacters = settings.characters;
				const { allBtn, backBtn } = settings;
				const textComponent = text
					.setPlaceholder('Enter characters')
					.setValue(settings.characters)
					.onChange(async value => {
						const { inputEl } = textComponent;
						if (!this.isDuplicateChars([...value, allBtn, backBtn]) && inputEl.validity.valid) {
							inputEl.removeClass('bc-setting-is-invalid');
							settings.characters = value;
							orgCharacters = value;
							await this.plugin.saveSettings();
						} else {
							inputEl.addClass('bc-setting-is-invalid');
						}
						this.updateStyleSheet();
					});

				textComponent.inputEl.addEventListener('blur', () => {
					if (this.isDuplicateChars([...textComponent.inputEl.value, allBtn, backBtn])) {
						settings.characters = orgCharacters;
						new Notice(DUPLICATE_MESSAGE, NOTION_DURATION_MS);
					}
					if (!textComponent.inputEl.validity.valid) {
						settings.characters = orgCharacters;
						new Notice(NUMBER_OF_CHARACTERS_MESSAGE, NOTION_DURATION_MS);
					}
				});
				textComponent.inputEl.setAttrs({
					maxLength: CHAR_LENGTH.max,
					required: true,
					pattern: `[!-~]{${CHAR_LENGTH.min},${CHAR_LENGTH.max}}`
				});
				return textComponent;
			})
			.then(settingEl => {
				const setDefaultValue = () => settings.characters = DEFAULT_SETTINGS[settingType].characters;
				this.addResetButton(settingEl, setDefaultValue);
			});

		new Setting(detailsEl)
			.setName('Shortcut key for the “All” button')
			.setDesc('Assign shortcut key for the “All” button.')
			.addText(text => {
				this.allBtnText = text.setValue(settings.allBtn);
				this.allBtnText.inputEl.setAttr('readonly', '');
				this.allBtnText.inputEl.addClass('bc-setting-shortcut-key');
				return this.allBtnText;
			})
			.then(settingEl => {
				const setDefaultValue = () => settings.allBtn = DEFAULT_SETTINGS[settingType].allBtn;
				this.addResetButton(settingEl, setDefaultValue);
			})
			.addExtraButton(button => button
				.setIcon('pencil')
				.setTooltip('Custom shortcut key')
				.onClick(() => {
					const usedKeys = [...settings.characters, settings.backBtn];
					this.onClickShortcutKeyEdit(this.allBtnText, 'allBtn', usedKeys);
				}),
			);

		new Setting(detailsEl)
			.setName('Shortcut key for the “Back” button')
			.setDesc('Assign shortcut key for the “Back” button.')
			.addText(text => {
				this.backBtnText = text.setValue(settings.backBtn);
				this.backBtnText.inputEl.setAttr('readonly', '');
				this.backBtnText.inputEl.addClass('bc-setting-shortcut-key');
				return this.backBtnText;
			})
			.then(settingEl => {
				const setDefaultValue = () => settings.backBtn = DEFAULT_SETTINGS[settingType].backBtn;
				this.addResetButton(settingEl, setDefaultValue);
			})
			.addExtraButton(button => button
				.setIcon('pencil')
				.setTooltip('Custom shortcut key')
				.onClick(() => {
					const usedKeys = [...settings.characters, settings.backBtn];
					this.onClickShortcutKeyEdit(this.backBtnText, 'backBtn', usedKeys);
				}),
			);
	}

	private setForSearchBookmarksCommand(detailsEl: HTMLDetailsElement): void {
		const settingType = SETTING_TYPE.searchBookmarks;
		const settings = this.plugin.settings[settingType];

		new Setting(detailsEl)
			.setName('Type of structure in the list view')
			.setDesc('"flat" displays nested groups in a flattened structure. “original" displays the structure as defined in the Bookmarks core plugin.')
			.addDropdown(item => item
				.addOptions(STRUCTURE_TYPE)
				.setValue(settings.structureType)
				.onChange(async value => {
					settings.structureType = value;
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				}),
			)
			.then(settingEl => {
				const setDefaultValue = () => settings.structureType = DEFAULT_SETTINGS[settingType].structureType;
				this.addResetButton(settingEl, setDefaultValue);
			});
			
		new Setting(detailsEl)
			.setName('Sort order')
			.setDesc(`
				"original" is displayed in the order defined by the Bookmarks core plugin. 
				"newer" is displayed in order of newer bookmark's creation time. 
				“older” is displayed in order of older bookmark's creation time.
			`)
			.addDropdown(item => item
				.addOptions(SORT_ORDER)
				.setValue(settings.sortOrder)
				.onChange(async value => {
					settings.sortOrder = value;
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				}),
			)
			.then(settingEl => {
				const setDefaultValue = () => settings.sortOrder = DEFAULT_SETTINGS[settingType].sortOrder;
				this.addResetButton(settingEl, setDefaultValue);
			});
			
		new Setting(detailsEl)
			.setName(`Recursively open files under groups`)
			.setDesc('When enabled, recursively open files under groups when selected “All” button.')
			.addToggle(toggle => toggle.setValue(settings.recursivelyOpen)
				.onChange(async value => {
					settings.recursivelyOpen = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);

		new Setting(detailsEl)
			.setName(`Show footer buttons`)
			.setDesc('When enabled, show footer buttons on modal.')
			.addToggle(toggle => toggle.setValue(settings.showFooterButtons)
				.onChange(async value => {
					settings.showFooterButtons = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);
		
		new Setting(detailsEl)
			.setName(`Show legends`)
			.setDesc('When enabled, show legends on modal.')
			.addToggle(toggle => toggle.setValue(settings.showLegends)
				.onChange(async value => {
					settings.showLegends = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);
		
		new Setting(detailsEl)
			.setName('Color of button frame on focus')
			.setDesc('Choice your favorite color.')
			.addColorPicker(colorPicker => colorPicker.setValue(settings.focusColor)
				.onChange(async value => {
					settings.focusColor = value;
					await this.plugin.saveData(this.plugin.settings);
					this.updateStyleSheet();
				}),
			)
			.then(settingEl => {
				const setDefaultValue = () => settings.focusColor = DEFAULT_SETTINGS[settingType].focusColor;
				this.addResetButton(settingEl, setDefaultValue);
			});
	}

	private isDuplicateChars(chars: string[]): boolean {
		return chars.some((char, idx) => chars.slice(idx + 1).includes(char));
	}

	private onClickShortcutKeyEdit(text: TextComponent, btnName: 'allBtn' | 'backBtn', usedKeys: string[]): void {
		text.inputEl.value = 'Press shortcut key';
		text.inputEl.addClass('class', 'bc-setting-shortcut-key-edit');
		text.inputEl.focus();
		const orgKey = this.plugin.settings[SETTING_TYPE.openBookmarksCaller][btnName];
		const display = this.display.bind(this);

		text.inputEl.addEventListener('keyup', async (ev: KeyboardEvent) => {
			this.plugin.settings[SETTING_TYPE.openBookmarksCaller][btnName] = ev.key;
			text.setValue(ev.key);
			await this.plugin.saveSettings();
			text.inputEl.removeEventListener('blur', display);
			display();
		});

		text.inputEl.addEventListener('blur', display);

		text.inputEl.addEventListener('blur', async () => {
			if (this.isDuplicateChars([text.inputEl.value, ...usedKeys])) {
				this.plugin.settings[SETTING_TYPE.openBookmarksCaller][btnName] = orgKey;
				await this.plugin.saveSettings();
				new Notice(DUPLICATE_MESSAGE, NOTION_DURATION_MS);
			}
			if (RESERVED_KEYS.includes(text.inputEl.value)) {
				this.plugin.settings[SETTING_TYPE.openBookmarksCaller][btnName] = orgKey;
				await this.plugin.saveSettings();
				new Notice(RESERVED_KEYS_MESSAGE, NOTION_DURATION_MS);
			}
		});
	}

	private addResetButton(settingEl: Setting, setDefaultValue: () => void, refreshView = true): void {
        settingEl
            .addExtraButton(button => button
				.setIcon('reset')
				.setTooltip('Reset to default')
				.onClick(async () => {
					setDefaultValue();
					await this.plugin.saveSettings();
					this.updateStyleSheet();
					if (refreshView) {
						this.display();
					}
				}));
	}
}
