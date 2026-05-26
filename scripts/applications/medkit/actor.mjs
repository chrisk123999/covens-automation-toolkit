import MedkitApp from './base.mjs';

// TODO per plan board: Embedded, Macros, Doc Props (Condition Resistance/Vulnerability), region rollups, NPC name field.
export default class ActorMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-actor'
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
