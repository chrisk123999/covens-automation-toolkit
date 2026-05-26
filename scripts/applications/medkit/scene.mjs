import MedkitApp from './base.mjs';

export default class SceneMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-scene'
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        automations: {template: 'modules/cat/templates/medkit/shared/mass-apply-tab.hbs'},
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'automations', icon: 'fa-solid fa-download', label: 'CAT.MEDKIT.TABS.Automations'},
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
            ],
            initial: 'automations'
        }
    };

    _getMassApplyItems() {
        const items = [];
        for (const token of this.document.tokens ?? []) {
            const actor = token.actor;
            if (!actor) continue;
            for (const item of actor.items) items.push(item);
        }
        return items;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const macroData = this._prepareRegisteredMacros();
        context.macroRows = macroData.rows;
        context.macroSources = macroData.sources;
        return context;
    }
}
