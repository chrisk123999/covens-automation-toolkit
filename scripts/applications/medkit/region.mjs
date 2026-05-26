import MedkitApp from './base.mjs';

// TODO per plan board: Embedded, Macros, Doc Props (Magical Darkness, Obscured).
export default class RegionMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-region'
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
