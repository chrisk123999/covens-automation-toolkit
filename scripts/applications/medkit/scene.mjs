import MedkitApp from './base.mjs';

export default class SceneMedkit extends MedkitApp {
    static DOCUMENT_TYPE = 'scene';
    static DATA_CHECK = true;

    static DEFAULT_OPTIONS = {
        id: 'medkit-window-scene'
    };

    static PARTS = MedkitApp.SCENE_LEVEL_PARTS;

    static TABS = MedkitApp.SCENE_LEVEL_TABS;

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.auraField = new foundry.data.fields.BooleanField({label: _loc('CAT.MEDKIT.Scene.DisableAuras.Label')});
        context.disableAuras = this._getFlags().disableAuras ?? false;
        return context;
    }

    _getMassApplyItems() {
        return MedkitApp._massApplyItemsFromScene(this.document);
    }
}
