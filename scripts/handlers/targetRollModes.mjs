import {activityUtils, effectUtils, genericUtils, workflowUtils} from '../utilities/_module.mjs';
const buttons = {
    '1': 'advantage',
    '0': 'normal',
    '-1': 'disadvantage'
};
const applyMode = {
    adv: (tracker, id, label) => tracker.advantage.add(id, label),
    dis: (tracker, id, label) => tracker.disadvantage.add(id, label),
    succeed: (tracker, id, label) => tracker.modifiers.succeed(id, label),
    fail: (tracker, id, label) => tracker.modifiers.fail(id, label)
};
const rollModeFlags = [
    {key: 'CR', id: 'condition-resistance', mode: 'adv', targets: c => c.conditions},
    {key: 'CV', id: 'condition-vulnerability', mode: 'dis', targets: c => c.conditions},
    {key: 'SR', id: 'school-resistance', mode: 'adv', targets: c => [c.school]},
    {key: 'SV', id: 'school-vulnerability', mode: 'dis', targets: c => [c.school]},
    {key: 'FR', id: 'feature-resistance', mode: 'adv', targets: c => [c.identifier]},
    {key: 'FV', id: 'feature-vulnerability', mode: 'dis', targets: c => [c.identifier]},
    {key: 'FI', id: 'feature-immunity', mode: 'succeed', targets: c => [c.identifier]},
    {key: 'FF', id: 'feature-failure', mode: 'fail', targets: c => [c.identifier]}
];
export default async function targetRollModes(target, workflow, saveDetails) {
    if (!target.actor) return;
    let activity = workflow.activity;
    const overTimeEffectUuid = workflow.workflowOptions?.overTimeEffectUuid;
    if (overTimeEffectUuid) {
        const effect = await fromUuid(overTimeEffectUuid);
        activity = await effectUtils.getOriginActivity(effect);
    }
    if (activity) {
        workflowUtils.setWorkflowProperty(workflow, 'activityUuid', activity.uuid);
        workflowUtils.addMacroConditions(workflow, activityUtils.getConditions(activity));
    }
    const context = {conditions: workflowUtils.getMacroConditions(workflow), identifier: activity?.identifier, school: activity?.item.type === 'spell' ? activity.item.system.school : undefined};
    let abilities = [];
    switch (saveDetails.rollType) {
        case 'check':
        case 'save': abilities = saveDetails.rollAbilities; break;
        case 'skill': 
            saveDetails.rollAbilities = [];
            abilities = saveDetails.rollSkills;
            break;
        case 'tool': 
            saveDetails.rollAbilities = [];
            abilities = saveDetails.rollTools;
            break;
    }
    if (saveDetails.modifierTracker && abilities.length) setChoiceTracker(saveDetails, abilities[0], saveDetails.modifierTracker);
    const otherModifiers = Object.values(workflowUtils.getWorkflowProperty(workflow, 'rollModifiers')?.[target.id] ?? {});
    // A check activity's own ability (Strength (Stealth)) and a tool item's ability override the defaults, as midi rolls them.
    const checkAbility = activity?.type === 'check' ? activity.check.ability : undefined;
    const toolAbility = activity?.item?.type === 'tool' ? activity.item.system.ability : undefined;
    for (const ability of abilities) {
        const tracker = saveDetails.advantageByChoice?.[ability]?.tracker ?? new MidiQOL.RollModifierTracker();
        let testAbility = ability;
        if (saveDetails.rollType === 'skill') testAbility = checkAbility || target.actor.system.skills[ability].ability;
        if (saveDetails.rollType === 'tool') testAbility = checkAbility || toolAbility || target.actor.system.tools[ability]?.ability || CONFIG.DND5E.tools[ability]?.ability;
        applyFlags(target.actor, tracker, testAbility, context);
        for (const entry of otherModifiers) applyMode[entry?.type]?.(tracker, entry.identifier, entry.display);
        setChoiceTracker(saveDetails, ability, tracker);
    }
}
function setChoiceTracker(saveDetails, ability, tracker) {
    genericUtils.setProperty(saveDetails, 'advantageByChoice.' + ability, {
        tracker,
        hasAdvantage: !!tracker.hasAdvantage,
        hasDisadvantage: !!tracker.hasDisadvantage,
        defaultButton: buttons[tracker.advantageMode]
    });
}
function flagMatches(actor, key, target, ability) {
    const value = target && actor.flags.cat?.[key]?.[target];
    if (!value) return false;
    const types = String(value).toLowerCase().split(',').map(type => type.trim());
    return types.includes('1') || types.includes('true') || types.includes(ability);
}
function applyFlags(actor, tracker, ability, context) {
    for (const {key, id, mode, targets} of rollModeFlags) {
        const match = [...targets(context)].find(target => flagMatches(actor, key, target, ability));
        if (match) applyMode[mode](tracker, id, _loc(`CAT.DAE.${key}.Name`, {condition: CONFIG.DND5E.conditionTypes[match]?.name, school: CONFIG.DND5E.spellSchools[match]?.label}));
    }
}
