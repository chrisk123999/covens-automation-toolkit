/**
 * Activity reads and data copies: save DCs, cast data, conditions, damage, ranges, durations and consumption.
 * @module
 */
import {distanceUtils, documentUtils, effectUtils, itemUtils} from './_module.mjs';
/** @import {EffectDurationData} from '@client/documents/_types.mjs' */

/**
 * The activity's save DC. Activities other than saves use the DC of the actor's ability for the activity, and `10` when
 * the activity has no ability.
 * @param {Activity} activity  Activity to read from.
 * @returns {number}
 * @example
 * const saveDC = activityUtils.getSaveDC(workflow.activity);
 */
function getSaveDC(activity) {
    if (activity.type === 'save') return activity.save.dc.value;
    return activity.actor.system.abilities[activity.ability]?.dc ?? 10;
}

/**
 * The cast data stashed on the activity. Cast and base level are `-1` when nothing is stashed, and the save DC comes
 * from {@link getSaveDC}.
 * @param {Activity} activity  Activity to read from.
 * @returns {{castLevel: number, baseLevel: number, saveDC: number, school: string|undefined}}
 * @example
 * const {castLevel, baseLevel} = activityUtils.getSavedCastData(activity);
 */
function getSavedCastData(activity) {
    return {
        castLevel: activity.flags.cat?.castData?.castLevel ?? -1,
        baseLevel: activity.flags.cat?.castData?.baseLevel ?? -1,
        saveDC: getSaveDC(activity),
        school: activity.flags.cat?.castData?.school
    };
}

/**
 * The status effect ids this activity can apply. Covers the conditions in its effects, midi-qol's activity statuses,
 * and the conditions of its linked `otherActivity`.
 * @param {Activity} activity  Activity to read from.
 * @returns {Set<string>}
 * @example
 * if (activityUtils.getConditions(workflow.activity).has('frightened')) return;
 */
function getConditions(activity) {
    return new Set([...getEffectConditions(activity), ...activity.midiProperties.statuses.map(status => status.id), ...(activity.otherActivity ? getConditions(activity.otherActivity) : [])]);
}
/**
 * Status effect IDs conveyed by this activity's own effects.
 * @param {Activity} activity  Activity to read from.
 * @returns {Set<string>}
 */
function getEffectConditions(activity) {
    const conditions = new Set();
    activity.effects.forEach(i => {
        const effect = activity.item.effects.get(i._id);
        if (!effect) return;
        effectUtils.getConditions(effect).forEach(j => conditions.add(j));
    });
    return conditions;
}

/**
 * @typedef {object} DamageData
 * @property {number|string} [number]        The number of dice to roll
 * @property {number|string} [denomination]  How many faces on the dice
 * @property {number|string} [bonus]         What bonus to add to the roll
 */

/**
 * Copy the activity's data with one damage or healing part replaced. A formula string, or a part that already uses a
 * custom formula, is written as a custom formula. When the activity only includes the item's base damage, that base
 * becomes a real part with `@mod` and the item's magical bonus added. Otherwise a missing part at `specificIndex` is
 * added.
 * @param {Activity} activity               Activity to copy.
 * @param {string|DamageData} formulaOrObj  New formula, or new dice and bonus.
 * @param {object} [options]                Additional options.
 * @param {string[]} [options.types]        New damage or healing types. The existing types are kept when empty.
 * @param {number} [options.specificIndex]  Index of the damage part to replace. Defaults to `0`.
 * @returns {object}                        Activity data, for {@link syntheticActivity} or a synthetic roll.
 * @example
 * const activityData = activityUtils.getDamageModifiedActivityData(activity, '2d8', {types: ['radiant']});
 */
function getDamageModifiedActivityData(activity, formulaOrObj, {types = [], specificIndex = 0} = {}) {
    const activityData = activity.toObject();
    const isHeal = activityData.type === 'heal';
    const isFormula = foundry.utils.getType(formulaOrObj) !== 'Object';
    const magicalBonus = activity.item?.system?.magicAvailable ? activity.item.system.magicalBonus || '' : '';
    let formula, number, denomination, bonus;
    if (isFormula) {
        formula = formulaOrObj;
    } else {
        number = formulaOrObj.number;
        denomination = formulaOrObj.denomination;
        bonus = formulaOrObj.bonus ?? '';
        formula = '';
        if (number && denomination) formula += number + 'd' + denomination;
        if (bonus) formula += ' + ' + bonus;
    }
    if (isHeal) {
        const isCustom = activityData.healing.custom.enabled;
        if (isCustom || isFormula) {
            if (formula?.toString()?.length) activityData.healing.custom = {
                enabled: true,
                formula: formula.toString()
            };
        } else {
            activityData.healing.number = number;
            activityData.healing.denomination = denomination;
            activityData.healing.bonus = bonus;
        }
        if (types.length) activityData.healing.types = types;
    } else {
        if (activityData.damage.includeBase && !activityData.damage.parts[specificIndex]) {
            activityData.damage.includeBase = false;
            const base = activity.item?.system?.damage?.base ?? {};
            const baseBonus = isFormula ? (base.bonus ?? '') : (bonus ?? '');
            activityData.damage.parts[specificIndex] = {
                number: number ?? base.number,
                denomination: denomination ?? base.denomination,
                bonus: [baseBonus, '@mod', magicalBonus].filter(Boolean).join(' + ')
            };
        }
        else if (activityData.damage.parts[specificIndex]) {
            const isCustom = activityData.damage.parts[specificIndex].custom.enabled;
            if (isCustom || isFormula) {
                if (formula?.toString()?.length) activityData.damage.parts[specificIndex].custom = {
                    enabled: true,
                    formula: formula.toString()
                };
            } else {
                activityData.damage.parts[specificIndex].number = number;
                activityData.damage.parts[specificIndex].denomination = denomination;
                activityData.damage.parts[specificIndex].bonus = bonus;
            }
        }
        else {
            activityData.damage.parts[specificIndex] = isFormula ? {custom: {enabled: true, formula: formula.toString()}} : {number, denomination, bonus};
        }
        if (types.length) activityData.damage.parts[specificIndex].types = types;
    }
    return activityData;
}

/**
 * Copy the activity's data with one consumption target's amount replaced.
 * @param {Activity} activity               Activity to copy.
 * @param {number|string} value             New amount, stored as a string.
 * @param {object} [options]                Additional options.
 * @param {number} [options.specificIndex]  Index of the consumption target to replace. Defaults to `0`.
 * @returns {object|undefined}              Activity data. Undefined when the activity has no consumption target at that
 *                                          index.
 * @example
 * const activityData = activityUtils.getConsumptionModifiedActivityData(activity, 2);
 */
function getConsumptionModifiedActivityData(activity, value, {specificIndex = 0} = {}) {
    const activityData = activity.toObject();
    if (!activityData.consumption?.targets?.[specificIndex]) return;
    activityData.consumption.targets[specificIndex].value = String(value);
    return activityData;
}

/**
 * Copy the activity's data with its save DC replaced by a flat formula.
 * @param {Activity} activity   Activity to copy.
 * @param {number|string} dc    New save DC.
 * @returns {object|undefined}  Activity data. Undefined when the activity has no save.
 * @example
 * const activityData = activityUtils.getSaveDCModifiedActivityData(activity, itemUtils.getSaveDC(item));
 */
function getSaveDCModifiedActivityData(activity, dc) {
    const activityData = activity.toObject();
    if (!activityData.save) return;
    activityData.save.dc = {calculation: '', formula: String(dc)};
    return activityData;
}

/**
 * Copy the activity's data with its check DC replaced by a flat formula.
 * @param {Activity} activity   Activity to copy.
 * @param {number|string} dc    New check DC.
 * @returns {object|undefined}  Activity data. Undefined when the activity has no check.
 * @example
 * const activityData = activityUtils.getCheckDCModifiedActivityData(activity, 15);
 */
function getCheckDCModifiedActivityData(activity, dc) {
    const activityData = activity.toObject();
    if (!activityData.check) return;
    activityData.check.dc = {calculation: '', formula: String(dc)};
    return activityData;
}

/**
 * Build an in-memory activity from activity data, on an in-memory copy of the item. The item itself is not changed.
 * @param {object} activityData  Activity data. Its `_id` decides which activity it adds or replaces.
 * @param {Item} item            Item the activity belongs to.
 * @returns {Activity}
 * @example
 * const activityData = activityUtils.getDamageModifiedActivityData(activity, '3d6');
 * const synthetic = activityUtils.syntheticActivity(activityData, activity.item);
 */
function syntheticActivity(activityData, item) {
    const itemData = item.toObject();
    itemData.system.activities[activityData._id] = activityData;
    const newItem = itemUtils.syntheticItem(itemData, item.actor);
    return newItem.system.activities.get(activityData._id);
}

/**
 * The activity's duration as effect duration data, from the system's `getEffectData`.
 * @param {Activity} activity  Activity to read from.
 * @returns {EffectDurationData}
 * @example
 * const effectData = documentUtils.getEffectData(item, effectId, {duration: activityUtils.getEffectDuration(workflow.activity)});
 */
function getEffectDuration(activity) {
    return activity.duration.getEffectData();
}

/**
 * The activity's duration in seconds, converted with {@link effectUtils.durationToSeconds}. Undefined for open-ended
 * durations.
 * @param {Activity} activity  Activity to read from.
 * @returns {number|undefined}
 * @example
 * activityUtils.getDuration(activity); // 60 for a 1 minute duration
 */
function getDuration(activity) {
    return effectUtils.durationToSeconds(getEffectDuration(activity));
}

/**
 * The activity's maximum range in feet. Feet and meter ranges use midi-qol's range check, which prefers the long range.
 * Touch ranges use the item's reach. Undefined for units that aren't lengths, such as `self`.
 * @param {Activity} activity              Activity to read from.
 * @param {object} [options]               Additional options.
 * @param {TokenDocument} [options.token]  Token measuring from. Defaults to the activity's actor.
 * @returns {number|undefined}
 * @example
 * const range = activityUtils.getRange(activity, {token: workflow.token.document});
 */
function getRange(activity, {token} = {}) {
    const {value, units} = activity.range ?? {};
    if (units === 'touch') return itemUtils.getRange(activity.item).reach;
    if (['ft', 'm'].includes(units)) {
        const {range, longRange} = MidiQOL.checkActivityRange(activity, token ?? activity.actor, [], false);
        if (range !== undefined) return distanceUtils.lengthToFeet(longRange || range, units);
    }
    return distanceUtils.lengthToFeet(value, units);
}
/**
 * The size of the activity's area in feet. Undefined when the activity has no area.
 * @param {Activity} activity  Activity to read from.
 * @returns {number|undefined}
 * @example
 * activityUtils.getTemplateSize(activity); // 20 for a 20 ft radius sphere
 */
function getTemplateSize(activity) {
    const {size, units} = activity.target?.template ?? {};
    return distanceUtils.lengthToFeet(size, units);
}

/**
 * The ids of the items whose uses this activity consumes.
 * @param {Activity} activity  Activity to read from.
 * @returns {Set<string>}
 * @example
 * const usesItem = actor.items.get(activityUtils.getDependencies(activity).first());
 */
function getDependencies(activity) {
    const dependencies = new Set();
    const targets = activity.consumption?.targets ?? [];
    targets.forEach(target => {
        if (target.type === 'itemUses' && target.target) dependencies.add(target.target);
    });
    return dependencies;
}

/**
 * The uses this activity restores through consumption targets with a negative cost. Only item uses and spell slots are
 * returned.
 * @param {Activity} activity                             Activity to read from.
 * @returns {{document: Item5e|Actor5e, uses: object}[]}  Item uses resolve to the item, spell slots to the actor and
 *                                                        its slot data.
 * @example
 * const [{document, uses}] = activityUtils.getRecoveryPools(activity);
 */
function getRecoveryPools(activity) {
    const targets = activity.consumption?.targets ?? [];
    return targets.filter(target => target.resolveCost({evaluate: false}).evaluateSync({minimize: true, strict: false}).total < 0).map(target => {
        if (target.type === 'itemUses') {
            const item = target.target ? activity.actor?.items.get(target.target) : activity.item;
            if (item) return {document: item, uses: item.system.uses};
        } else if (target.type === 'spellSlots') {
            const slots = activity.actor?.system.spells?.[CONFIG.DND5E.spellcasting.spell.getSpellSlotKey(target.resolveLevel())];
            if (slots) return {document: activity.actor, uses: slots};
        }
    }).filter(Boolean);
}

/**
 * Whether the activity still uses its type's default icon.
 * @param {dnd5e.documents.activity.Activity} activity  Activity to read from.
 * @returns {boolean}
 */
function hasDefaultIcon(activity) {
    return activity.img === activity.constructor.metadata.img;
}

/**
 * Whether the activity still uses its type's default name.
 * @param {dnd5e.documents.activity.Activity} activity  Activity to read from.
 * @returns {boolean}
 */
function hasDefaultName(activity) {
    return activity.name === _loc(activity.constructor.metadata.title);
}

/**
 * The damage rolls the activity would produce, before any workflow changes. By default like dice terms are combined and
 * a leading `+` is dropped.
 * @param {dnd5e.dataModels.activity.BaseActivityData} activity  Activity to read from.
 * @param {object} [options]                                     Additional options.
 * @param {'oneHanded'|'twoHanded'|'offhand'|'ranged'|'thrown'|'thrown-offhand'} [options.attackMode]
 *                                                               A key from `CONFIG.DND5E.attackModes`.
 * @param {number} [options.scaling]                             Scaling steps applied before the damage is read.
 *                                                               Defaults to `0`.
 * @param {boolean} [options.simplify]                           Combine like dice terms, respecting damage type and
 *                                                               properties. Defaults to `true`.
 * @returns {dnd5e.dice.DamageRoll[]}                            Unevaluated damage rolls.
 * @example
 * const formula = activityUtils.getDefaultDamageRolls(activity, {attackMode: 'twoHanded'})[0]?.formula;
 */
function getDefaultDamageRolls(activity, {attackMode, scaling = 0, simplify = true} = {}) {
    const data = activity.getDamageConfig({attackMode, scaling}).rolls;
    if (!simplify) return data.map(d => CONFIG.Dice.DamageRoll.fromConfig(d, {}));
    const rolls = dnd5e.dice.aggregateDamageRolls(data.map(d => {
        const formula = dnd5e.dice.simplifyRollFormula(d.parts.join(' + '));
        return new CONFIG.Dice.DamageRoll(formula, d.data, d.options);
    }), {respectProperties: true});
    rolls.forEach(r => {
        if (!(r.terms[0] instanceof foundry.dice.terms.OperatorTerm)) return;
        if (r.terms[0].operator !== '+') return;
        r.terms.shift();
        r.resetFormula();
    });
    return rolls;
}

/**
 * Point a cast activity at a different copy of its spell, by updating `spell.uuid` through
 * {@link documentUtils.update}.
 * @param {dnd5e.dataModels.activity.BaseActivityData} activity  Cast activity to update.
 * @param {foundry.documents.Item} spell                         Spell the activity should cast.
 * @returns {Promise<foundry.abstract.Document|undefined>}
 * @example
 * await activityUtils.correctSpellLink(castActivity, actor.items.getName('Fireball'));
 */
async function correctSpellLink(activity, spell) {
    return await documentUtils.update(activity, {'spell.uuid': spell.uuid});
}

/**
 * Whether the actor can pay every consumption cost on the activity. Activities without costs return true.
 * @param {dnd5e.dataModels.activity.BaseActivityData} activity  Activity to check.
 * @param {number} [scaling]                                     Scaling steps to check the costs at.
 * @returns {boolean}
 * @example
 * if (!activityUtils.checkCosts(activity)) return;
 */
function checkCosts(activity, scaling) {
    return !activity.consumption.targets.some(c => c.getConsumptionLabels({scaling}, {consume: true}).warn);
}
export default {
    getSaveDC,
    getSavedCastData,
    getConditions,
    getDamageModifiedActivityData,
    getConsumptionModifiedActivityData,
    getSaveDCModifiedActivityData,
    getCheckDCModifiedActivityData,
    syntheticActivity,
    getEffectDuration,
    getDuration,
    getRange,
    getTemplateSize,
    getDependencies,
    getRecoveryPools,
    hasDefaultIcon,
    hasDefaultName,
    getDefaultDamageRolls,
    correctSpellLink,
    checkCosts
};
