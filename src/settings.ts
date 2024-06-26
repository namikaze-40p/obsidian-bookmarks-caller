import { App, Notice, PluginSettingTab, Setting, TextComponent } from 'obsidian';
import BookmarkCaller from './main';
import { createStyles, deleteStyles } from './util';

export const STRUCTURE_TYPE: Record<string, string> = {
	default: 'default',
	flat: 'flat',
} as const;

export interface Settings {
	// Settings for "Open bookmarks caller" command
	recursivelyOpen: boolean;
	showFooterButtons: boolean;
	showLegends: boolean;
	focusColor: string;
	characters: string;
	allBtn: string;
	backBtn: string;
	// Settings for "Search bookmarks" command
	bsStructureType: string;
	bsRecursivelyOpen: boolean;
	bsShowFooterButtons: boolean;
	bsShowLegends: boolean;
	bsFocusColor: string;
}

export const DEFAULT_SETTINGS: Settings = {
	// Settings for "Open bookmarks caller" command
	recursivelyOpen: true,
	showFooterButtons: true,
	showLegends: true,
	focusColor: '#00b4e0',
	characters: 'asdfghjkl;',
	allBtn: '/',
	backBtn: 'Backspace',
	// Settings for "Search bookmarks" command
	bsStructureType: 'default',
	bsRecursivelyOpen: true,
	bsShowFooterButtons: true,
	bsShowLegends: true,
	bsFocusColor: '#00b4e0',
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
		containerEl.createEl('h2').setText('Bookmarks Caller - Settings');

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

		const { characters, focusColor, bsFocusColor } = this.plugin.settings;
		createStyles([
			// 32 is button's height. 8 is margin of between buttons.
			{ selector: '.bc-buttons-view', property: 'min-height', value: `${32 * characters.length + 8 * (characters.length - 1)}px` },
			{ selector: '.bc-leaf-name-btn:focus', property: 'outline', value: `2px solid ${focusColor}` },
			{ selector: '.bookmarks-search-modal .suggestion-item.is-selected', property: 'outline', value: `2px solid ${bsFocusColor}` },
		]);
	}

	private setForOpenBookmarksCallerCommand(detailsEl: HTMLDetailsElement): void {
		new Setting(detailsEl)
			.setName(`Recursively open files under groups`)
			.setDesc('When enabled, recursively open files under groups when selected “All” button.')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.recursivelyOpen)
				.onChange(async value => {
					this.plugin.settings.recursivelyOpen = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);

		new Setting(detailsEl)
			.setName(`Show footer buttons`)
			.setDesc('When enabled, show footer buttons on modal.')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.showFooterButtons)
				.onChange(async value => {
					this.plugin.settings.showFooterButtons = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);
		
		new Setting(detailsEl)
			.setName(`Show legends`)
			.setDesc('When enabled, show legends on modal.')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.showLegends)
				.onChange(async value => {
					this.plugin.settings.showLegends = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);
		
		new Setting(detailsEl)
			.setName('Color of button frame on focus')
			.setDesc('Choice your favorite color.')
			.addColorPicker(colorPicker => colorPicker.setValue(this.plugin.settings.focusColor)
				.onChange(async value => {
					this.plugin.settings.focusColor = value;
					await this.plugin.saveData(this.plugin.settings);
					this.updateStyleSheet();
				}),
			)
			.then(settingEl => this.addResetButton(settingEl, 'focusColor'));

		new Setting(detailsEl)
			.setName('Characters used for button hints')
			.setDesc(`Enter ${CHAR_LENGTH.min}~${CHAR_LENGTH.max} non-duplicate alphanumeric characters or symbols.`)
			.addText(text => {
				let orgCharacters = this.plugin.settings.characters;
				const { allBtn, backBtn } = this.plugin.settings;
				const textComponent = text
					.setPlaceholder('Enter characters')
					.setValue(this.plugin.settings.characters)
					.onChange(async value => {
						const { inputEl } = textComponent;
						if (!this.isDuplicateChars([...value, allBtn, backBtn]) && inputEl.validity.valid) {
							inputEl.removeClass('bc-setting-is-invalid');
							this.plugin.settings.characters = value;
							orgCharacters = value;
							await this.plugin.saveSettings();
						} else {
							inputEl.addClass('bc-setting-is-invalid');
						}
						this.updateStyleSheet();
					});

				textComponent.inputEl.addEventListener('blur', () => {
					if (this.isDuplicateChars([...textComponent.inputEl.value, allBtn, backBtn])) {
						this.plugin.settings.characters = orgCharacters;
						new Notice(DUPLICATE_MESSAGE, NOTION_DURATION_MS);
					}
					if (!textComponent.inputEl.validity.valid) {
						this.plugin.settings.characters = orgCharacters;
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
			.then(settingEl => this.addResetButton(settingEl, 'characters'));

		new Setting(detailsEl)
			.setName('Shortcut key for the “All” button')
			.setDesc('Assign shortcut key for the “All” button.')
			.addText(text => {
				this.allBtnText = text.setValue(this.plugin.settings.allBtn);
				this.allBtnText.inputEl.setAttr('readonly', '');
				this.allBtnText.inputEl.addClass('bc-setting-shortcut-key');
				return this.allBtnText;
			})
			.then(settingEl => this.addResetButton(settingEl, 'allBtn'))
			.addExtraButton(button => button
				.setIcon('pencil')
				.setTooltip('Custom shortcut key')
				.onClick(() => {
					const usedKeys = [...this.plugin.settings.characters, this.plugin.settings.backBtn];
					this.onClickShortcutKeyEdit(this.allBtnText, 'allBtn', usedKeys);
				}),
			);

		new Setting(detailsEl)
			.setName('Shortcut key for the “Back” button')
			.setDesc('Assign shortcut key for the “Back” button.')
			.addText(text => {
				this.backBtnText = text.setValue(this.plugin.settings.backBtn);
				this.backBtnText.inputEl.setAttr('readonly', '');
				this.backBtnText.inputEl.addClass('bc-setting-shortcut-key');
				return this.backBtnText;
			})
			.then(settingEl => this.addResetButton(settingEl, 'backBtn'))
			.addExtraButton(button => button
				.setIcon('pencil')
				.setTooltip('Custom shortcut key')
				.onClick(() => {
					const usedKeys = [...this.plugin.settings.characters, this.plugin.settings.backBtn];
					this.onClickShortcutKeyEdit(this.backBtnText, 'backBtn', usedKeys);
				}),
			);
	}

	private setForSearchBookmarksCommand(detailsEl: HTMLDetailsElement): void {
		new Setting(detailsEl)
			.setName('Type of structure in the list view')
			.setDesc('"default" displays the structure as defined in the Bookmarks core plugin. "flat" displays nested groups in a flattened structure.')
			.addDropdown(item => item
				.addOptions(STRUCTURE_TYPE)
				.setValue(this.plugin.settings.bsStructureType)
				.onChange(async value => {
					this.plugin.settings.bsStructureType = value;
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				}),
			)
			.then(settingEl => this.addResetButton(settingEl, 'bsStructureType'));
			
		new Setting(detailsEl)
			.setName(`Recursively open files under groups`)
			.setDesc('When enabled, recursively open files under groups when selected “All” button.')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.bsRecursivelyOpen)
				.onChange(async value => {
					this.plugin.settings.bsRecursivelyOpen = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);

		new Setting(detailsEl)
			.setName(`Show footer buttons`)
			.setDesc('When enabled, show footer buttons on modal.')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.bsShowFooterButtons)
				.onChange(async value => {
					this.plugin.settings.bsShowFooterButtons = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);
		
		new Setting(detailsEl)
			.setName(`Show legends`)
			.setDesc('When enabled, show legends on modal.')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.bsShowLegends)
				.onChange(async value => {
					this.plugin.settings.bsShowLegends = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			);
		
		new Setting(detailsEl)
			.setName('Color of button frame on focus')
			.setDesc('Choice your favorite color.')
			.addColorPicker(colorPicker => colorPicker.setValue(this.plugin.settings.bsFocusColor)
				.onChange(async value => {
					this.plugin.settings.bsFocusColor = value;
					await this.plugin.saveData(this.plugin.settings);
					this.updateStyleSheet();
				}),
			)
			.then(settingEl => this.addResetButton(settingEl, 'bsFocusColor'));
	}

	private isDuplicateChars(chars: string[]): boolean {
		return chars.some((char, idx) => chars.slice(idx + 1).includes(char));
	}

	private onClickShortcutKeyEdit(text: TextComponent, btnName: 'allBtn' | 'backBtn', usedKeys: string[]): void {
		text.inputEl.value = 'Press shortcut key';
		text.inputEl.addClass('class', 'bc-setting-shortcut-key-edit');
		text.inputEl.focus();
		const orgKey = this.plugin.settings[btnName];
		const display = this.display.bind(this);

		text.inputEl.addEventListener('keyup', async (ev: KeyboardEvent) => {
			this.plugin.settings[btnName] = ev.key;
			text.setValue(ev.key);
			await this.plugin.saveSettings();
			text.inputEl.removeEventListener('blur', display);
			display();
		});

		text.inputEl.addEventListener('blur', display);

		text.inputEl.addEventListener('blur', async () => {
			if (this.isDuplicateChars([text.inputEl.value, ...usedKeys])) {
				this.plugin.settings[btnName] = orgKey;
				await this.plugin.saveSettings();
				new Notice(DUPLICATE_MESSAGE, NOTION_DURATION_MS);
			}
			if (RESERVED_KEYS.includes(text.inputEl.value)) {
				this.plugin.settings[btnName] = orgKey;
				await this.plugin.saveSettings();
				new Notice(RESERVED_KEYS_MESSAGE, NOTION_DURATION_MS);
			}
		});
	}

	private addResetButton(settingEl: Setting, settingKey: keyof typeof DEFAULT_SETTINGS, refreshView = true): void {
        settingEl
            .addExtraButton(button => button
				.setIcon('reset')
				.setTooltip('Reset to default')
				.onClick(async () => {
					const settingValue = DEFAULT_SETTINGS[settingKey];
					(this.plugin.settings[settingKey] as typeof settingValue) = settingValue;
					await this.plugin.saveSettings();
					this.updateStyleSheet();
					if (refreshView) {
						this.display();
					}
				}));
	}
}
