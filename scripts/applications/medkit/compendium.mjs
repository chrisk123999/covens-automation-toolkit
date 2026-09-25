import MedkitApp from './base.mjs';
import {dialogUtils, genericUtils} from '../../utilities/_module.mjs';

export default class CompendiumMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-compendium'
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

    get footerButtons() {
        return [ {type: 'button', action: 'cancel', label: 'CAT.MEDKIT.Footer.Close', name: 'close', icon: 'fa-solid fa-xmark'} ];
    }

    _getMassApplyItems() {
        return this.document.getDocuments();
    }

    async _canMassApply() {
        const pack = this.document;
        if (pack.locked) {
            genericUtils.notify('CAT.MEDKIT.MassApply.PackLocked', {type: 'warn', format: {pack: pack.metadata.label}});
            return false;
        }
        if (pack.metadata.packageType === 'world') return true;
        return !!await dialogUtils.confirm(
            _loc('CAT.MEDKIT.MassApply.PackTitle'),
            _loc('CAT.MEDKIT.MassApply.PackWarning', {pack: pack.metadata.label, package: pack.metadata.packageName})
        );
    }
}
