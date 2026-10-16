import MedkitApp from './base.mjs';
import DialogApp from '../dialog.mjs';
import {constants} from '../../lib/_module.mjs';
import {compendiumUtils, dialogUtils} from '../../utilities/_module.mjs';

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
            const destination = await this.#copyLockedPack(pack);
            if (destination) {
                const medkit = new CompendiumMedkit({document: destination});
                await medkit.render({force: true});
                this.close();
                medkit.massApply();
            }
            return false;
        }
        if (pack.metadata.packageType === 'world') return true;
        return !!await dialogUtils.confirm(
            _loc('CAT.MEDKIT.MassApply.PackTitle'),
            _loc('CAT.MEDKIT.MassApply.PackWarning', {pack: pack.metadata.label, package: pack.metadata.packageName})
        );
    }

    /**
     * Copy a locked pack into a new or existing unlocked pack of the same document type.
     * @param {CompendiumCollection} pack Locked source pack.
     * @returns {Promise<CompendiumCollection|undefined>} The pack the documents were copied into.
     */
    async #copyLockedPack(pack) {
        const destinations = game.packs.filter(other => other.documentName === pack.documentName && !other.locked && other !== pack && !constants.automations.moduleRegistrations.has(other.metadata.packageName))
            .map(other => ({label: compendiumUtils.getPackLabel(other), value: other.collection}))
            .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
        const toggleRows = ({input, getInputById}) => {
            getInputById('g1i0').hidden = input.value !== 'new';
            getInputById('g2i0').hidden = input.value === 'new';
            return true;
        };
        const selection = await DialogApp.dialog('CAT.MEDKIT.MassApply.PackLockedTitle', _loc('CAT.MEDKIT.MassApply.PackLocked', {pack: pack.metadata.label}), [
            ['selectOption', [{label: _loc('CAT.MEDKIT.MassApply.Destination'), name: 'destination', options: {currentValue: 'new', onchange: toggleRows, options: [{label: _loc('CAT.MEDKIT.MassApply.NewCompendium'), value: 'new'}, ...destinations]}}]],
            ['text', [{label: _loc('CAT.Generic.Name'), name: 'label', options: {currentValue: _loc('DOCUMENT.CopyOf', {name: pack.title})}}]],
            ['selectOption', [{label: _loc('CAT.MEDKIT.MassApply.Replace'), name: 'mode', options: {currentValue: 'matching', hidden: true, options: [
                {label: _loc('CAT.MEDKIT.MassApply.Modes.Matching'), value: 'matching'},
                {label: _loc('CAT.MEDKIT.MassApply.Modes.All'), value: 'all'}
            ]}}]]
        ], 'okCancel', {id: 'cat-pack-destination', width: 480});
        if (!selection?.buttons) return;
        if (selection.destination === 'new') return await pack.duplicateCompendium({label: selection.label});
        const destination = game.packs.get(selection.destination);
        if (!destination) return;
        const mode = selection.mode;
        const sourceNames = new Set((await pack.getIndex()).map(entry => entry.name));
        const destinationIndex = await destination.getIndex();
        const replaced = destinationIndex.filter(entry => mode === 'all' || sourceNames.has(entry.name)).map(entry => entry._id);
        const documentClass = destination.documentClass;
        if (replaced.length) await documentClass.deleteDocuments(replaced, {pack: destination.collection});
        const folders = pack.folders.filter(folder => !destination.folders.has(folder.id)).map(folder => folder.toObject());
        if (folders.length) await Folder.createDocuments(folders, {pack: destination.collection, keepId: true});
        const documents = await pack.getDocuments();
        await documentClass.createDocuments(documents.map(document => document.toObject()), {pack: destination.collection});
        return destination;
    }
}
