import MedkitApp from './base.mjs';

// TODO per plan board: Configuration (maybe), Generic (maybe), Embedded, Macros + Doc Props (Hidden, Other Abilities) + region rollups.
export default class ActivityMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-activity'
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
