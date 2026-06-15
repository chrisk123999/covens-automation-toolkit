import {queryUtils} from '../utilities/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {auraEvents} from '../events/_module.mjs';
import {effects} from '../handlers/_module.mjs';
import {specialDuration} from '../mechanics/_module.mjs';
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
    if (!(effect.parent instanceof Actor || (effect.parent instanceof Item && effect.parent.actor))) return;
    if (effect.parent instanceof Actor) effects.addConditions(effect);
    await new Events.EffectEvent(effect, constants.effectPasses.created, {options}).run();
    await auraEvents.effect(effect, options);
    if (effect.statuses.size) await specialDuration.specialDurationConditions(effect);
    if (effect.parent instanceof Actor && effect.system.changes.some(change => change.key.includes('system.attributes.movement.'))) await specialDuration.specialDurationZeroSpeed(effect.parent);
}
async function deleteActiveEffect(effect, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor || (effect.parent instanceof Item && effect.parent.actor))) return;
    if (effect.parent instanceof Actor) await effects.removeConditions(effect);
    if (effect.statuses.size) await specialDuration.specialDurationRemovedConditions(effect);
    await new Events.EffectEvent(effect, constants.effectPasses.deleted, {options}).run();
    await auraEvents.effect(effect, options);
}
async function updateActiveEffect(effect, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!(effect.parent instanceof Actor || (effect.parent instanceof Item && effect.parent.actor))) return;
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
    new Events.EffectEvent(effect, constants.effectPasses.preUpdated, {options, updates}).runSync();
}
function getConditions(effect) {
    const conditions = new Set();
    if (effect.changes) {
        effect.changes.forEach(element => {
            if (constants.statusEffectKeys.includes(element.key)) conditions.add(element.value.toLowerCase());
        });
    }
    const effectConditions = effect.flags.cat?.conditions;
    if (effectConditions) effectConditions.forEach(c => conditions.add(c.toLowerCase()));
    if (effect.statuses) effect.statuses.forEach(status => conditions.add(status));
    return conditions;
}
export default {
    createActiveEffect,
    deleteActiveEffect,
    updateActiveEffect,
    preCreateActiveEffect,
    preDeleteActiveEffect,
    preUpdateActiveEffect,
    doCreateActiveEffect,
    doDeleteActiveEffect,
    getConditions
};