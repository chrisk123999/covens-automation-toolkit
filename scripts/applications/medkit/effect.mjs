import MedkitApp from './base.mjs';
const {fields} = foundry.data;

const SPECIAL_DURATION_GROUPS = {
    Workflow: ['endOfWorkflow', 'forceSave', 'attackMissed', 'damagedByAlly', 'damagedByEnemy', 'hitByAnotherCreature', 'attackedByAnotherCreature', 'hitBySource', 'attackedBySource'],
    Movement: ['moveFinished', 'zeroSpeed'],
    HitPoints: ['tempHP', 'tempMaxHP']
};

export default class EffectMedkit extends MedkitApp {
    static DOCUMENT_TYPE = 'activeeffect';
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-effect'
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        docprops: {template: 'modules/cat/templates/medkit/effect/docprops.hbs'},
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
        const flags = this._getFlags();
        context.fields = {
            noAnimation: new fields.BooleanField({label: _loc('CAT.MEDKIT.Effect.NoAnimation.Label')})
        };
        context.noAnimation = flags.noAnimation ?? false;
        context.animationCreate = this._animationFlagOption({key: 'effect-animation-create', label: _loc('CAT.MEDKIT.Effect.AnimationCreate.Label'), tooltip: _loc('CAT.MEDKIT.Effect.AnimationCreate.Tooltip'), path: 'animation.create', macroKey: 'create'});
        context.animationDelete = this._animationFlagOption({key: 'effect-animation-delete', label: _loc('CAT.MEDKIT.Effect.AnimationDelete.Label'), tooltip: _loc('CAT.MEDKIT.Effect.AnimationDelete.Tooltip'), path: 'animation.delete', macroKey: 'delete'});

        const pickedConditions = new Set(flags.conditions ?? []);
        context.conditionChoices = CONFIG.statusEffects
            .map(s => ({value: s.id, label: _loc(s.name ?? s.label ?? s.id)}))
            .sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}))
            .map(c => ({...c, selected: pickedConditions.has(c.value)}));

        const pickedDurations = new Set(flags.specialDuration ?? []);
        const sortChoices = choices => choices
            .sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}))
            .map(c => ({...c, selected: pickedDurations.has(c.value)}));
        const groupLabel = key => _loc(`CAT.MEDKIT.Effect.SpecialDurations.Groups.${key}`);
        const prefixedGroup = (key, options) => {
            const label = groupLabel(key);
            return {label, options: sortChoices(options.map(o => ({value: o.value, label: `${label}: ${o.label}`})))};
        };
        const statusChoices = suffix => CONFIG.statusEffects.map(s => ({value: s.id + suffix, label: _loc(s.name ?? s.label ?? s.id)}));
        const toolChoices = suffix => Object.entries(CONFIG.DND5E.tools).map(([key, tool]) => ({value: key + suffix, label: fromUuidSync(tool.id)?.name ?? key}));
        context.specialDurationGroups = [
            ...Object.entries(SPECIAL_DURATION_GROUPS).map(([key, list]) => ({
                label: groupLabel(key),
                options: sortChoices(list.map(k => ({value: k, label: _loc(`CAT.MEDKIT.Effect.SpecialDurations.${k}`)})))
            })),
            prefixedGroup('ConditionAdded', statusChoices('')),
            prefixedGroup('ConditionRemoved', statusChoices('Removed')),
            prefixedGroup('Equipped', Object.entries(CONFIG.DND5E.armorTypes).map(([key, label]) => ({value: key, label}))),
            prefixedGroup('Unequipped', Object.entries(CONFIG.DND5E.armorTypes).map(([key, label]) => ({value: key + 'Removed', label}))),
            prefixedGroup('ToolRolled', toolChoices('')),
            prefixedGroup('ToolFailed', toolChoices('Fail')),
            prefixedGroup('ToolSucceeded', toolChoices('Succeed'))
        ];

        this._prepareIdentifierField(context);
        return context;
    }
}
