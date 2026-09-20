import {dataUtils, documentUtils, queryUtils} from './_module.mjs';
/**
 * Get the cast data stashed on this effect by CAT or midi.
 * @param {ActiveEffect} effect
 * @returns {object|undefined}
 */
function getCastData(effect) {
    return effect.flags.cat?.castData ?? effect.flags['midi-qol']?.castData;
}
/**
 * Create effects on a document, delegating to a GM when the user lacks permission.
 * @param {foundry.abstract.Document} document
 * @param {object[]} effectDatas
 * @param {object} [options]
 * @param {boolean} [options.forceGM] Create through a GM even when the user has permission.
 * @param {MacroGroup[]} [options.macros] Entries may carry an `effectIdentifier` to target one effect in the batch.
 * @param {object} [options.effectOptions] Passed to the creation when it goes through a GM.
 * @param {CatEffectData} [options.catData] Applied to every effect in the batch. See {@link CatEffectData}
 * @returns {Promise<ActiveEffect[]|undefined>}
 */
async function createEffects(document, effectDatas, {forceGM = false, macros, effectOptions, createAnimation, deleteAnimation, createAnimationOptions = {}, deleteAnimationOptions = {}, rules, specialDuration, vae, unhideActivities, favoriteActivities, parentEntity} = {}) {
    const data = effectDatas.map(e => {
        const targetIdentifier = e.flags?.cat?.identifier ?? e.name?.slugify();
        let thisMacros = [];
        if (targetIdentifier && macros?.length) {
            macros.forEach(macroGroup => {
                const applicableMacros = macroGroup.macros.filter(m => !m.effectIdentifier || m.effectIdentifier === targetIdentifier).map(({effectIdentifier, ...rest}) => rest);
                if (!applicableMacros.length) return;
                thisMacros.push({type: macroGroup.type, macros: applicableMacros});
            });
        }
        return dataUtils.buildEffectData(e, {macros: thisMacros, createAnimation, deleteAnimation, createAnimationOptions, deleteAnimationOptions, rules, specialDuration, vae, unhideActivities, favoriteActivities, parentEntity});
    });
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    let effects;
    if (hasPermission && !forceGM) {
        effects = await document.createEmbeddedDocuments('ActiveEffect', data);
    } else {
        const uuids = await queryUtils.query('createEffects', queryUtils.gmUser(), {uuid: document.uuid, effectDatas: data, effectOptions});
        if (!uuids) return;
        effects = (await Promise.all(uuids.map(async uuid => fromUuid(uuid)))).filter(i => i);
    }
    return effects;
}
/**
 * Collect the status condition keys this effect applies through `macro.CE`, `macro.CUB` or `StatusEffect` changes.
 * @param {ActiveEffect} effect
 * @returns {Set<string>}
 */
function getConditions(effect) {
    let conditions = new Set();
    const validKeys = [
        'macro.CE',
        'macro.CUB',
        'macro.StatusEffect',
        'StatusEffect'
    ];
    effect.system.changes.forEach(element => {
        if (validKeys.includes(element.key)) conditions.add(element.value.toLowerCase());
    });
    const effectConditions = effect.flags.cat?.conditions;
    if (effectConditions) effectConditions.forEach(c => conditions.add(c.toLowerCase()));
    conditions = conditions.union(effect.statuses ?? new Set());
    return conditions;
}
/**
 * Resolve the activity that created this effect, preferring the stamped uuid and otherwise walking
 * the effect's origin back to the activity that carries it.
 * @param {ActiveEffect} effect
 * @returns {Promise<Activity|undefined>}
 */
async function getOriginActivity(effect) {
    if (!effect) return;
    const activityUuid = effect.flags.dae?.activity ?? effect.flags.cat?.activityUuid;
    if (activityUuid) return await fromUuid(activityUuid);
    if (!effect.origin) return;
    const origin = await fromUuid(effect.origin);
    if (!origin || origin.documentName !== 'ActiveEffect') return;
    const originActivityUuid = origin.flags.dnd5e?.activity?.uuid;
    if (originActivityUuid) return await fromUuid(originActivityUuid);
    if (origin.parent?.documentName === 'Item') {
        return origin.parent.system.activities?.find(activity =>
            activity.effects.some(aEffect => aEffect.effect.id === origin.id)
        );
    }
}
/**
 * Synchronous {@link getOriginActivity}, limited to documents already in memory.
 * @param {ActiveEffect} effect
 * @returns {Activity|undefined}
 */
function getOriginActivitySync(effect) {
    const activityUuid = effect.flags.dae?.activity ?? effect.flags.cat?.activityUuid;
    if (activityUuid) return fromUuidSync(activityUuid, {strict: false});
    if (!effect.origin) return;
    const origin = fromUuidSync(effect.origin, {strict: false});
    if (!origin || origin.documentName !== 'ActiveEffect') return;
    const originActivityUuid = origin.flags.dnd5e?.activity?.uuid;
    if (originActivityUuid) return fromUuidSync(originActivityUuid, {strict: false});
    if (origin.parent?.documentName === 'Item') {
        return origin.parent.system.activities?.find(activity =>
            activity.effects.some(aEffect => aEffect.effect.id === origin.id)
        );
    }
}
/**
 * Get the concentration effect this actor holds for an item.
 * @param {foundry.documents.Actor} actor
 * @param {foundry.documents.Item} item
 * @returns {ActiveEffect|undefined}
 */
function getConcentrationEffect(actor, item) {
    return MidiQOL.getConcentrationEffect(actor, item);
}
/**
 * Get the actor this effect sits on, whether it is applied to the actor or to one of its items.
 * @param {ActiveEffect} effect
 * @returns {foundry.documents.Actor|undefined}
 */
function getActor(effect) {
    if (!effect.parent) return;
    if (effect.parent instanceof Actor) return effect.parent;
    if (effect.parent instanceof Item) return effect.parent.actor;
}
/**
 * Set the effect start time to the current world time or combat turn.
 * @param {foundry.documents.ActiveEffect} effect
 * @returns {Promise<foundry.documents.ActiveEffect>}
 */
async function resetDuration(effect) {
    return await documentUtils.update(effect, {
        start: ActiveEffect.implementation.getEffectStart(),
        'duration.expired': false
    });
}
export default {
    getCastData,
    createEffects,
    getConditions,
    getOriginActivity,
    getOriginActivitySync,
    getConcentrationEffect,
    getActor,
    resetDuration
};
