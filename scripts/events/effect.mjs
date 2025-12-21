import {queryUtils} from '../utils.mjs';
import {constants, Events} from '../lib.mjs';
import {auraEvents} from '../event.mjs';
async function createActiveEffect(effect, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    await new Events.EffectEvent(effect, constants.effectPasses.created, {options}).run();
    await auraEvents.effect(effect, options);
}
async function deleteActiveEffect(effect, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    await new Events.EffectEvent(effect, constants.effectPasses.deleted, {options}).run();
    await auraEvents.effect(effect, options);
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
export const effectEvents = {
    createActiveEffect,
    deleteActiveEffect,
    updateActiveEffect,
    preCreateActiveEffect,
    preDeleteActiveEffect,
    preUpdateActiveEffect
};