import {MenuApp} from './_module.mjs';
export default class SettingsMenu extends MenuApp {
    #catSettings = [];
    #menuSettings;
    #save = false;
    constructor(key) {
        let title = 'CAT.Settings.' + key.titleCase() + '.Name';
        let inputs = [];
        let buttons = 'okCancel';
        let config = {id: 'cat-settings-menu-' + key};
        super([title, inputs, buttons, config]);
        this.key = key;
        game.settings.settings.forEach(s => s.namespace.includes('cat') ? this.#catSettings.push(s) : '');
        this.#menuSettings = this.#catSettings.filter(s => s.menu === key);
    }
    #formatSetting(setting) {
        if (setting.key === 'additionalCompendiums') return null;
        let entry = {
            name: setting.key,
            label: setting.name,
            hint: setting.hint,
            default: setting.default,
            value: game.settings.get('cat', setting.key)
        };
        if (setting.key === 'automationSources') entry.type = 'priority';
        else if (setting.choices) {
            entry.type = 'selectOption';
            entry.options = setting.choices;
        } else if (setting.type === Boolean) entry.type = 'checkbox';
        return entry;
    }
    async _prepareContext(options) {
        this.inputs = this.#menuSettings.map(s => this.#formatSetting(s)).filter(Boolean);
        return await super._prepareContext(options);
    }
    submit(target) {
        if (target === 'true') this.#save = true;
    }
    close(options) {
        if (this.#save) {
            this.#menuSettings.forEach(s => {
                if (s.key in this.data) game.settings.set('cat', s.key, this.data[s.key]);
            });
        }
        super.close(options);
    }
}