import {compendiumUtils} from '../utilities/_module.mjs';
import {MenuApp} from './_module.mjs';
export default class SettingsMenu extends MenuApp {
    #menuSettings;
    #save = false;
    static DEFAULT_OPTIONS = {
        actions: {openSubMenu: SettingsMenu.#openSubMenu}
    };
    constructor(key, {namespace = 'cat', langPrefix = 'CAT', subMenus = []} = {}) {
        super([langPrefix + '.Settings.' + key.capitalize() + '.Name', [], 'okCancel', {id: namespace + '-settings-menu-' + key}]);
        this.key = key;
        this.namespace = namespace;
        this.langPrefix = langPrefix;
        this.subMenus = subMenus;
        this.#menuSettings = game.settings.settings.values().filter(s => s.namespace === namespace && s.menu === key && (s.scope !== 'world' || game.user.isGM)).toArray();
    }
    #formatSetting(setting) {
        let entry = {
            name: setting.key,
            label: setting.name,
            hint: setting.hint,
            default: setting.default,
            value: game.settings.get(this.namespace, setting.key)
        };
        const packTypes = {
            monsterCompendiums: 'Actor',
            itemCompendiums: 'Item',
            spellCompendiums: 'Item',
            macroCompendiums: 'Macro'
        };
        const packFilters = {
            itemCompendiums: 'items',
            spellCompendiums: 'spells'
        };
        if (setting.key === 'automationSources') entry.type = 'priority';
        else if (packTypes[setting.key]) {
            entry.type = 'priority';
            entry.packType = packTypes[setting.key];
            if (packFilters[setting.key]) entry.packFilter = packFilters[setting.key];
        } else if (setting.key === 'manualRollsUsers') entry.type = 'users';
        else if (setting.packSelect) {
            const {type, packageType} = setting.packSelect;
            const packs = game.packs.filter(pack => pack.metadata.type === type && (!packageType || pack.metadata.packageType === packageType));
            entry.type = 'selectOption';
            entry.options = {'': 'None', ...Object.fromEntries(packs.map(pack => [pack.metadata.id, compendiumUtils.getPackLabel(pack)]))};
        }
        else if (setting.choices) {
            entry.type = setting.type === Array ? 'multiSelect' : 'selectOption';
            entry.options = typeof setting.choices === 'function' ? setting.choices() : setting.choices;
        } else if (setting.type === Boolean) entry.type = 'checkbox';
        else if (setting.type === Number) entry.type = 'number';
        return entry;
    }
    #formatSubMenu(key) {
        const prefix = this.langPrefix + '.Settings.' + key.capitalize();
        return {type: 'subMenu', name: key, label: prefix + '.Name', hint: prefix + '.Hint', buttonLabel: prefix + '.Label'};
    }
    /** @this {SettingsMenu} */
    static #openSubMenu(event, target) {
        new SettingsMenu(target.dataset.menu, {namespace: this.namespace, langPrefix: this.langPrefix}).render({force: true});
    }
    async _prepareContext(options) {
        this.inputs = [...this.#menuSettings.map(s => this.#formatSetting(s)).filter(Boolean), ...this.subMenus.map(key => this.#formatSubMenu(key))];
        const context = await super._prepareContext(options);
        if (!context.tabbed) return context;
        context.tab = options?.tab ?? this.inputs[0]?.name;
        return context;
    }
    submit(target) {
        if (target === 'true') this.#save = true;
    }
    close(options) {
        if (this.#save) {
            this.#menuSettings.forEach(s => {
                if (s.key in this.data) game.settings.set(this.namespace, s.key, this.data[s.key]);
            });
        }
        super.close(options);
    }
}
