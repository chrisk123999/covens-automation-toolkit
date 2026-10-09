import {automationUtils, dataUtils, documentUtils, queryUtils} from './_module.mjs';
/**
 * Get the cast data stashed on this effect by CAT or midi.
 * @param {ActiveEffect} effect Effect to read from.
 * @returns {object|undefined}
 */
function getCastData(effect) {
    return effect.flags.cat?.castData ?? effect.flags['midi-qol']?.castData;
}
/**
 * Create effects on a document, delegating to a GM when the user lacks permission.
 * @param {foundry.abstract.Document} document Document the effects are created on.
 * @param {object[]} effectDatas Effect data to create.
 * @param {object} [options] Additional options.
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
 * @param {ActiveEffect} effect Effect to read from.
 * @returns {Set<string>}
 */
function getConditions(effect) {
    let conditions = new Set();
    const validKeys = [
        'macro.CE',
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
function getOriginActivityUuid(effect) {
    return effect.system?.origin?.activity ?? effect.flags.dae?.activity ?? effect.flags.cat?.activityUuid;
}
/**
 * Resolve the activity that created this effect, preferring the stamped uuid.
 * @param {ActiveEffect} effect Effect to read from.
 * @returns {Promise<Activity|undefined>}
 */
async function getOriginActivity(effect) {
    if (!effect) return;
    const activityUuid = getOriginActivityUuid(effect);
    if (activityUuid) return await fromUuid(activityUuid);
    if (!effect.origin) return;
    const origin = await fromUuid(effect.origin);
    if (!origin || origin.documentName !== 'ActiveEffect') return;
    const originActivityUuid = origin.flags.dnd5e?.activity?.uuid;
    if (originActivityUuid) return await fromUuid(originActivityUuid);
    if (origin.parent?.documentName === 'Item') {
        return origin.parent.system.activities?.find(activity =>
            activity.effects.some(aEffect => aEffect._id === origin.id)
        );
    }
}
/**
 * Synchronous {@link getOriginActivity}, limited to documents already in memory.
 * @param {ActiveEffect} effect Effect to read from.
 * @returns {Activity|undefined}
 */
function getOriginActivitySync(effect) {
    const activityUuid = getOriginActivityUuid(effect);
    if (activityUuid) return fromUuidSync(activityUuid, {strict: false});
    if (!effect.origin) return;
    const origin = fromUuidSync(effect.origin, {strict: false});
    if (!origin || origin.documentName !== 'ActiveEffect') return;
    const originActivityUuid = origin.flags.dnd5e?.activity?.uuid;
    if (originActivityUuid) return fromUuidSync(originActivityUuid, {strict: false});
    if (origin.parent?.documentName === 'Item') {
        return origin.parent.system.activities?.find(activity =>
            activity.effects.some(aEffect => aEffect._id === origin.id)
        );
    }
}
/**
 * Get the concentration effect this actor holds for an item.
 * @param {foundry.documents.Actor} actor Actor holding the concentration.
 * @param {foundry.documents.Item} item Item being concentrated on.
 * @returns {ActiveEffect|undefined}
 */
function getConcentrationEffect(actor, item) {
    return MidiQOL.getConcentrationEffect(actor, item);
}
/**
 * Get the actor this effect sits on, whether it is applied to the actor or to one of its items.
 * @param {ActiveEffect} effect Effect to read from.
 * @returns {foundry.documents.Actor|undefined}
 */
function getActor(effect) {
    if (!effect.parent) return;
    if (effect.parent instanceof Actor) return effect.parent;
    if (effect.parent instanceof Item) return effect.parent.actor;
}
/**
 * Set the effect start time to the current world time or combat turn.
 * @param {foundry.documents.ActiveEffect} effect Effect to read from.
 * @returns {Promise<foundry.documents.ActiveEffect>}
 */
async function resetDuration(effect) {
    return await documentUtils.update(effect, {
        start: ActiveEffect.implementation.getEffectStart(),
        'duration.expired': false
    });
}
/**
 * Build the config key an effect's image setting is stored under.
 * @param {string} [identifier] Prefix, for documents that apply more than one image set.
 * @param {string} key Image key, such as tokenImg or avatarImg.
 * @returns {string} The key itself when no identifier is given.
 */
function getImageKey(identifier, key) {
    return identifier ? identifier + key.charAt(0).toUpperCase() + key.slice(1) : key;
}
/**
 * Macro config entries for the portrait and token images an effect applies. See {@link pushImageChanges}.
 * @param {object} [options] Additional options.
 * @param {string} [options.identifier] Prefixes the image keys, for documents with more than one image set.
 * @param {string} [options.avatarLabel] Label for the portrait image setting.
 * @param {string} [options.tokenLabel] Label for the token image setting.
 * @returns {object}
 */
function getImageConfig({identifier, avatarLabel = 'CAT.Config.AvatarImg', tokenLabel = 'CAT.Config.TokenImg'} = {}) {
    return {
        [getImageKey(identifier, 'tokenImg')]: {default: '', type: 'file', label: tokenLabel, category: 'visuals'},
        [getImageKey(identifier, 'avatarImg')]: {default: '', type: 'file', label: avatarLabel, category: 'visuals'},
        imgPriority: {default: 50, type: 'number', label: 'CAT.Config.ImgPriority', category: 'visuals'}
    };
}
/**
 * Add the document's configured portrait and token images to effect data as override changes.
 * @param {object} effectData Effect data to write into, which is mutated.
 * @param {foundry.abstract.Document} document The document carrying {@link getImageConfig} values.
 * @param {object} [options] Additional options.
 * @param {string} [options.identifier] The image set to use.
 * @returns {object} The same effect data.
 */
function pushImageChanges(effectData, document, {identifier} = {}) {
    const avatarImg = automationUtils.getConfigValue(document, getImageKey(identifier, 'avatarImg'));
    const tokenImg = automationUtils.getConfigValue(document, getImageKey(identifier, 'tokenImg'));
    const priority = automationUtils.getConfigValue(document, 'imgPriority');
    if (avatarImg) effectData.system.changes.push({key: 'img', type: 'override', value: avatarImg, priority});
    if (tokenImg) effectData.system.changes.push({key: 'token.texture.src', type: 'override', value: tokenImg, priority});
    return effectData;
}
/**
 * Convert effect duration data to seconds, using the world calendar. Open-ended durations return undefined.
 * @param {EffectDurationData} duration Duration data with `value` and `units`.
 * @returns {number|undefined}
 */
function durationToSeconds({value, units} = {}) {
    if (!value || !units) return;
    const calendar = game.time.calendar;
    let unit = units.slice(0, -1);
    if (unit === 'round' || unit === 'turn') return Math.trunc(value * (CONFIG.time[unit + 'Time'] || 0)) || undefined;
    if (unit === 'month') {
        const monthCount = calendar.months.values.length;
        value = monthCount ? Math.ceil(value * calendar.days.daysPerYear / monthCount) : 0;
        unit = 'day';
    }
    return calendar.componentsToTime({[unit]: value});
}
export default {
    durationToSeconds,
    getCastData,
    createEffects,
    getConditions,
    getOriginActivity,
    getOriginActivitySync,
    getConcentrationEffect,
    getActor,
    resetDuration,
    getImageConfig,
    pushImageChanges
};
