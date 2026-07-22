import {genericUtils, queryUtils} from '../utilities/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {auraEvents} from '../events/_module.mjs';
import {effects} from '../handlers/_module.mjs';
async function doCreateActiveEffect(data, options) {
    let parent = options.parent;
    if (!parent) return;
    return await new Events.EffectEvent(data, constants.effectPasses.doCreated, {options, parent}).run();
}
async function doDeleteActiveEffect(effect, options) {
    return await new Events.EffectEvent(effect, constants.effectPasses.doDeleted, {options}).run();
}
function immediateEffectAnimations(effect, active) {
    if (active) {
        effects.createAnimations(effect);
        effects.unhideActivities(effect);
    } else {
        effects.deleteAnimations(effect);
        effects.rehideActivities(effect);
    }
    pendingAnimations.delete(effect.uuid);
}
const pendingAnimations = new Map();
function effectAnimations(effect, active) {
    let pending = pendingAnimations.get(effect.uuid);
    if (pending) return pending(effect, active);
    pending = foundry.utils.debounce(immediateEffectAnimations, 200);
    pendingAnimations.set(effect.uuid, pending);
    pending(effect, active);
}
async function createActiveEffect(effect, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor || (effect.parent instanceof Item && effect.parent.actor))) return;
    if (effect.parent instanceof Actor) await effects.addConditions(effect);
    if (effect.statuses.size) {
        await effects.specialDurationConditions(effect);
        await effects.disableConditionStatuses(effect, true);
    }
    if (effect.parent instanceof Actor && effect.system.changes.some(change => change.key.includes('system.attributes.movement.'))) await effects.specialDurationZeroSpeed(effect.parent);
    effectAnimations(effect, true);
    await new Events.EffectEvent(effect, constants.effectPasses.created, {options}).run();
    await auraEvents.effect(effect, options);
}
async function deleteActiveEffect(effect, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor || (effect.parent instanceof Item && effect.parent.actor))) return;
    if (effect.parent instanceof Actor) await effects.removeConditions(effect);
    if (effect.statuses.size) {
        await effects.specialDurationRemovedConditions(effect);
        await effects.disableConditionStatuses(effect, false);
    }
    effectAnimations(effect, false);
    await new Events.EffectEvent(effect, constants.effectPasses.deleted, {options}).run();
    await auraEvents.effect(effect, options);
}
async function updateActiveEffect(effect, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor || (effect.parent instanceof Item && effect.parent.actor))) return;
    const prevActive = genericUtils.getProperty(options, 'cat.previous.active');
    if (effect.active !== prevActive) {
        effectAnimations(effect, effect.active);
        if (effect.statuses.size) await effects.disableConditionStatuses(effect, effect.active);
    }
    await new Events.EffectEvent(effect, constants.effectPasses.updated, {options, updates}).run();
}
function preCreateActiveEffect(effect, updates, options, userId) {
    effects.noAnimation(effect, options);
    effects.effectDescription(effect, updates);
    if (!(effect.parent instanceof Actor || (effect.parent instanceof Item && effect.parent.actor))) return;
    new Events.EffectEvent(effect, constants.effectPasses.preCreated, {options, updates}).runSync();
}
function preDeleteActiveEffect(effect, options, userId) {
    effects.noAnimation(effect, options);
    if (!(effect.parent instanceof Actor || (effect.parent instanceof Item && effect.parent.actor))) return;
    new Events.EffectEvent(effect, constants.effectPasses.preDeleted, {options}).runSync();
}
function preUpdateActiveEffect(effect, updates, options, userId) {
    effects.noAnimation(effect, options);
    if (!(effect.parent instanceof Actor || (effect.parent instanceof Item && effect.parent.actor))) return;
    genericUtils.setProperty(options, 'cat.previous.active', effect.active);
    new Events.EffectEvent(effect, constants.effectPasses.preUpdated, {options, updates}).runSync();
}
export default {
    createActiveEffect,
    deleteActiveEffect,
    updateActiveEffect,
    preCreateActiveEffect,
    preDeleteActiveEffect,
    preUpdateActiveEffect,
    doCreateActiveEffect,
    doDeleteActiveEffect
};