import {effectUtils, itemUtils} from './_module.mjs';

/**
 * Get the save DC of the activity, if a save, otherwise infer a save DC from the activity's ability, default 10.
 * @param {Activity} activity 
 * @returns {number}
 */
function getSaveDC(activity) {
    if (activity.type === 'save') return activity.save.dc.value;
    return activity.actor.system.abilities[activity.ability]?.dc ?? 10;
}

/**
 * Get save DC, cast & base levels flagged on the activity (if present, else -1 for the latter values).
 * @param {Activity} activity 
 * @returns {{castLevel: number; baseLevel: number; saveDC: number}}
 */
function getSavedCastData(activity) {
    return {
        castLevel: activity.flags.cat?.castData?.castLevel ?? -1,
        baseLevel: activity.flags.cat?.castData?.baseLevel ?? -1,
        saveDC: getSaveDC(activity)
    };
}

/**
 * Get a set of status effect IDs which this activity may convey via its assigned Active Effects.
 * @param {Activity} activity 
 * @returns {Set<string>}
 */
function getConditions(activity) {
    let conditions = new Set();
    activity.effects.forEach(i => {
        if (!i.effect) return;
        const effectConditions = effectUtils.getConditions(i.effect);
        effectConditions.forEach(j => conditions.add(j));
    });
    if (activity._otherActivity) conditions = conditions.union(getConditions(activity._otherActivity));
    return conditions;
}

/**
 * @typedef {object} DamageData
 * @property {number|string} [number]       The number of dice to roll
 * @property {number|string} [denomination] How many faces on the dice
 * @property {number|string} [bonus]        What bonus to add to the roll
 */

/**
 * Get a new object of activity data with the existing activity's damage data partially replaced.
 * @param {Activity} activity               The activity to use as a base
 * @param {string|DamageData} formulaOrObj  What new damage to use 
 * @param {object} [options]                Additional Options
 * @param {string[]} [options.types]        What damage types to use (will use existing if not provided)
 * @param {number} [specificIndex]          Which index of damage parts to replace (defaults to 0)
 * @returns {object}
 */
function getDamageModifiedActivityData(activity, formulaOrObj, {types = [], specificIndex = 0} = {}) {
    const activityData = activity.toObject();
    const isHeal = activityData.type === 'heal';
    const isFormula = foundry.utils.getType(formulaOrObj) !== 'Object';
    const magicalBonus = activity.item?.system?.properties?.has('mgc') ? activity.item?.system?.magicalBonus || '' : '';
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
        if (types.length) activityData.damage.parts[specificIndex].types = types;
    }
    return activityData;
}

/**
 * Create an in-memory activity based on activity data & an item. Does not modify the item itself.
 * @param {object} activityData 
 * @param {Item} item 
 * @returns {Activity}
 */
function syntheticActivity(activityData, item) {
    const itemData = item.toObject();
    itemData.system.activities[activityData._id] = activityData;
    const newItem = itemUtils.syntheticItem(itemData, item.actor);
    return newItem.system.activities.get(activityData._id);
}

/**
 * Get the activity's duration data.
 * @param {Activity} activity 
 * @returns {object}
 */
function getEffectDuration(activity) {
    return activity.duration.getEffectData();
}

/**
 * Get the activity's duration in seconds.
 * @param {Activity} activity 
 * @returns {number|undefined}
 */
function getDuration(activity) {
    return getEffectDuration(activity).seconds;
}

/**
 * Get a set of the activity's "item use" consumption target IDs
 * @param {Activity} activity 
 * @returns {Set<string>}
 */
function getDependencies(activity) {
    const dependencies = new Set();
    const targets = activity.consumption?.targets ?? [];
    targets.forEach(target => {
        if (target.type === 'itemUses' && target.target) dependencies.add(target.target);
    });
    return dependencies;
}
export default {
    getSaveDC,
    getSavedCastData,
    getConditions,
    getDamageModifiedActivityData,
    syntheticActivity,
    getEffectDuration,
    getDuration,
    getDependencies
};