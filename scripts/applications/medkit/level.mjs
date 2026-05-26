import MedkitApp from './base.mjs';

// v14 scene-level documents.
export default class LevelMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-level'
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

    // TODO: confirm v14 Level scope. Likely inherits from parent scene; for now mirror Scene mass-apply.
    _getMassApplyItems() {
        const scene = this.document?.parent ?? this.document;
        const items = [];
        for (const token of scene?.tokens ?? []) {
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
