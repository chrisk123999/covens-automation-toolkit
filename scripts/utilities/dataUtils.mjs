/**
 * Builders for document and effect data before creation, metric conversion, and roll data for formulas.
 * @module
 */
import {effectUtils, genericUtils} from './_module.mjs';
import {Logging} from '../lib/_module.mjs';
/**
 * Write a rules edition onto document data, in place, where {@link documentUtils.getRules} reads it:
 * `system.source.rules` for an item, `flags.cat.automation.rules` otherwise. Nothing is saved.
 * @param {object | foundry.abstract.Document} documentData  Document or document data to write the rules onto.
 * @param {'2024' | '2014'} rules                            Rules edition to set.
 * @param {object} [options]                                 Additional options.
 * @param {string} [options.documentType]                    Document type of the data, such as `Item`.
 * @example
 * dataUtils.setRules(effectData, '2024');
 */
function setRules(documentData, rules, {documentType} = {}) {
    genericUtils.setProperty(documentData, documentType === 'Item' ? 'system.source.rules' : 'flags.cat.automation.rules', rules);
}
/**
 * Write an identifier onto document data, in place, where {@link documentUtils.getIdentifier} reads it:
 * `system.identifier` for an item, `identifier` for an activity, `flags.cat.identifier` otherwise. Nothing is saved.
 * @param {object | foundry.abstract.Document} documentData  Document or document data to write the identifier onto.
 * @param {string} identifier                                Identifier macros will look this document up by.
 * @param {object} [options]                                 Additional options.
 * @param {string} [options.documentType]                    Document type of the data, such as `Item` or `Activity`.
 * @example
 * dataUtils.setIdentifier(effectData, 'hexed');
 */
function setIdentifier(documentData, identifier, {documentType} = {}) {
    const path = {Item: 'system.identifier', Activity: 'identifier'}[documentType] ?? 'flags.cat.identifier';
    genericUtils.setProperty(documentData, path, identifier);
}
/**
 * @typedef {object} MacroEntry
 * @property {string} identifier  Identifier of the registered macro.
 * @property {string} rules       Rules edition of the registered macro.
 * @property {string} source      Module id that registered the macro.
 */
/**
 * @typedef {object} MacroGroup
 * @property {string} type          Macro pass type the entries are stored under, such as `effect`.
 * @property {MacroEntry[]} macros  Macros of this type.
 */
/**
 * @typedef {object} AnimationEntry
 * @property {string} identifier  Identifier of the registered animation.
 * @property {string} source      Module id that registered the animation.
 */
/**
 * @typedef {object} VaeEntry
 * @property {'use'} type                   Button action. `use` uses an item or activity.
 * @property {string} name                  Button label.
 * @property {string} itemIdentifier        Identifier of the item on the effect's actor to use.
 * @property {string} [activityIdentifier]  Identifier of the activity to use. The item is used when absent.
 */
/**
 * @typedef {object} CatEffectData
 * @property {MacroGroup[]} macros                     Merge the list into existing macros.
 * @property {MacroGroup[]} removeMacros               Remove macros that match all provided `MacroEntry` properties.
 * @property {AnimationEntry} createAnimation          Animation played when the effect is created.
 * @property {AnimationEntry} deleteAnimation          Animation played when the effect is deleted.
 * @property {object} createAnimationOptions           Options specific to a particular animation, such as color. If
 *                                                     absent, defaults are fetched from the registered animation.
 * @property {object} deleteAnimationOptions           Options specific to a particular animation, such as color. If
 *                                                     absent, defaults are fetched from the registered animation.
 * @property {string[]} specialDuration                Deletes effect. Keys registered with DAE, such as midi-qol's
 *                                                     `1Attack`, are written to DAE's flag.
 * @property {string[]} disableCondition               Disables effect while the actor has one of these statuses or
 *                                                     equipment types equipped. `combatTurn` disables it outside the
 *                                                     actor's turn.
 * @property {string[]} unhideActivities               Identifiers of activities on the origin activity's item, shown
 *                                                     while the effect exists.
 * @property {boolean} favoriteActivities              Also favorite the activities named by `unhideActivities`.
 * @property {VaeEntry[]} vae                          Buttons shown on the effect in Visual Active Effects.
 * @property {'2014'|'2024'|'all'} rules               Rules edition, written with {@link setRules}.
 * @property {object} copyConfigs                      Duplicate macro configurations from another document onto this
 *                                                     effect.
 * @property {foundry.abstract.Document} parentEntity  A dependent parent for this effect.
 * @property {string} activityUuid                     The activity this effect came from, so later macros can trace it
 *                                                     back.
 */
/**
 * Add CAT flags to effect data before creation, in place. An `origin` already on the data is also written to
 * `system.origin` with {@link setOrigin}. With the system's metric setting on, movement and sense changes in feet are
 * converted to meters.
 * @param {object} effectData        Effect data to build on, which is mutated and returned.
 * @param {CatEffectData} [options]  CAT effect settings to apply.
 * @returns {object}                 The same effect data.
 * @example
 * dataUtils.buildEffectData(effectData, {rules: '2024', specialDuration: ['turnStart'], parentEntity: concentrationEffect});
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
 * @param {*} value  Value to test.
 * @returns {boolean}
 */
function isPlainNumber(value) {
    return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value));
}
/**
 * Convert a length in feet to other units, keeping a string a string.
 * @param {number|string} value  Length in feet.
 * @param {string} units         Units converted to.
 * @returns {number|string}
 */
function convertValue(value, units) {
    const converted = dnd5e.utils.convertLength(Number(value), 'ft', {to: units || 'ft', legacy: false}).value;
    return typeof value === 'string' ? String(converted) : converted;
}
/**
 * Convert an effect's plain-number length changes from feet, flagging it so it never converts twice.
 * @param {object} effectData  Effect data, changed in place.
 * @param {RegExp} keys        Change keys to convert.
 * @param {string} units       Units converted to.
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
 * @param {object} data    Range or area data, changed in place.
 * @param {string[]} keys  Fields to convert.
 * @param {string} units   Units converted to.
 */
function convertFields(data, keys, units) {
    if (data?.units !== 'ft') return;
    const values = keys.filter(key => data[key] !== null && data[key] !== undefined && data[key] !== '');
    if (!values.every(key => isPlainNumber(data[key]))) return;
    values.forEach(key => data[key] = convertValue(data[key], units));
    data.units = units;
}
/**
 * Convert item data from feet to meters when the system's metric setting is on. Covers the item's range, reach and
 * area, each activity's range and area, and movement and sense changes on its effects. Only fields in feet with plain
 * numbers are converted, and data already flagged as converted is skipped.
 * @param {object} itemData  Item data, changed in place.
 * @returns {object}         The same item data.
 * @example
 * const itemData = dataUtils.convertItemToMetric(item.toObject());
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
 * Convert an enchantment's range and reach changes from feet to the enchanted item's range units. Other effect types,
 * and items using feet or units that aren't lengths, are left alone.
 * @param {object} effectData  Effect data, changed in place.
 * @param {Item5e} item        Item being enchanted.
 * @returns {object}           The same effect data.
 * @example
 * dataUtils.convertToItemUnits(enchantmentData, weapon);
 */
function convertToItemUnits(effectData, item) {
    const units = item.system.range?.units;
    if (effectData.type !== 'enchantment' || !units || units === 'ft' || !(units in CONFIG.DND5E.movementUnits)) return effectData;
    convertEffectLengths(effectData, rangeKeys, units);
    return effectData;
}
/**
 * Point effect data at its origin. Writes the system's `system.origin` to match, replacing any copied from another
 * effect. Conditions only get `origin`.
 * @param {object} effectData     Effect data to write into, which is mutated.
 * @param {string|object} origin  The activity, item, effect or actor the effect comes from, or its uuid.
 * @returns {object}              The same effect data.
 * @example
 * dataUtils.setOrigin(effectData, workflow.activity);
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
 * Coerce a value into an array. Comma-separated strings are split and trimmed, and any other iterable is spread. Arrays
 * are returned as they are, and `null` or undefined become an empty array.
 * @param {*} data  Value to wrap.
 * @returns {Array}
 * @example
 * dataUtils.toArray('fire, cold'); // ['fire', 'cold']
 * dataUtils.toArray(undefined); // []
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
 * Build roll data for evaluating formulas, from midi-qol's condition data. An active effect adds itself under
 * `@effect`, with its origin's roll data under `@effect.source` and its cast data under `@effect.castData`. Set
 * `cat.logFormulaData = true` in the console to log the data on every call.
 * @param {object} options                                    Data sources.
 * @param {foundry.abstract.Document} [options.document]      Active effect, activity, item, actor or token supplying
 *                                                            roll data.
 * @param {MidiQOL.Workflow} [options.workflow]               Adds workflow data.
 * @param {foundry.documents.TokenDocument} [options.target]  Adds target data.
 * @returns {object}
 * @example
 * const total = new Roll('1d6 + @mod', dataUtils.getFormulaData({document: activity, workflow})).evaluateSync().total;
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
/**
 * Build midi-qol condition data for a context, adding the effect's source roll data and cast data.
 * @param {object} context  Workflow, document, effect and target to build from.
 * @returns {object}
 */
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
/**
 * Create the system's formula field.
 * @param {object} [options]  Field options.
 * @returns {dnd5e.dataModels.fields.FormulaField}
 * @example
 * const field = dataUtils.formulaField({deterministic: true});
 */
function formulaField(options) {
    return new dnd5e.dataModels.fields.FormulaField(options);
}
/**
 * Validate a value against a formula field. An invalid formula shows an error notification.
 * @param {foundry.data.fields.DataField} field  Field to validate against. Non-formula fields always pass.
 * @param {string} value                         Formula to check.
 * @returns {boolean}                            Whether the value is valid.
 * @example
 * if (!dataUtils.validateFormula(field, formula)) return;
 */
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
