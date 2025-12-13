import {queryUtils} from '../utils.mjs';
import {Events} from '../lib.mjs';
async function createActiveEffect(effect, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    await new Events.EffectEvent(effect, 'created', {options}).run();
}
async function deleteActiveEffect(effect, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    await new Events.EffectEvent(effect, 'deleted', {options}).run();
}
async function updateActiveEffect(effect, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    await new Events.EffectEvent(effect, 'updated', {options, updates}).run();
}
function preCreateActiveEffect(effect, updates, options, userId) {
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    new Events.EffectEvent(effect, 'preCreated', {options, updates}).runSync();
}
function preDeleteActiveEffect(effect, updates, options, userId) {
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    new Events.EffectEvent(effect, 'preDeleted', {options, updates}).runSync();
}
function preUpdateActiveEffect(effect, updates, options, userId) {
    if (!(effect.parent instanceof Actor) || (effect.parent instanceof Item && effect.parent.actor)) return;
    new Events.EffectEvent(effect, 'preUpdated', {options, updates}).runSync();
}
export const effectEvents = {
    createActiveEffect,
    deleteActiveEffect,
    updateActiveEffect,
    preCreateActiveEffect,
    preDeleteActiveEffect,
    preUpdateActiveEffect
};