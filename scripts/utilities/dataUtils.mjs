import {effectUtils, genericUtils} from './_module.mjs';
import {Logging} from '../lib/_module.mjs';
/**
 * Set document rules in the correct location. Does not perform updates.
 * @param {object | foundry.abstract.Document} documentData Document or document data to write the rules onto.
 * @param {'2024' | '2014'} rules Rules edition to set.
 */
function setRules(documentData, rules) {
    genericUtils.setProperty(documentData, 'flags.cat.automation.rules', rules);
}
/**
 * Set document identifier in the correct location. Does not perform updates.
 * @param {object | foundry.abstract.Document} documentData Document or document data to write the identifier onto.
 * @param {string} identifier Identifier macros will look this document up by.
 */
function setIdentifier(documentData, identifier) {
    genericUtils.setProperty(documentData, 'flags.cat.identifier', identifier);
}
/**
 * @typedef {object} MacroEntry
 * @property {string} identifier
 * @property {string} rules
 * @property {string} source
 */
/**
 * @typedef {object} MacroGroup
 * @property {string} type
 * @property {MacroEntry[]} macros
 */
/**
 * @typedef {object} AnimationEntry
 * @property {string} identifier
 * @property {string} source
 */
/**
 * @typedef {object} VaeEntry
 * @property {'use'} type
 * @property {string} name
 * @property {string} itemIdentifier
 * @property {string} [activityIdentifier]
 */
/**
 * @typedef {object} CatEffectData
 * @property {MacroGroup[]} macros Merge the list into existing macros.
 * @property {MacroGroup[]} removeMacros Remove macros that match all provided {@link MacroEntry} properties.
 * @property {AnimationEntry} createAnimation
 * @property {AnimationEntry} deleteAnimation
 * @property {object} createAnimationOptions Options specific to a particular animation, such as color. If absent, defaults are fetched from the registered animation.
 * @property {object} deleteAnimationOptions Options specific to a particular animation, such as color. If absent, defaults are fetched from the registered animation.
 * @property {string[]} specialDuration Deletes effect. Keys registered with DAE, such as midi-qol's `1Attack`, are written to DAE's flag.
 * @property {string[]} disableCondition Disables effect.
 * @property {string[]} unhideActivities
 * @property {boolean} favoriteActivities Also favorite the activities named by {@link unhideActivities}.
 * @property {VaeEntry[]} vae
 * @property {'2014'|'2024'|'all'} rules
 * @property {object} copyConfigs Duplicate macro configurations from another document onto this effect.
 * @property {foundry.abstract.Document} parentEntity A dependent parent for this effect.
 * @property {string} activityUuid The activity this effect came from, so later macros can trace it back.
 */
/**
 * Attach CAT data to an effect before creation.
 * @param {object} effectData Effect data to build on, which is mutated and returned.
 * @param {CatEffectData} [options] CAT effect settings to apply.
 * @returns {object} Modified effectData.
 */
function buildEffectData(effectData, {macros, removeMacros, createAnimation, deleteAnimation, createAnimationOptions = {}, deleteAnimationOptions = {}, rules, specialDuration, disableCondition, vae, unhideActivities, favoriteActivities, copyConfigs, parentEntity, activityUuid} = {}) {
    if (removeMacros?.length) {
        removeMacros.forEach(macroGroup => {
            if (!macroGroup.macros?.length) return;
            const existingMacros = effectData.flags?.cat?.macros?.[macroGroup.type] ?? [];
            const remaining = existingMacros.filter(e =>
                !macroGroup.macros.some(m => {
                    if (m.source && m.source !== e.source) return;
                    if (m.identifier && m.identifier !== e.identifier) return;
                    if (m.rules && m.rules !== 'all' && e.rules !== 'all' && m.rules !== e.rules) return;
                    return true;
                })
            );
            if (existingMacros.length > 0 && remaining.length === 0) delete effectData.flags.cat.macros[macroGroup.type];
            else genericUtils.setProperty(effectData, 'flags.cat.macros.' + macroGroup.type, remaining);
        });
    }
    if (macros?.length) {
        macros.forEach(macroGroup => {
            if (!macroGroup.macros?.length) return;
            const existingMacros = effectData.flags?.cat?.macros?.[macroGroup.type] ?? [];
            const combinedMacros = [...existingMacros, ...macroGroup.macros];
            const uniqueMacros = new Map();
            combinedMacros.forEach(macro => uniqueMacros.set(macro.source + '|' + macro.identifier + '|' + macro.rules, macro));
            genericUtils.setProperty(effectData, 'flags.cat.macros.' + macroGroup.type, Array.from(uniqueMacros.values()));
        });
    }
    if (rules) setRules(effectData, rules);
    if (vae) genericUtils.setProperty(effectData, 'flags.cat.vae.buttons', vae);
    if (parentEntity) genericUtils.setProperty(effectData, 'flags.dnd5e.dependentOn', parentEntity.uuid);
    if (specialDuration) {
        const daeDurations = DAE.daeSpecialDurations();
        const catKeys = specialDuration.filter(key => !(key in daeDurations));
        const daeKeys = specialDuration.filter(key => key in daeDurations);
        if (catKeys.length) genericUtils.setProperty(effectData, 'flags.cat.specialDuration', catKeys);
        if (daeKeys.length) genericUtils.setProperty(effectData, 'flags.dae.specialDuration', daeKeys);
    }
    if (disableCondition) genericUtils.setProperty(effectData, 'flags.cat.disableCondition', disableCondition);
    if (unhideActivities) genericUtils.setProperty(effectData, 'flags.cat.unhideActivities', unhideActivities);
    if (favoriteActivities) genericUtils.setProperty(effectData, 'flags.cat.favoriteActivities', true);
    if (createAnimation) genericUtils.setProperty(effectData, 'flags.cat.animation.create', {...createAnimation, config: createAnimationOptions});
    if (deleteAnimation) genericUtils.setProperty(effectData, 'flags.cat.animation.delete', {...deleteAnimation, config: deleteAnimationOptions});
    if (activityUuid) genericUtils.setProperty(effectData, 'flags.cat.activityUuid', activityUuid);
    if (copyConfigs) genericUtils.setProperty(effectData, 'flags.cat.config', genericUtils.mergeObject(effectData.flags.cat?.config ?? {}, copyConfigs));
    if (effectData.origin) setOrigin(effectData, effectData.origin);
    if (isMetric()) convertEffectLengths(effectData, lengthKeys, dnd5e.utils.defaultUnits('length'));
    return effectData;
}
const lengthKeys = /^system\.attributes\.(movement\.(speeds\.)?(walk|fly|swim|climb|burrow|bonus)|senses\.(ranges\.)?(darkvision|blindsight|tremorsense|truesight))$/;
const rangeKeys = /^system\.range\.(value|long|reach)$/;
/**
 * Whether the system's metric length setting is on.
 * @returns {boolean}
 */
function isMetric() {
    return game.settings.get('dnd5e', 'metricLengthUnits');
}
/**
 * Whether a value is a number or a numeric string.
 * @param {*} value Value to test.
 * @returns {boolean}
 */
function isPlainNumber(value) {
    return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value));
}
/**
 * Convert a length in feet to other units, keeping a string a string.
 * @param {number|string} value Length in feet.
 * @param {string} units Units converted to.
 * @returns {number|string}
 */
function convertValue(value, units) {
    const converted = dnd5e.utils.convertLength(Number(value), 'ft', units);
    return typeof value === 'string' ? String(converted) : converted;
}
/**
 * Convert an effect's plain-number length changes from feet, flagging it so it never converts twice.
 * @param {object} effectData Effect data, changed in place.
 * @param {RegExp} keys Change keys to convert.
 * @param {string} units Units converted to.
 */
function convertEffectLengths(effectData, keys, units) {
    if (effectData.flags?.cat?.metric) return;
    const changes = (effectData.system?.changes ?? []).filter(change => keys.test(change.key) && ['add', 'upgrade', 'downgrade', 'override'].includes(change.type) && isPlainNumber(change.value));
    if (!changes.length) return;
    changes.forEach(change => change.value = convertValue(change.value, units));
    genericUtils.setProperty(effectData, 'flags.cat.metric', true);
}
/**
 * Convert a range or area's plain-number fields from feet and set its units.
 * @param {object} data Range or area data, changed in place.
 * @param {string[]} keys Fields to convert.
 * @param {string} units Units converted to.
 */
function convertFields(data, keys, units) {
    if (data?.units !== 'ft') return;
    const values = keys.filter(key => data[key] !== null && data[key] !== undefined && data[key] !== '');
    if (!values.every(key => isPlainNumber(data[key]))) return;
    values.forEach(key => data[key] = convertValue(data[key], units));
    data.units = units;
}
/**
 * Convert an item's ranges, reach, areas and effect lengths to meters when the metric setting is on.
 * @param {object} itemData Item data, changed in place.
 * @returns {object}
 */
function convertItemToMetric(itemData) {
    if (!isMetric() || itemData.flags?.cat?.automation?.metric) return itemData;
    const units = dnd5e.utils.defaultUnits('length');
    convertFields(itemData.system?.range, ['value', 'long', 'reach'], units);
    convertFields(itemData.system?.target?.template, ['size', 'width', 'height'], units);
    Object.values(itemData.system?.activities ?? {}).forEach(activity => {
        convertFields(activity.range, ['value'], units);
        convertFields(activity.target?.template, ['size', 'width', 'height'], units);
    });
    (itemData.effects ?? []).forEach(effect => convertEffectLengths(effect, lengthKeys, units));
    genericUtils.setProperty(itemData, 'flags.cat.automation.metric', true);
    return itemData;
}
/**
 * Convert an enchantment's range changes from feet to the enchanted item's range units.
 * @param {object} effectData Effect data, changed in place.
 * @param {Item5e} item Item being enchanted.
 * @returns {object}
 */
function convertToItemUnits(effectData, item) {
    const units = item.system.range?.units;
    if (effectData.type !== 'enchantment' || !units || units === 'ft' || !(units in CONFIG.DND5E.movementUnits)) return effectData;
    convertEffectLengths(effectData, rangeKeys, units);
    return effectData;
}
/**
 * Point effect data at its origin, writing dnd5e's `system.origin` to match and replacing any copied from another effect.
 * @param {object} effectData Effect data to write into, which is mutated.
 * @param {string|object} origin The activity, item, effect or actor the effect comes from, or its uuid.
 * @returns {object} The same effect data.
 */
function setOrigin(effectData, origin) {
    if (typeof origin === 'string') origin = fromUuidSync(origin, {strict: false}) ?? origin;
    effectData.origin = origin?.uuid ?? origin;
    if (effectData.type === 'condition') return effectData;
    const item = origin?.documentName === 'Item' ? origin : origin?.item;
    const systemOrigin = {
        activity: origin?.documentName === 'Activity' ? origin.uuid : undefined,
        effect: origin?.documentName === 'ActiveEffect' ? origin.uuid : undefined,
        item: item?.uuid,
        actor: (origin?.documentName === 'Actor' ? origin : origin?.actor ?? item?.actor)?.uuid
    };
    genericUtils.setProperty(effectData, 'system.origin', Object.fromEntries(Object.entries(systemOrigin).filter(([, uuid]) => uuid)));
    return effectData;
}

/**
 * Coerce a value into an array. Splits comma-separated strings and unwraps any iterable.
 * @param {*} data Value to wrap. Arrays are returned as they are.
 * @returns {Array}
 */
function toArray(data) {
    if (data === undefined || data === null) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        if (data.includes(',')) return data.split(',').map(s => s.trim()).filter(Boolean);
        else return [data];
    }
    if (typeof data[Symbol.iterator] === 'function') return Array.from(data);
    return [data];
}
/**
 * Fetch information for evaluating roll formulas.
 * Type `cat.logFormulaData = true` in the console to view the collected data whenever this helper is called.
 * @param {object} options
 * @param {foundry.abstract.Document} [options.document]
 * @param {MidiQOL.Workflow} [options.workflow]
 * @param {foundry.documents.TokenDocument} [options.target]
 * @returns {object}
 */
function getFormulaData({document, target, workflow} = {}) {
    const context = {workflow, target};
    switch (document?.documentName) {
        case 'ActiveEffect': 
            context.effect = document;
            context.actor = document.actor;
            break;
        case 'Activity':
            context.activity = document;
            context.item = document.item;
            context.actor = document.actor;
            break;
        case 'Item':
            context.item = document;
            context.actor = document.actor;
            break;
        case 'Actor':
            context.actor = document;
            break; 
        case 'Token':
            context.token = document;
            context.actor = document.actor;
            break;
    }
    const data = getData(context);
    if (globalThis.cat.logFormulaData)
        Logging.log('INFO', `Formula Data (${document?.name ?? workflow?.item.name ?? target?.name})`, {context, data});
    return data;
}
// used locally only
function getData(context) {
    const originalData = context.workflow?.conditionData;
    const data = MidiQOL.createConditionData(context);
    if (originalData) context.workflow.conditionData = originalData;
    if (originalData?.target) data.target = originalData.target;
    if (!context.effect) return data;
    data.effect = context.effect;
    const source = effectUtils.getOriginSync(data.effect);
    if (source?.getRollData) data.effect.source = source.getRollData();
    const castData = effectUtils.getCastData(data.effect);
    if (!castData) return data;
    const scaling = data.effect.flags.dnd5e?.scaling ?? Math.max(0, castData.castLevel - castData.baseLevel);
    castData.scaling = new dnd5e.documents.Scaling(scaling);
    data.effect.castData = castData;
    return data;
}
function formulaField(options) {
    return new dnd5e.dataModels.fields.FormulaField(options);
}
function validateFormula(field, value) {
    if (!(field instanceof dnd5e.dataModels.fields.FormulaField) || !field.validate(value)) return true;
    genericUtils.notify('CAT.MEDKIT.Configuration.InvalidFormula', {type: 'error', format: {formula: value}});
    return false;
}
export default {
    setRules,
    setIdentifier,
    buildEffectData,
    setOrigin,
    toArray,
    getFormulaData,
    formulaField,
    validateFormula,
    convertItemToMetric,
    convertToItemUnits
};
