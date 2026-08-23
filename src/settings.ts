import {
  App,
  Notice,
  PluginSettingTab,
  Setting,
  SettingDefinitionItem,
  SettingDefinitionRender,
  TextComponent,
} from 'obsidian';
import BookmarkCaller from './main';

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
const RESERVED_KEYS_MESSAGE =
  `The key can't be assigned because it's used preferentially by this plugin.` as const;
const RESERVED_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'];

const RECURSIVELY_OPEN_TEXT = {
  name: 'Recursively open files under groups',
  desc: 'When enabled, recursively open files under groups when selected “All” button.',
} as const;
const SHOW_FOOTER_BUTTONS_TEXT = {
  name: 'Show footer buttons',
  desc: 'When enabled, show footer buttons on modal.',
} as const;
const SHOW_LEGENDS_TEXT = {
  name: 'Show legends',
  desc: 'When enabled, show legends on modal.',
} as const;
const FOCUS_COLOR_TEXT = {
  name: 'Color of button frame on focus',
  desc: 'Choice your favorite color.',
} as const;
const CHARACTERS_TEXT = {
  name: 'Characters used for button hints',
  desc: `Enter ${CHAR_LENGTH.min}~${CHAR_LENGTH.max} non-duplicate alphanumeric characters or symbols.`,
} as const;
const ALL_BTN_TEXT = {
  name: 'Shortcut key for the “All” button',
  desc: 'Assign shortcut key for the “All” button.',
} as const;
const BACK_BTN_TEXT = {
  name: 'Shortcut key for the “Back” button',
  desc: 'Assign shortcut key for the “Back” button.',
} as const;
const STRUCTURE_TYPE_TEXT = {
  name: 'Type of structure in the list view',
  desc: '"flat" displays nested groups in a flattened structure. “original" displays the structure as defined in the Bookmarks core plugin.',
} as const;
const SORT_ORDER_TEXT = {
  name: 'Sort order',
  desc: `
				"original" is displayed in the order defined by the Bookmarks core plugin.
				"newer" is displayed in order of newer bookmark's creation time.
				“older” is displayed in order of older bookmark's creation time.
			`,
} as const;

interface SettingItemBuilder {
  readonly name: string;
  readonly desc: string;
  readonly build: (setting: Setting) => void;
}

export class SettingTab extends PluginSettingTab {
  private _isOpen = {
    firstDetails: false,
    secondDetails: false,
  };
  private _allBtnText: TextComponent;
  private _backBtnText: TextComponent;

  constructor(
    app: App,
    private _plugin: BookmarkCaller,
  ) {
    super(app, _plugin);
  }

  /**
   * Uses APIs added in Obsidian 1.13.0, but minAppVersion is intentionally kept lower.
   * Only called by hosts that know about it (1.13.0+); older hosts fall back to display() below.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const toDefinition = ({ build, ...text }: SettingItemBuilder): SettingDefinitionRender => ({
      ...text,
      render: build,
    });

    return [
      {
        type: 'group',
        heading: 'For "Open modal" command',
        items: this.getOpenBookmarksCallerBuilders(() => this.update()).map(toDefinition),
      },
      {
        type: 'group',
        heading: 'For "Search" command',
        items: this.getSearchBookmarksBuilders(() => this.update()).map(toDefinition),
      },
    ];
  }

  /**
   * @deprecated Fallback rendering for Obsidian versions older than 1.13.0. Use getSettingDefinitions() instead.
   */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.addClass('bc-settings');

    {
      const detailsEl = containerEl.createEl('details', '', (el) => {
        el.createEl('summary', '', (summaryEl) => {
          summaryEl.setText('For "Open modal" command');
        });
      });
      if (this._isOpen.firstDetails) {
        detailsEl.setAttr('open', true);
      }
      detailsEl.addEventListener('toggle', () => (this._isOpen.firstDetails = detailsEl.open));
      this.setForOpenBookmarksCallerCommand(detailsEl);
    }

    {
      const detailsEl = containerEl.createEl('details', '', (el) => {
        el.createEl('summary', '', (summaryEl) => {
          summaryEl.setText('For "Search" command');
        });
      });
      if (this._isOpen.secondDetails) {
        detailsEl.setAttr('open', true);
      }
      detailsEl.addEventListener('toggle', () => (this._isOpen.secondDetails = detailsEl.open));
      this.setForSearchBookmarksCommand(detailsEl);
    }
  }

  private getOpenBookmarksCallerBuilders(refresh: () => void): SettingItemBuilder[] {
    const settingType = SETTING_TYPE.openBookmarksCaller;
    const settings = this._plugin.settings[settingType];

    return [
      {
        ...RECURSIVELY_OPEN_TEXT,
        build: (setting) => this.buildRecursivelyOpenSetting(setting, settings),
      },
      {
        ...SHOW_FOOTER_BUTTONS_TEXT,
        build: (setting) => this.buildShowFooterButtonsSetting(setting, settings),
      },
      {
        ...SHOW_LEGENDS_TEXT,
        build: (setting) => this.buildShowLegendsSetting(setting, settings),
      },
      {
        ...FOCUS_COLOR_TEXT,
        build: (setting) => this.buildFocusColorSetting(setting, settingType, settings, refresh),
      },
      {
        ...CHARACTERS_TEXT,
        build: (setting) => this.buildCharactersSetting(setting, settingType, settings, refresh),
      },
      {
        ...ALL_BTN_TEXT,
        build: (setting) => this.buildAllBtnSetting(setting, settingType, settings, refresh),
      },
      {
        ...BACK_BTN_TEXT,
        build: (setting) => this.buildBackBtnSetting(setting, settingType, settings, refresh),
      },
    ];
  }

  private getSearchBookmarksBuilders(refresh: () => void): SettingItemBuilder[] {
    const settingType = SETTING_TYPE.searchBookmarks;
    const settings = this._plugin.settings[settingType];

    return [
      {
        ...STRUCTURE_TYPE_TEXT,
        build: (setting) => this.buildStructureTypeSetting(setting, settingType, settings, refresh),
      },
      {
        ...SORT_ORDER_TEXT,
        build: (setting) => this.buildSortOrderSetting(setting, settingType, settings, refresh),
      },
      {
        ...RECURSIVELY_OPEN_TEXT,
        build: (setting) => this.buildRecursivelyOpenSetting(setting, settings),
      },
      {
        ...SHOW_FOOTER_BUTTONS_TEXT,
        build: (setting) => this.buildShowFooterButtonsSetting(setting, settings),
      },
      {
        ...SHOW_LEGENDS_TEXT,
        build: (setting) => this.buildShowLegendsSetting(setting, settings),
      },
      {
        ...FOCUS_COLOR_TEXT,
        build: (setting) => this.buildFocusColorSetting(setting, settingType, settings, refresh),
      },
    ];
  }

  private setForOpenBookmarksCallerCommand(detailsEl: HTMLDetailsElement): void {
    this.getOpenBookmarksCallerBuilders(() => this.display()).forEach(({ build }) =>
      build(new Setting(detailsEl)),
    );
  }

  private setForSearchBookmarksCommand(detailsEl: HTMLDetailsElement): void {
    this.getSearchBookmarksBuilders(() => this.display()).forEach(({ build }) =>
      build(new Setting(detailsEl)),
    );
  }

  private buildRecursivelyOpenSetting(
    setting: Setting,
    settings: OpenBookmarksCallerSettings | SearchBookmarksSettings,
  ): void {
    setting
      .setName(RECURSIVELY_OPEN_TEXT.name)
      .setDesc(RECURSIVELY_OPEN_TEXT.desc)
      .addToggle((toggle) =>
        toggle.setValue(settings.recursivelyOpen).onChange(async (value) => {
          settings.recursivelyOpen = value;
          await this._plugin.saveData(this._plugin.settings);
        }),
      );
  }

  private buildShowFooterButtonsSetting(
    setting: Setting,
    settings: OpenBookmarksCallerSettings | SearchBookmarksSettings,
  ): void {
    setting
      .setName(SHOW_FOOTER_BUTTONS_TEXT.name)
      .setDesc(SHOW_FOOTER_BUTTONS_TEXT.desc)
      .addToggle((toggle) =>
        toggle.setValue(settings.showFooterButtons).onChange(async (value) => {
          settings.showFooterButtons = value;
          await this._plugin.saveData(this._plugin.settings);
        }),
      );
  }

  private buildShowLegendsSetting(
    setting: Setting,
    settings: OpenBookmarksCallerSettings | SearchBookmarksSettings,
  ): void {
    setting
      .setName(SHOW_LEGENDS_TEXT.name)
      .setDesc(SHOW_LEGENDS_TEXT.desc)
      .addToggle((toggle) =>
        toggle.setValue(settings.showLegends).onChange(async (value) => {
          settings.showLegends = value;
          await this._plugin.saveData(this._plugin.settings);
        }),
      );
  }

  private buildFocusColorSetting(
    setting: Setting,
    settingType: keyof Settings,
    settings: OpenBookmarksCallerSettings | SearchBookmarksSettings,
    refresh: () => void,
  ): void {
    setting
      .setName(FOCUS_COLOR_TEXT.name)
      .setDesc(FOCUS_COLOR_TEXT.desc)
      .addColorPicker((colorPicker) =>
        colorPicker.setValue(settings.focusColor).onChange(async (value) => {
          settings.focusColor = value;
          await this._plugin.saveData(this._plugin.settings);
        }),
      )
      .then((settingEl) => {
        const setDefaultValue = () =>
          (settings.focusColor = DEFAULT_SETTINGS[settingType].focusColor);
        this.addResetButton(settingEl, setDefaultValue, refresh);
      });
  }

  private buildCharactersSetting(
    setting: Setting,
    settingType: typeof SETTING_TYPE.openBookmarksCaller,
    settings: OpenBookmarksCallerSettings,
    refresh: () => void,
  ): void {
    setting
      .setName(CHARACTERS_TEXT.name)
      .setDesc(CHARACTERS_TEXT.desc)
      .addText((text) => {
        let orgCharacters = settings.characters;
        const { allBtn, backBtn } = settings;
        const textComponent = text
          .setPlaceholder('Enter characters')
          .setValue(settings.characters)
          .onChange(async (value) => {
            const { inputEl } = textComponent;
            if (!this.isDuplicateChars([...value, allBtn, backBtn]) && inputEl.validity.valid) {
              inputEl.removeClass('bc-setting-is-invalid');
              settings.characters = value;
              orgCharacters = value;
              await this._plugin.saveSettings();
            } else {
              inputEl.addClass('bc-setting-is-invalid');
            }
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
          pattern: `[!-~]{${CHAR_LENGTH.min},${CHAR_LENGTH.max}}`,
        });
        return textComponent;
      })
      .then((settingEl) => {
        const setDefaultValue = () =>
          (settings.characters = DEFAULT_SETTINGS[settingType].characters);
        this.addResetButton(settingEl, setDefaultValue, refresh);
      });
  }

  private buildAllBtnSetting(
    setting: Setting,
    settingType: typeof SETTING_TYPE.openBookmarksCaller,
    settings: OpenBookmarksCallerSettings,
    refresh: () => void,
  ): void {
    setting
      .setName(ALL_BTN_TEXT.name)
      .setDesc(ALL_BTN_TEXT.desc)
      .addText((text) => {
        this._allBtnText = text.setValue(settings.allBtn);
        this._allBtnText.inputEl.setAttr('readonly', '');
        this._allBtnText.inputEl.addClass('bc-setting-shortcut-key');
        return this._allBtnText;
      })
      .then((settingEl) => {
        const setDefaultValue = () => (settings.allBtn = DEFAULT_SETTINGS[settingType].allBtn);
        this.addResetButton(settingEl, setDefaultValue, refresh);
      })
      .addExtraButton((button) =>
        button
          .setIcon('pencil')
          .setTooltip('Custom shortcut key')
          .onClick(() => {
            const usedKeys = [...settings.characters, settings.backBtn];
            this.onClickShortcutKeyEdit(this._allBtnText, 'allBtn', usedKeys, refresh);
          }),
      );
  }

  private buildBackBtnSetting(
    setting: Setting,
    settingType: typeof SETTING_TYPE.openBookmarksCaller,
    settings: OpenBookmarksCallerSettings,
    refresh: () => void,
  ): void {
    setting
      .setName(BACK_BTN_TEXT.name)
      .setDesc(BACK_BTN_TEXT.desc)
      .addText((text) => {
        this._backBtnText = text.setValue(settings.backBtn);
        this._backBtnText.inputEl.setAttr('readonly', '');
        this._backBtnText.inputEl.addClass('bc-setting-shortcut-key');
        return this._backBtnText;
      })
      .then((settingEl) => {
        const setDefaultValue = () => (settings.backBtn = DEFAULT_SETTINGS[settingType].backBtn);
        this.addResetButton(settingEl, setDefaultValue, refresh);
      })
      .addExtraButton((button) =>
        button
          .setIcon('pencil')
          .setTooltip('Custom shortcut key')
          .onClick(() => {
            const usedKeys = [...settings.characters, settings.backBtn];
            this.onClickShortcutKeyEdit(this._backBtnText, 'backBtn', usedKeys, refresh);
          }),
      );
  }

  private buildStructureTypeSetting(
    setting: Setting,
    settingType: typeof SETTING_TYPE.searchBookmarks,
    settings: SearchBookmarksSettings,
    refresh: () => void,
  ): void {
    setting
      .setName(STRUCTURE_TYPE_TEXT.name)
      .setDesc(STRUCTURE_TYPE_TEXT.desc)
      .addDropdown((item) =>
        item
          .addOptions(STRUCTURE_TYPE)
          .setValue(settings.structureType)
          .onChange(async (value) => {
            settings.structureType = value;
            await this._plugin.saveData(this._plugin.settings);
            refresh();
          }),
      )
      .then((settingEl) => {
        const setDefaultValue = () =>
          (settings.structureType = DEFAULT_SETTINGS[settingType].structureType);
        this.addResetButton(settingEl, setDefaultValue, refresh);
      });
  }

  private buildSortOrderSetting(
    setting: Setting,
    settingType: typeof SETTING_TYPE.searchBookmarks,
    settings: SearchBookmarksSettings,
    refresh: () => void,
  ): void {
    setting
      .setName(SORT_ORDER_TEXT.name)
      .setDesc(SORT_ORDER_TEXT.desc)
      .addDropdown((item) =>
        item
          .addOptions(SORT_ORDER)
          .setValue(settings.sortOrder)
          .onChange(async (value) => {
            settings.sortOrder = value;
            await this._plugin.saveData(this._plugin.settings);
            refresh();
          }),
      )
      .then((settingEl) => {
        const setDefaultValue = () =>
          (settings.sortOrder = DEFAULT_SETTINGS[settingType].sortOrder);
        this.addResetButton(settingEl, setDefaultValue, refresh);
      });
  }

  private isDuplicateChars(chars: string[]): boolean {
    return chars.some((char, idx) => chars.slice(idx + 1).includes(char));
  }

  private async handleShortcutKeyup(
    ev: KeyboardEvent,
    text: TextComponent,
    btnName: 'allBtn' | 'backBtn',
    refresh: () => void,
  ): Promise<void> {
    this._plugin.settings[SETTING_TYPE.openBookmarksCaller][btnName] = ev.key;
    text.setValue(ev.key);
    await this._plugin.saveSettings();
    text.inputEl.removeEventListener('blur', refresh);
    refresh();
  }

  private async handleShortcutBlur(
    text: TextComponent,
    btnName: 'allBtn' | 'backBtn',
    orgKey: string,
    usedKeys: string[],
  ): Promise<void> {
    if (this.isDuplicateChars([text.inputEl.value, ...usedKeys])) {
      this._plugin.settings[SETTING_TYPE.openBookmarksCaller][btnName] = orgKey;
      await this._plugin.saveSettings();
      new Notice(DUPLICATE_MESSAGE, NOTION_DURATION_MS);
    }
    if (RESERVED_KEYS.includes(text.inputEl.value)) {
      this._plugin.settings[SETTING_TYPE.openBookmarksCaller][btnName] = orgKey;
      await this._plugin.saveSettings();
      new Notice(RESERVED_KEYS_MESSAGE, NOTION_DURATION_MS);
    }
  }

  private onClickShortcutKeyEdit(
    text: TextComponent,
    btnName: 'allBtn' | 'backBtn',
    usedKeys: string[],
    refresh: () => void,
  ): void {
    text.inputEl.value = 'Press shortcut key';
    text.inputEl.addClass('class', 'bc-setting-shortcut-key-edit');
    text.inputEl.focus();
    const orgKey = this._plugin.settings[SETTING_TYPE.openBookmarksCaller][btnName];

    text.inputEl.addEventListener('keyup', (ev: KeyboardEvent) => {
      void this.handleShortcutKeyup(ev, text, btnName, refresh);
    });

    text.inputEl.addEventListener('blur', refresh);

    text.inputEl.addEventListener('blur', () => {
      void this.handleShortcutBlur(text, btnName, orgKey, usedKeys);
    });
  }

  private addResetButton(
    settingEl: Setting,
    setDefaultValue: () => void,
    refresh: () => void,
  ): void {
    settingEl.addExtraButton((button) =>
      button
        .setIcon('reset')
        .setTooltip('Reset to default')
        .onClick(async () => {
          setDefaultValue();
          await this._plugin.saveSettings();
          refresh();
        }),
    );
  }
}
