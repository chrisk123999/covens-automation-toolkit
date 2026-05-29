import MedkitApp from './base.mjs';

export default class CompendiumMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-compendium',
        actions: {
            massApply: CompendiumMedkit.#massApply
        }
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        automations: {template: 'modules/cat/templates/medkit/shared/mass-apply-tab.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [ {id: 'automations', icon: 'fa-solid fa-download', label: 'CAT.MEDKIT.TABS.Automations'} ],
            initial: 'automations'
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.buttons = [ {type: 'button', action: 'cancel', label: 'CAT.MEDKIT.Footer.Close', name: 'close', icon: 'fa-solid fa-xmark'} ];
        return context;
    }

    /** @this {CompendiumMedkit} */
    static async #massApply() {
        // TODO: needs a pack-aware updater.
        ui.notifications.warn(_loc('CAT.MEDKIT.MassApply.CompendiumPending'));
    }
}
