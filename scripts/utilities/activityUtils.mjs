import {effectUtils, itemUtils} from './_module.mjs';
function getSaveDC(activity) {
    if (activity.type === 'save') return activity.save.dc.value;
    return activity.actor.system.abilities[activity.ability]?.dc ?? 10;
}
function getSavedCastData(activity) {
    return {
        castLevel: activity.flags.cat?.castData?.castLevel ?? -1,
        baseLevel: activity.flags.cat?.castData?.baseLevel ?? -1,
        saveDC: getSaveDC(activity)
    };
}
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
            activityData.damage.parts[specificIndex] = {
                number: number,
                denomination: denomination,
                bonus: bonus + ' + @mod ' + (magicalBonus ? '+ ' + magicalBonus : '')
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
function syntheticActivity(activityData, item) {
    const itemData = item.toObject();
    itemData.system.activities[activityData._id] = activityData;
    const newItem = itemUtils.syntheticItem(itemData, item.actor);
    return newItem.system.activities.get(activityData._id);
}
function getEffectDuration(activity) {
    return activity.duration.getEffectData();
}
function getDuration(activity) {
    return getEffectDuration(activity).seconds;
}
export default {
    getSaveDC,
    getSavedCastData,
    getConditions,
    getDamageModifiedActivityData,
    syntheticActivity,
    getEffectDuration,
    getDuration
};