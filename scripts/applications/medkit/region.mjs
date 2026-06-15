import MedkitApp from './base.mjs';
const {fields} = foundry.data;

// TODO: replace hardcoded fields when a region doc-props registry/setter util lands.
export default class RegionMedkit extends MedkitApp {
    static DOCUMENT_TYPE = 'region';
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-region'
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        docprops: {template: 'modules/cat/templates/medkit/region/docprops.hbs'},
        ...MedkitApp.GENERIC_PART,
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'docprops', icon: 'fa-solid fa-sliders', label: 'CAT.MEDKIT.TABS.DocProps'},
                MedkitApp.GENERIC_TAB,
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
            ],
            initial: 'docprops'
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.fields = {
            magicalDarkness: new fields.BooleanField({label: _loc('CAT.MEDKIT.Region.MagicalDarkness.Label')}),
            obscured: new fields.BooleanField({label: _loc('CAT.MEDKIT.Region.Obscured.Label')})
        };
        const flags = this._getFlags();
        context.magicalDarkness = flags.visibility?.magicalDarkness ?? false;
        context.obscured = flags.visibility?.obscured ?? false;
        this._prepareIdentifierField(context);
        return context;
    }
}
