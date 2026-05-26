import MedkitApp from './base.mjs';

// TODO per plan board: Embedded, Macros.
export default class LevelMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-level'
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        info: {template: 'modules/cat/templates/medkit/shared/stub.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'info', icon: 'fa-solid fa-circle-info', label: 'CAT.MEDKIT.TABS.Automation'}
            ],
            initial: 'info'
        }
    };
}
