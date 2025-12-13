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
export const activityUtils = {
    getSaveDC,
    getSavedCastData
};