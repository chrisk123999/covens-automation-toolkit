import MedkitApp from './base.mjs';
const {fields} = foundry.data;

// Fixed special-duration triggers enumerated from mechanics/specialDuration.mjs.
// TODO: dynamic triggers?
const SPECIAL_DURATIONS = [
    'endOfWorkflow',
    'forceSave',
    'damagedByAlly',
    'damagedByEnemy',
    'hitByAnotherCreature',
    'attackedByAnotherCreature',
    'hitBySource',
    'attackedBySource',
    'moveFinished',
    'zeroSpeed',
    'tempHP',
    'tempMaxHP'
];

export default class EffectMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-effect'
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        docprops: {template: 'modules/cat/templates/medkit/effect/docprops.hbs'},
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'docprops', icon: 'fa-solid fa-sliders', label: 'CAT.MEDKIT.TABS.DocProps'},
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
            ],
            initial: 'docprops'
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const flags = this._getFlags();
        context.fields = {
            noAnimation: new fields.BooleanField({label: _loc('CAT.MEDKIT.Effect.NoAnimation.Label')})
        };
        context.noAnimation = flags.noAnimation ?? false;

        const pickedConditions = new Set(flags.conditions ?? []);
        context.conditionChoices = CONFIG.statusEffects
            .map(s => ({value: s.id, label: _loc(s.name ?? s.label ?? s.id)}))
            .sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}))
            .map(c => ({...c, selected: pickedConditions.has(c.value)}));

        const pickedDurations = new Set(flags.specialDuration ?? []);
        context.specialDurationChoices = SPECIAL_DURATIONS
            .map(key => ({value: key, label: _loc(`CAT.MEDKIT.Effect.SpecialDurations.${key}`)}))
            .sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}))
            .map(c => ({...c, selected: pickedDurations.has(c.value)}));

        return context;
    }
}
