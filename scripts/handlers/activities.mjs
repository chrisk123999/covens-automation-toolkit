function hiddenActivities({activities, item}) {
    if (!item.system.activities.some(activity => activity.flags.cat?.hidden)) return;
    const dialogIds = new Set(activities.map(i => i.id));
    const validIds = new Set(item.system.activities.filter(activity => dialogIds.has(activity.id) && !activity.flags.cat?.hidden).map(activity => activity.id));
    const filteredActivities = activities.filter(a => validIds.has(a.id));
    activities.length = 0;
    activities.push(...filteredActivities);
}
export default {
    hiddenActivities
};