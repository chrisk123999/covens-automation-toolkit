import {queryUtils} from '../utilities/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {auraEvents} from '../events/_module.mjs';
import specialDuration from '../mechanics/specialDuration.mjs';
async function doCreateActiveEffect(data, options) {
    let parent = options.parent;
    if (!parent) return;
    return await new Events.EffectEvent(data, constants.effectPasses.doCreated, {options, parent}).run();
}
async function doDeleteActiveEffect(effect, options) {
    return await new Events.EffectEvent(effect, constants.effectPasses.doDeleted, {options}).run();
}
async function createActiveEffect(effect, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    await new Events.EffectEvent(effect, constants.effectPasses.created, {options}).run();
    await auraEvents.effect(effect, options);
    if (effect.statuses.size) await specialDuration.specialDurationConditions(effect);
    if (effect.parent instanceof Actor && effect.changes.some(change => change.key.includes('system.attributes.movement.'))) await specialDuration.specialDurationZeroSpeed(effect.parent);
}
async function deleteActiveEffect(effect, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    await new Events.EffectEvent(effect, constants.effectPasses.deleted, {options}).run();
    await auraEvents.effect(effect, options);
    if (effect.statuses.size) await specialDuration.specialDurationRemovedConditions(effect);
}
async function updateActiveEffect(effect, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    await new Events.EffectEvent(effect, constants.effectPasses.updated, {options, updates}).run();
}
function preCreateActiveEffect(effect, updates, options, userId) {
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    new Events.EffectEvent(effect, constants.effectPasses.preCreated, {options, updates}).runSync();
}
function preDeleteActiveEffect(effect, updates, options, userId) {
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    new Events.EffectEvent(effect, constants.effectPasses.preDeleted, {options, updates}).runSync();
}
function preUpdateActiveEffect(effect, updates, options, userId) {
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
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