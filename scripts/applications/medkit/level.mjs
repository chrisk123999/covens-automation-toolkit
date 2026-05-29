import MedkitApp from './base.mjs';

// v14 scene-level documents.
export default class LevelMedkit extends MedkitApp {
    static DOCUMENT_TYPE = 'level';
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-level'
    };

    static PARTS = MedkitApp.SCENE_LEVEL_PARTS;

    static TABS = MedkitApp.SCENE_LEVEL_TABS;

    // TODO: confirm v14 Level scope.
    _getMassApplyItems() {
        return MedkitApp._massApplyItemsFromScene(this.document.parent);
    }
}
