function getSaveDC(activity) {
    if (activity.type === 'save') return activity.save.dc.value;
    return activity.actor.system.abilities[activity.ability]?.dc ?? 10;
}
function getSavedCastData(activity) {
    return {
        castLevel: document.flags?.cat?.castData?.castLevel ?? -1,
        baseLevel: document.flags?.cat?.castData?.baseLevel ?? -1,
        saveDC: getSaveDC(document)
    };
}
export const activityUtils = {
    getSaveDC,
    getSavedCastData
};