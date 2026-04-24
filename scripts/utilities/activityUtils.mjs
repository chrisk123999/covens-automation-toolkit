import {effectUtils} from './_module.mjs';
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
export default {
    getSaveDC,
    getSavedCastData,
    getConditions
};