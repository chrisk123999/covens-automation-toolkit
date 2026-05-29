import MedkitApp from './base.mjs';

export default class SceneMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-scene'
    };

    static PARTS = MedkitApp.SCENE_LEVEL_PARTS;

    static TABS = MedkitApp.SCENE_LEVEL_TABS;

    _getMassApplyItems() {
        return MedkitApp._massApplyItemsFromScene(this.document);
    }
}
