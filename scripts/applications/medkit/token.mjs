import MedkitApp from './base.mjs';

export default class TokenMedkit extends MedkitApp {
    static DOCUMENT_TYPE = 'token';
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-token'
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        ...MedkitApp.GENERIC_PART,
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                MedkitApp.GENERIC_TAB,
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
            ],
            initial: 'embedded'
        }
    };
}
