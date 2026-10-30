import {constants, Logging} from '../lib/_module.mjs';
import {actorUtils, animationUtils, combatUtils, documentUtils, effectUtils, genericUtils, itemUtils, workflowUtils} from '../utilities/_module.mjs';
async function addConditions(effect) {
    const conditions = effect.flags.cat?.conditions;
    if (!conditions) return;
    await genericUtils.sleep(50);
    return await actorUtils.applyConditions(effect.parent, conditions);
}
async function removeConditions(effect) {
    const conditions = effect.flags.cat?.conditions;
    if (!conditions?.length) return;
    const parent = effect.parent;
    const targetEffects = new Map();
    conditions.forEach(id => {
        const cEffect = actorUtils.getEffectByStatusID(parent, id);
        if (cEffect) targetEffects.set(id, cEffect.id);
    });
    if (!targetEffects.size) return;
    const effects = actorUtils.getEffects(parent);
    const cids = new Set();
    effects.forEach(oEffect => {
        if (oEffect.id === effect.id) return;
        const otherConditions = effectUtils.getConditions(oEffect);
        if (otherConditions) {
            otherConditions.forEach(condId => {
                if (targetEffects.get(condId) !== oEffect.id) {
                    cids.add(condId);
                }
            });
        }
    });
    const ids = [];
    conditions.forEach(id => {
        if (!cids.has(id) && targetEffects.has(id)) {
            ids.push(targetEffects.get(id));
        }
    });
    if (ids.length) return await documentUtils.deleteEmbeddedDocuments(parent, 'ActiveEffect', ids);
}
function applyActiveEffect(actor, change, current, delta, changes) {
    if (['flags.cat.CR.', 'flags.cat.CV.', 'flags.cat.FR.', 'flags.cat.FV.', 'flags.cat.FF.', 'flags.cat.FI.'].some(key => change.key.startsWith(key))) {
        const existing = genericUtils.getProperty(actor, change.key);
        const newValue = existing ? String(existing) + ', ' + String(change.value) : String(change.value);
        genericUtils.setProperty(actor, change.key, newValue);
        changes[change.key] = newValue;
        return true; 
    } else if (change.key === 'flags.cat.ignoreDifficultTerrain.tokens') {
        const existing = genericUtils.getProperty(actor, change.key);
        const val = String(change.value).trim().toLowerCase();
        const isTrue = val === 'true' || val === '1';
        const newValue = existing || isTrue;
        genericUtils.setProperty(actor, change.key, newValue);
        changes[change.key] = newValue;
        return true;
    }
}
function noAnimation(effect, options) {
    if (!effect.flags.cat?.noAnimation) return;
    options.animate = false;
}
function effectDescription(effect, updates) {
    if (updates.description || !effect.parent) return;
    const isEnchantment = effect.type === 'enchantment';
    if (effect.transfer && !isEnchantment && effect.parent.documentName !== 'Item') return;
    const fromOrigin = (!effect.transfer || isEnchantment) && effect.origin;
    const item = fromOrigin ? effectUtils.getOriginActivitySync(effect)?.item : effect.parent;
    if (item?.documentName != 'Item') return;
    const mode = game.settings.get('cat', 'effectDescriptionsNPC');
    if (mode && item.actor?.type === 'npc') return;
    const type = game.settings.get('cat', 'effectDescriptions') === 2 ? 'value' : 'chat';
    const description = (item.system.identified ?? true) ? item.system.description[type] : item.system.unidentified.description;
    if (description) effect.updateSource({description});
}
function activityDC(effect) {
    if ((effect.transfer && effect.type !== 'enchantment') || !effect.origin) return;
    const changes = effect.system.changes ?? [];
    if (!changes.some(change => change.key === 'flags.midi-qol.OverTime' && change.value.includes('$activity.dc'))) return;
    const activity = effectUtils.getOriginActivitySync(effect);
    const dc = activity?.save?.dc?.value ?? activity?.item?.system.activities?.find(i => i.save?.dc?.value)?.save.dc.value ?? activity?.actor?.system.abilities[activity.spellcastingAbility]?.dc;
    if (!dc) return Logging.addEntry('WARNING', 'No save DC found for $activity.dc on effect ' + effect.name + ' (origin: ' + effect.origin + ')');
    effect.updateSource({'system.changes': changes.map(change => change.key === 'flags.midi-qol.OverTime' ? {...change, value: change.value.replaceAll('$activity.dc', dc)} : change)});
}
function animationSource(effect) {
    const activity = effectUtils.getOriginActivitySync(effect);
    const actor = activity?.actor ?? fromUuidSync(effect.origin, {strict: false})?.parent?.actor;
    return {activity, sourceToken: actor ? actorUtils.getFirstToken(actor) : undefined};
}
async function playAnimation(effect, phase) {
    if (effect.flags.cat?.noAnimation) return;
    const actor = effectUtils.getActor(effect);
    if (!actor) return;
    const token = actorUtils.getFirstToken(actor);
    if (!token) return;
    const animationData = effect.flags.cat?.animation?.[phase];
    if (!animationData) return;
    const item = effectUtils.getOriginActivitySync(effect)?.item ?? (effect.parent instanceof Item ? effect.parent : undefined);
    const animation = animationUtils.getAnimation(animationData, {item});
    if (!animation) return;
    const config = constants.animations.getEffectAnimationConfigs(effect, phase);
    await animation.macros[phase]?.(effect, token, config, animationSource(effect));
}
const damagedBy = (relation) => ({workflow, target, ditem}) => ditem?.totalDamage > 0 && (!relation || (workflow.token.document.disposition === target.disposition) === (relation === 'ally'));
const attackedBy = (source, hit) => async ({workflow, target, origin}) => {
    if (!workflow.activity || !workflowUtils.isAttackType(workflow, 'attack')) return false;
    if (hit && !workflow.hitTargets.has(target.object)) return false;
    const actor = (await origin())?.item?.actor;
    return !!actor && (workflow.actor.id === actor.id) === source;
};
const damagedBySourceSide = includeSource => async ({workflow, ditem, origin}) => {
    if (!(ditem?.totalDamage > 0)) return false;
    const actor = (await origin())?.item?.actor;
    if (!actor) return false;
    if (workflow.actor.id === actor.id) return includeSource;
    const sourceToken = actorUtils.getFirstToken(actor);
    return !!sourceToken && workflow.token.document.disposition === sourceToken.disposition;
};
const specialDurationTriggers = {
    attackedByAnotherCreature: {stage: 'attack', side: 'target', test: attackedBy(false, false)},
    attackedBySource: {stage: 'attack', side: 'target', test: attackedBy(true, false)},
    hitByAnotherCreature: {stage: 'attack', side: 'target', test: attackedBy(false, true)},
    hitBySource: {stage: 'attack', side: 'target', test: attackedBy(true, true)},
    forceSave: {stage: 'save', side: 'actor', test: ({workflow}) => !!workflow.activity?.hasSave && !(workflow.targets.size === 1 && workflow.targets.has(workflow.token))},
    damaged: {stage: 'damage', side: 'target', test: damagedBy()},
    damagedByAlly: {stage: 'damage', side: 'target', test: damagedBy('ally')},
    damagedByEnemy: {stage: 'damage', side: 'target', test: damagedBy('enemy')},
    damagedBySourceOrAlly: {stage: 'damage', side: 'target', test: damagedBySourceSide(true)},
    damagedBySourceAlly: {stage: 'damage', side: 'target', test: damagedBySourceSide(false)},
    dealtDamage: {stage: 'damage', side: 'actor', test: ({workflow, target, ditem}) => ditem?.totalDamage > 0 && target.uuid !== workflow.token.document.uuid},
    endOfWorkflow: {stage: 'finished', side: 'both', test: () => true}
};
const stageSides = Object.values(specialDurationTriggers).reduce((sides, {stage, side}) => {
    sides[stage] ??= new Set();
    if (side === 'both') ['actor', 'target'].forEach(s => sides[stage].add(s));
    else sides[stage].add(side);
    return sides;
}, {});
async function expireBySpecialDuration(actor, side, stage, context) {
    await Promise.all(actorUtils.getEffects(actor, {includeItemEffects: true}).map(async effect => {
        const keys = effect.flags.cat?.specialDuration;
        if (!keys?.length) return;
        let originActivity;
        const origin = () => originActivity ??= effectUtils.getOriginActivity(effect);
        for (const key of keys) {
            const trigger = specialDurationTriggers[key];
            if (trigger?.stage !== stage || (trigger.side !== side && trigger.side !== 'both')) continue;
            if (await trigger.test({...context, effect, origin})) return await documentUtils.deleteDocument(effect);
        }
    }));
}
async function specialDuration(workflow, stage, {token, ditem} = {}) {
    if (!workflow.token) return;
    const sides = stageSides[stage];
    if (!sides) return;
    if (sides.has('target')) {
        const targets = stage === 'damage' ? [token?.document ?? token] : Array.from(workflow.targets ?? [], target => target.document);
        await Promise.all(targets.filter(target => target?.actor).map(target => expireBySpecialDuration(target.actor, 'target', stage, {workflow, target, ditem})));
    }
    if (sides.has('actor')) await expireBySpecialDuration(workflow.actor, 'actor', stage, {workflow, target: token?.document ?? token, ditem});
}
async function specialDurationConditions(effect) {
    await Promise.all(actorUtils.getEffects(effect.parent, {includeItemEffects: true}).filter(i => i.id != effect.id).map(async eff => {
        const specialDurations = eff.flags.cat?.specialDuration;
        if (!specialDurations?.length) return;
        if (effect.statuses.some(k => specialDurations.includes(k))) await documentUtils.deleteDocument(eff);
    }));
}
async function specialDurationRemovedConditions(effect) {
    await Promise.all(actorUtils.getEffects(effect.parent).filter(i => i.id != effect.id).map(async eff => {
        const specialDurations = eff.flags.cat?.specialDuration;
        if (!specialDurations?.length) return;
        if (effect.statuses.some(k => specialDurations.includes(k + 'Removed'))) await documentUtils.deleteDocument(eff);
    }));
}
async function specialDurationEquipment(item, {removed} = {}) {
    let equipmentTypes = Object.keys(CONFIG.DND5E.armorTypes);
    if (removed) equipmentTypes = equipmentTypes.map(i => i + 'Removed');
    await Promise.all(actorUtils.getEffects(item.actor, {includeItemEffects: true}).map(async effect => {
        let specialDurations = effect.flags.cat?.specialDuration;
        if (!specialDurations) return;
        specialDurations = specialDurations.filter(j => equipmentTypes.includes(j));
        if (!specialDurations.length) return;
        if (specialDurations.includes(item.system.type?.value)) await documentUtils.deleteDocument(effect);
    }));
}
async function refreshDisableConditions(actor, {token} = {}) {
    if (!actor) return;
    const updates = [];
    const equippedTypes = new Set(actor.itemTypes.equipment.filter(i => i.system.equipped).map(i => i.system.type?.value));
    for (const effect of actorUtils.getEffects(actor, {includeItemEffects: true})) {
        const conditions = effect.flags.cat?.disableCondition;
        if (!conditions?.length) continue;
        const shouldDisable = conditions.some(condition => 
            actor.statuses.has(condition) || 
            equippedTypes.has(condition) ||
            (condition === 'combatTurn' && !isCombatTurn(actor, token))
        );
        if (!!effect.disabled !== shouldDisable) updates.push({
            animate: false,
            action: 'update',
            parent: effect.parent,
            documentName: 'ActiveEffect',
            updates: [{_id: effect.id, disabled: shouldDisable}]
        });
    }
    if (updates.length) await documentUtils.modifyBatch(updates);
}
function isCombatTurn(actor, token) {
    token ??= actorUtils.getFirstToken(actor);
    if (!token) return false;
    return combatUtils.isOwnTurn(token);
}
async function specialDurationHitPoints(actor, updates) {
    const hp = updates.system?.attributes?.hp;
    if (!hp) return;
    const validTypes = [];
    if (hp.temp === 0) validTypes.push('tempHP');
    if (hp.tempmax === 0) validTypes.push('tempMaxHP');
    if (!validTypes.length) return;
    await Promise.all(actorUtils.getEffects(actor, {includeItemEffects: true}).map(async effect => {
        const specialDurations = effect.flags.cat?.specialDuration;
        if (!specialDurations) return;
        if (specialDurations.some(i => validTypes.includes(i))) await documentUtils.deleteDocument(effect);
    }));
}
async function specialDurationToolCheck(actor, roll, toolId) {
    await Promise.all(actorUtils.getEffects(actor, {includeItemEffects: true}).map(async effect => {
        const specialDurations = effect.flags.cat?.specialDuration;
        if (!specialDurations) return;
        let remove = specialDurations.includes(toolId) || specialDurations.includes('toolCheck');
        const target = roll.options.target;
        if (!remove && target) {
            if (target > roll.total && specialDurations.includes(toolId + 'Fail')) remove = true;
            if (target <= roll.total && specialDurations.includes(toolId + 'Succeed')) remove = true;
        }
        if (remove) await documentUtils.deleteDocument(effect);
    }));
}
async function specialDurationTurn(token, pass, {round, turn} = {}) {
    const effects = actorUtils.getEffects(token.actor, {includeItemEffects: true}).filter(i => i.flags.cat?.specialDuration?.includes(pass) && !(i.start?.round === round && i.start?.turn === turn));
    if (!effects.length) return;
    await documentUtils.deleteEmbeddedDocuments(token.actor, 'ActiveEffect', effects.map(i => i.id));
}
async function specialDurationMove(actor) {
    const effects = actorUtils.getEffects(actor, {includeItemEffects: true}).filter(i => i.flags.cat?.specialDuration?.includes('moveFinished'));
    if (!effects.length) return;
    await documentUtils.deleteEmbeddedDocuments(actor, 'ActiveEffect', effects.map(i => i.id));
}
async function specialDurationZeroSpeed(actor) {
    const effects = actorUtils.getEffects(actor, {includeItemEffects: true}).filter(i => i.flags.cat?.specialDuration?.includes('zeroSpeed'));
    if (!effects.length) return;
    const types = ['burrow', 'climb', 'fly', 'swim', 'walk'];
    const allZero = types.every(t => actor.system.attributes.movement.speeds[t] === 0);
    if (!allZero) return;
    await documentUtils.deleteEmbeddedDocuments(actor, 'ActiveEffect', effects.map(i => i.id));
}
async function unhideActivities(effect) {
    const identifiers = effect.flags.cat?.unhideActivities;
    if (!identifiers?.length) return;
    const originActivity = await effectUtils.getOriginActivity(effect);
    if (!originActivity) return;
    await itemUtils.unhideActivities(originActivity.item, identifiers, {favorite: !!effect.flags.cat?.favoriteActivities});
}
async function rehideActivities(effect) {
    const identifiers = effect.flags.cat?.unhideActivities;
    if (!identifiers?.length) return;
    const originActivity = await effectUtils.getOriginActivity(effect);
    if (!originActivity) return;
    await itemUtils.rehideActivities(originActivity.item, identifiers, {favorite: !!effect.flags.cat?.favoriteActivities});
}
function difficultTerrain(gridSpace, token, options, found) {
    if (!token.actor?.flags.cat?.ignoreDifficultTerrain?.tokens) return;
    found.clear();
}
export default {
    addConditions,
    removeConditions,
    applyActiveEffect,
    noAnimation,
    effectDescription,
    activityDC,
    specialDuration,
    specialDurationConditions,
    specialDurationRemovedConditions,
    specialDurationEquipment,
    refreshDisableConditions,
    specialDurationToolCheck,
    specialDurationHitPoints,
    specialDurationTurn,
    specialDurationMove,
    specialDurationZeroSpeed,
    playAnimation,
    unhideActivities,
    rehideActivities,
    difficultTerrain
};