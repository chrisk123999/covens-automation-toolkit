/**
 * Active effect creation, origins, conditions, durations and concentration.
 * @module
 */
import {constants} from '../lib/_module.mjs';
import {automationUtils, dataUtils, documentUtils, genericUtils, queryUtils} from './_module.mjs';
/** @import {CatEffectData, MacroGroup} from './dataUtils.mjs' */
/** @import {EffectDurationData} from '@client/documents/_types.mjs' */
/**
 * The cast data stashed on this effect by CAT, falling back to midi-qol's.
 * @param {ActiveEffect} effect  Effect to read from.
 * @returns {object|undefined}
 * @example
 * const castLevel = effectUtils.getCastData(effect)?.castLevel;
 */
function getCastData(effect) {
    return effect.flags.cat?.castData ?? effect.flags['midi-qol']?.castData;
}
/**
 * Create effects on a document. Each effect is built with {@link dataUtils.buildEffectData}, and effects created on an
 * item have their range changes converted to the item's units. A user who doesn't own the document, or its actor, sends
 * the creation to a GM.
 * @param {foundry.abstract.Document} document   Document the effects are created on.
 * @param {object[]} effectDatas                 Effect data to create.
 * @param {object} [options]                     Additional options. Also accepts any {@link CatEffectData} property,
 *                                               applied to every effect.
 * @param {boolean} [options.forceGM]            Create through a GM even when the user has permission.
 * @param {MacroGroup[]} [options.macros]        Macros to add. An entry with an `effectIdentifier` is only added to the
 *                                               effect with that identifier.
 * @param {object} [options.effectOptions]       Passed to the creation, such as `keepId`.
 * @returns {Promise<ActiveEffect[]|undefined>}  The created effects. Undefined when the GM query fails.
 * @example
 * const [effect] = await effectUtils.createEffects(target.actor, [effectData], {rules: '2024', specialDuration: ['turnStart'], parentEntity: concentrationEffect});
 */
async function createEffects(document, effectDatas, {forceGM = false, macros, effectOptions, ...catData} = {}) {
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
        const effectData = dataUtils.buildEffectData(e, {...catData, macros: thisMacros});
        return document.documentName === 'Item' ? dataUtils.convertToItemUnits(effectData, document) : effectData;
    });
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    let effects;
    if (hasPermission && !forceGM) {
        effects = await document.createEmbeddedDocuments('ActiveEffect', data, effectOptions);
    } else {
        const uuids = await queryUtils.query('createEffects', queryUtils.gmUser(), {uuid: document.uuid, effectDatas: data, effectOptions});
        if (!uuids) return;
        effects = (await Promise.all(uuids.map(async uuid => fromUuid(uuid)))).filter(i => i);
    }
    return effects;
}
/**
 * Copy one of an item's effects onto an actor with {@link documentUtils.getEffectData}. Config values are stored on the
 * effect so they survive the item being consumed.
 * @param {Actor} actor                          Actor the effect is created on.
 * @param {Item} item                            Item that owns the effect.
 * @param {string} effectId                      Id of the effect on the item.
 * @param {object} [options]                     Additional options.
 * @param {object} [options.config]              Config values, read back with
 *                                               {@link automationUtils.getOriginConfigValue}.
 * @param {object} [options.changeValues]        New values for the effect's changes, keyed by change key.
 * @returns {Promise<ActiveEffect[]|undefined>}  The created effects, from {@link createEffects}. Undefined when the
 *                                               item has no effect with that id.
 * @example
 * await effectUtils.createItemEffect(actor, item, effectId, {changeValues: {'system.attributes.ac.bonus': '+2'}});
 */
async function createItemEffect(actor, item, effectId, {config, changeValues = {}} = {}) {
    const effectData = documentUtils.getEffectData(item, effectId);
    if (!effectData) return;
    effectData.system.changes = effectData.system.changes.map(change => change.key in changeValues ? {...change, value: changeValues[change.key]} : change);
    if (config) genericUtils.setProperty(effectData, 'flags.cat.config', config);
    return await createEffects(actor, [effectData]);
}
/**
 * The status condition keys this effect applies, in lowercase. Collects `macro.CE`, `macro.StatusEffect` and
 * `StatusEffect` changes, the CAT `conditions` flag, and the effect's own statuses.
 * @param {ActiveEffect} effect  Effect to read from.
 * @returns {Set<string>}
 * @example
 * if (effectUtils.getConditions(effect).has('prone')) return;
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
/**
 * Read the uuid of the activity that created this effect.
 * @param {ActiveEffect} effect  Effect to read from.
 * @returns {string|undefined}
 */
function getOriginActivityUuid(effect) {
    return effect.system?.origin?.activity ?? effect.flags.dae?.activity ?? effect.flags.cat?.activityUuid;
}
/**
 * The activity that created this effect. Reads the stamped activity uuid from the system, DAE or CAT. Otherwise, when
 * the origin is another effect, finds the activity that applies that effect.
 * @param {ActiveEffect} effect  Effect to read from.
 * @returns {Promise<Activity|undefined>}
 * @example
 * const activity = await effectUtils.getOriginActivity(effect);
 * const saveDC = activityUtils.getSaveDC(activity);
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
    if (origin.parent?.documentName === 'Item') return origin.parent.system.activities?.find(activity => activity.effects?.some(aEffect => aEffect._id === origin.id));
}
/**
 * Synchronous {@link getOriginActivity}, limited to documents already in memory.
 * @param {ActiveEffect} effect  Effect to read from.
 * @returns {Activity|undefined}
 * @example
 * const originActor = effectUtils.getOriginActivitySync(effect)?.actor;
 */
function getOriginActivitySync(effect) {
    const activityUuid = getOriginActivityUuid(effect);
    if (activityUuid) return fromUuidSync(activityUuid, {strict: false});
    if (!effect.origin) return;
    const origin = fromUuidSync(effect.origin, {strict: false});
    if (!origin || origin.documentName !== 'ActiveEffect') return;
    const originActivityUuid = origin.flags.dnd5e?.activity?.uuid;
    if (originActivityUuid) return fromUuidSync(originActivityUuid, {strict: false});
    if (origin.parent?.documentName === 'Item') return origin.parent.system.activities?.find(activity => activity.effects?.some(aEffect => aEffect._id === origin.id));
}
/**
 * The document this effect came from, resolved by the effect's own `getSource`. Null when it can't be found.
 * @param {ActiveEffect} effect  Effect to read from.
 * @returns {Promise<Activity|ActiveEffect|Actor5e|Item5e|RegionBehavior|null>}
 * @example
 * const origin = await effectUtils.getOrigin(effect);
 */
async function getOrigin(effect) {
    return await effect.getSource();
}
/**
 * The document this effect came from, limited to documents already in memory. Reads the activity, item or actor in
 * `system.origin`, then the effect's `origin` uuid.
 * @param {ActiveEffect} effect  Effect to read from.
 * @returns {Activity|Item5e|Actor5e|null}
 * @example
 * const originItem = effectUtils.getOriginSync(effect)?.item;
 */
function getOriginSync(effect) {
    const o = effect.system.origin ?? {};
    return fromUuidSync(o.activity ?? o.item ?? o.actor ?? effect.origin, {strict: false});
}
/**
 * The concentration effect this actor holds for an item, from midi-qol.
 * @param {foundry.documents.Actor} actor  Actor holding the concentration.
 * @param {foundry.documents.Item} item    Item being concentrated on.
 * @returns {ActiveEffect|undefined}
 * @example
 * const concentrationEffect = effectUtils.getConcentrationEffect(workflow.actor, workflow.item);
 */
function getConcentrationEffect(actor, item) {
    return MidiQOL.getConcentrationEffect(actor, item);
}
/**
 * End the concentration this actor holds for an item by deleting its concentration effect with
 * {@link documentUtils.deleteDocument}. Does nothing when there is none.
 * @param {foundry.documents.Actor} actor  Actor holding the concentration.
 * @param {foundry.documents.Item} item    Item being concentrated on.
 * @returns {Promise<void>}
 * @example
 * await effectUtils.endConcentration(actor, item);
 */
async function endConcentration(actor, item) {
    const effect = getConcentrationEffect(actor, item);
    if (effect) await documentUtils.deleteDocument(effect);
}
/**
 * The actor this effect sits on, whether it is on the actor or on one of its items. Undefined for effects on unowned
 * items.
 * @param {ActiveEffect} effect  Effect to read from.
 * @returns {foundry.documents.Actor|undefined}
 * @example
 * const actor = effectUtils.getActor(effect);
 */
function getActor(effect) {
    if (!effect.parent) return;
    if (effect.parent instanceof Actor) return effect.parent;
    if (effect.parent instanceof Item) return effect.parent.actor;
}
/**
 * Every effect with this identifier on the actors of the scene's tokens. Effects on their items are not searched.
 * @param {Scene} scene                                 Scene to search.
 * @param {string} identifier                           Effect identifier to match.
 * @param {object} [options]                            Additional options.
 * @param {foundry.abstract.Document} [options.origin]  Only effects whose origin is this document or one of its
 *                                                      embedded documents.
 * @returns {ActiveEffect[]}
 * @example
 * const marked = effectUtils.getSceneEffects(token.parent, 'huntersMark', {origin: actor});
 */
function getSceneEffects(scene, identifier, {origin} = {}) {
    return scene.tokens.contents.flatMap(token => token.actor?.effects.filter(effect => documentUtils.getIdentifier(effect) === identifier && (!origin || effect.origin?.startsWith(origin.uuid))) ?? []);
}
/**
 * Restart the effect's duration from the current world time and combat turn, and clear its expired state. Written with
 * {@link documentUtils.update}.
 * @param {foundry.documents.ActiveEffect} effect  Effect to reset.
 * @returns {Promise<foundry.documents.ActiveEffect>}
 * @example
 * await effectUtils.resetDuration(effect);
 */
async function resetDuration(effect) {
    return await documentUtils.update(effect, {
        start: ActiveEffect.implementation.getEffectStart(),
        'duration.expired': false
    });
}
/**
 * Build the config key an effect's image setting is stored under.
 * @param {string} [identifier]  Prefix, for documents that apply more than one image set.
 * @param {string} key           Image key, such as tokenImg or avatarImg.
 * @returns {string}             The key itself when no identifier is given.
 */
function getImageKey(identifier, key) {
    return identifier ? identifier + key.charAt(0).toUpperCase() + key.slice(1) : key;
}
/**
 * Macro config entries for the portrait image, token image and image priority an effect applies, in the `visuals`
 * category. Read back by {@link pushImageChanges}.
 * @param {object} [options]              Additional options.
 * @param {string} [options.identifier]   Prefixes the image keys, for documents with more than one image set.
 * @param {string} [options.avatarLabel]  Label for the portrait image setting.
 * @param {string} [options.tokenLabel]   Label for the token image setting.
 * @returns {object}
 * @example
 * effectUtils.getImageConfig({identifier: 'wildShape'}); // keys wildShapeTokenImg, wildShapeAvatarImg, imgPriority
 */
function getImageConfig({identifier, avatarLabel = 'CAT.Config.AvatarImg', tokenLabel = 'CAT.Config.TokenImg'} = {}) {
    return {
        [getImageKey(identifier, 'tokenImg')]: {default: '', type: 'file', label: tokenLabel, category: 'visuals'},
        [getImageKey(identifier, 'avatarImg')]: {default: '', type: 'file', label: avatarLabel, category: 'visuals'},
        imgPriority: {default: 50, type: 'number', label: 'CAT.Config.ImgPriority', category: 'visuals'}
    };
}
/**
 * Add the document's configured portrait and token images to effect data as override changes. Images left blank are
 * skipped.
 * @param {object} effectData                   Effect data to write into, which is mutated.
 * @param {foundry.abstract.Document} document  The document carrying {@link getImageConfig} values.
 * @param {object} [options]                    Additional options.
 * @param {string} [options.identifier]         The image set to use.
 * @returns {object}                            The same effect data.
 * @example
 * effectUtils.pushImageChanges(effectData, item);
 * await effectUtils.createEffects(actor, [effectData]);
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
 * Convert effect duration data to seconds with the world calendar. Rounds and turns use the core round and turn times,
 * and months average the calendar's days per month. Undefined for open-ended or zero durations.
 * @param {EffectDurationData} duration  Duration data with `value` and `units`.
 * @returns {number|undefined}
 * @example
 * effectUtils.durationToSeconds({value: 10, units: 'minutes'}); // 600
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
/**
 * Apply the system's No Reactions effect, which midi-qol and CAT read as the actor being unable to take reactions.
 * Created with {@link createEffects}.
 * @param {Actor5e} actor                       Actor to apply it to.
 * @param {object} [options]                    Additional options.
 * @param {string} [options.origin]             Uuid of the effect's origin.
 * @param {object} [options.duration]           Effect duration.
 * @param {string[]} [options.specialDuration]  Removal triggers, such as `turnStart`.
 * @returns {Promise<ActiveEffect|undefined>}   The created effect. Undefined when the source effect can't be found.
 * @example
 * await effectUtils.applyNoReactions(target.actor, {origin: workflow.activity.uuid, specialDuration: ['turnStart']});
 */
async function applyNoReactions(actor, {origin, duration, specialDuration} = {}) {
    const source = await fromUuid(constants.noReactionsEffect);
    if (!source) return;
    const effectData = genericUtils.mergeObject(source.toObject(), {origin, _stats: {compendiumSource: constants.noReactionsEffect}});
    if (duration) effectData.duration = duration;
    return (await createEffects(actor, [effectData], {specialDuration}))?.[0];
}
export default {
    applyNoReactions,
    durationToSeconds,
    getCastData,
    createEffects,
    createItemEffect,
    getConditions,
    getOriginActivity,
    getOriginActivitySync,
    getConcentrationEffect,
    endConcentration,
    getActor,
    getSceneEffects,
    resetDuration,
    getImageConfig,
    pushImageChanges,
    getOrigin,
    getOriginSync
};
