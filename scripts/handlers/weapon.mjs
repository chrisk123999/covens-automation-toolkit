import {constants, Logging} from '../lib/_module.mjs';
import {actorUtils, automationUtils, combatUtils, dialogUtils, documentUtils, effectUtils, itemUtils, rollUtils, tokenUtils, workflowUtils} from '../utilities/_module.mjs';
function register() {
    CONFIG.DND5E.weaponTypes.unarmed = _loc('DND5E.ATTACK.Classification.Unarmed');
    CONFIG.DND5E.weaponTypeMap.unarmed = 'melee';
}
function getAbility(workflow) {
    return workflow.actor.system.abilities[workflow.attackRoll.options?.ability ?? workflow.activity?.ability];
}
function getModifier(workflow) {
    return getAbility(workflow)?.mod ?? 0;
}
function effectData(workflow, key, changes, {expiry, specialDuration} = {}) {
    return documentUtils.getBaseEffectData(workflow.item, {name: itemUtils.getMasteryLabel(key), img: workflow.item.img, origin: workflow.item.uuid, identifier: 'mastery' + key.capitalize(), changes, duration: {value: null, units: 'seconds', expiry}, specialDuration});
}
async function cleave({workflow, hit: targets}) {
    if (!targets.length || workflow.activity?.attack?.type?.value !== 'melee' || workflowUtils.getWorkflowProperty(workflow, 'masteryCleave')) return;
    const token = workflow.token.document;
    const combatData = tokenUtils.getCombatData(token);
    const stamps = workflow.actor.flags.cat?.weaponMastery?.cleave ?? [];
    if (combatUtils.isStampedThisTurn(stamps, token.id, combatData)) return;
    const first = targets[0].document;
    const reach = workflow.item.system.range?.reach ?? 5;
    const options = tokenUtils.findNearby(first, 5, {disposition: 'all', includeIncapacitated: false}).filter(nearby => nearby.id !== token.id && nearby.actor && tokenUtils.isEnemy(token, nearby) && tokenUtils.getDistance(token, nearby) <= reach);
    if (!options.length) return;
    const selection = await dialogUtils.selectTargetDialog(itemUtils.getMasteryLabel('cleave'), _loc('CAT.WeaponMastery.CleavePrompt'), options, {buttons: 'okCancel'});
    const second = selection?.result;
    if (!second) return;
    if (combatData.inCombat) await documentUtils.setFlag(workflow.actor, 'cat', 'weaponMastery.cleave', combatUtils.addTurnStamp(stamps, token.id, combatData));
    const cleaveOptions = {};
    workflowUtils.setWorkflowProperty(cleaveOptions, 'masteryCleave', true);
    await workflowUtils.syntheticActivityRoll(workflow.activity, [second], {options: cleaveOptions, consumeUsage: false, consumeResources: false});
}
async function graze({workflow, missed: targets}) {
    if (!targets.length) return;
    const modifier = getModifier(workflow);
    const damageType = workflow.item.system.damage?.base?.types?.first();
    if (modifier <= 0 || !damageType) return;
    await workflowUtils.applyDamage(targets.map(token => token.document), modifier, damageType);
}
async function push({workflow, hit: targets}) {
    const scene = workflow.token.document.parent;
    for (const token of targets) {
        if (actorUtils.getSize(token.actor) > CONFIG.DND5E.actorSizes.lg.numerical) continue;
        const buttons = [[_loc('CAT.WeaponMastery.NoPush'), 0], ...[5, 10].map(distance => [dnd5e.utils.formatLength(distance, scene.grid.units), distance])];
        const distance = Number(await dialogUtils.buttonDialog(itemUtils.getMasteryLabel('push'), _loc('CAT.WeaponMastery.PushPrompt', {target: token.name}), buttons));
        if (distance) await tokenUtils.slideToken(token.document, {sourceToken: workflow.token.document, distance});
    }
}
async function sap({workflow, hit: targets}) {
    const data = effectData(workflow, 'sap', [{key: 'flags.midi-qol.disadvantage.attack.all', type: 'override', value: '1', phase: 'initial', priority: 20}], {expiry: 'sourceStart', specialDuration: ['1Attack']});
    await Promise.all(targets.map(token => effectUtils.createEffects(token.actor, [data])));
}
async function slow({workflow, hit: targets}) {
    const affected = targets.filter(token => workflowUtils.getDamageDealt(workflow, token) > 0 && !actorUtils.getEffectByIdentifier(token.actor, 'masterySlow'));
    if (!affected.length) return;
    const data = effectData(workflow, 'slow', [{key: 'system.attributes.movement.bonus', type: 'add', value: '-10', phase: 'initial', priority: 20}], {expiry: 'sourceStart'});
    await Promise.all(affected.map(token => effectUtils.createEffects(token.actor, [data])));
}
async function topple({workflow, hit: targets}) {
    const dc = getAbility(workflow)?.dc;
    await Promise.all(targets.map(async token => {
        const roll = await rollUtils.requestRoll(token.actor, 'save', 'con', {rollDC: dc});
        if (roll && roll.total < dc) await actorUtils.applyConditions(token.actor, ['prone']);
    }));
}
async function vex({workflow, hit: targets}) {
    const affected = targets.filter(token => workflowUtils.getDamageDealt(workflow, token) > 0);
    if (!affected.length) return;
    const datas = affected.map(token => {
        const data = effectData(workflow, 'vex', [{key: 'flags.midi-qol.advantage.attack.all', type: 'override', value: 'targetUuid === "' + token.document.uuid + '"', phase: 'initial', priority: 20}], {expiry: 'sourceEnd'});
        data.flags.cat.weaponMastery = {target: token.document.uuid};
        return data;
    });
    await effectUtils.createEffects(workflow.actor, datas);
}
const registeredMasteries = new Map();
const customMasteries = new Map();
function localizedLabel({mastery, label}) {
    return _loc(label ?? mastery);
}
function registerMastery(data, {custom = false} = {}) {
    const {mastery, reference = CONFIG.DND5E.weaponMasteries[mastery]?.reference} = data;
    const localized = localizedLabel(data);
    CONFIG.DND5E.weaponMasteries[mastery] = {label: localized, reference};
    (custom ? customMasteries : registeredMasteries).set(mastery, data);
    const passes = Object.fromEntries(constants.triggerTypes.filter(type => data[type]).map(type => [type, data[type]]));
    const generic = data.genericConfig ? {generic: true, label: localized, genericConfig: data.genericConfig, documents: ['item']} : {};
    if (Object.keys(passes).length || data.genericConfig) constants.macros.registerFnMacro({source: 'mastery', identifier: mastery, rules: 'all', ...passes, ...generic}, custom);
}
function clearCustomMasteries() {
    for (const mastery of customMasteries.keys()) {
        const registered = registeredMasteries.get(mastery);
        if (registered) CONFIG.DND5E.weaponMasteries[mastery] = {label: localizedLabel(registered), reference: registered.reference};
        else delete CONFIG.DND5E.weaponMasteries[mastery];
    }
    customMasteries.clear();
}
const builtInMasteries = {cleave, graze, push, sap, slow, topple, vex};
async function apply(workflow, mastery, hit, missed) {
    if (builtInMasteries[mastery]) {
        await builtInMasteries[mastery]({workflow, hit, missed});
        return;
    }
    try {
        await (customMasteries.get(mastery) ?? registeredMasteries.get(mastery))?.macro?.({workflow, hit, missed});
    } catch (error) {
        Logging.logMacroException({macroClass: {identifier: mastery, source: 'customMastery', rules: 'all'}}, error);
    }
}
function getMasteries(workflow) {
    if (workflow.item?.type !== 'weapon' || !workflow.attackRoll || !workflow.token || !actorUtils.isMasteryEnabled(workflow.actor)) return;
    const chosen = workflow.attackRoll.options?.mastery ?? (workflow.actor.type === 'character' ? undefined : workflow.item.system.mastery);
    return chosen && itemUtils.canUseMastery(workflow.item, chosen) ? [chosen] : [];
}
async function attackRollComplete(workflow) {
    if (!workflow.actor || !workflow.attackRoll) return;
    const targets = Array.from(workflow.targets, token => token.document.uuid);
    const spent = actorUtils.getEffectByIdentifier(workflow.actor, 'masteryVex', {multiple: true}).filter(effect => targets.includes(effect.flags.cat.weaponMastery?.target));
    await Promise.all(spent.map(effect => documentUtils.deleteDocument(effect)));
}
async function damageRollComplete(workflow) {
    if (!workflowUtils.getWorkflowProperty(workflow, 'masteryCleave') || !workflow.damageRolls?.length) return;
    const modifier = getModifier(workflow);
    if (modifier <= 0) return;
    const [first, ...rest] = workflow.damageRolls;
    await workflow.setDamageRolls([await rollUtils.addToRoll(first, String(-modifier)), ...rest]);
}
async function rollFinished(workflow) {
    const masteries = getMasteries(workflow);
    if (!masteries) return;
    const hit = Array.from(workflow.hitTargets ?? []).filter(token => token.actor);
    const missed = Array.from(workflow.targets ?? []).filter(token => token.actor && !workflow.hitTargets.has(token));
    await automationUtils.calledEvent('weaponMastery', workflow.actor, {canOverlap: true, data: {workflow, masteries, hit, missed}});
    for (const mastery of new Set(masteries)) await apply(workflow, mastery, hit, missed);
}
export default {
    register,
    registerMastery,
    clearCustomMasteries,
    attackRollComplete,
    damageRollComplete,
    rollFinished
};
