function hiddenActivities({activities, item}) {
    if (!item.system.activities.some(activity => activity.flags.cat?.hidden)) return;
    const dialogIds = new Set(activities.map(i => i.id));
    const validIds = new Set(item.system.activities.filter(activity => dialogIds.has(activity.id) && !activity.flags.cat?.hidden).map(activity => activity.id));
    const filteredActivities = activities.filter(a => validIds.has(a.id));
    activities.length = 0;
    activities.push(...filteredActivities);
}
function tidyActivitiesForPlay(item, data) {
    if (!game.settings.get('cat', 'hideActivitiesOnActorSheet')) return;
    data.activities = data.activities.filter(activity => !activity.flags.cat?.hidden);
}
const observedSheets = new WeakSet();
function markRows(document, element, hide) {
    let iconSize;
    element.querySelectorAll('[data-activity-id]').forEach(row => {
        const item = document.documentName === 'Item' ? document : document.items?.get(row.closest('[data-item-id]')?.dataset.itemId);
        if (!item?.system.activities?.get(row.dataset.activityId)?.flags.cat?.hidden) return;
        row.classList.add('cat-hidden-activity');
        row.hidden = hide;
        if (hide || row.querySelector('.cat-hidden-activity-icon')) return;
        const image = row.querySelector('.activity-name .item-image, .tidy-table-row-use-button .item-image');
        if (!image) return;
        const tooltip = _loc('CAT.MEDKIT.Activity.Hidden.Badge');
        iconSize ??= getComputedStyle(image).width;
        image.insertAdjacentHTML('afterend', `<i class="fa-solid fa-shield-cat cat-hidden-activity-icon" style="--cat-icon-size: ${iconSize};" data-tooltip="${tooltip}"></i>`);
        image.closest('.tidy-table-row-use-button')?.setAttribute('data-tooltip', tooltip);
    });
}
function markHiddenActivities(app, element) {
    const document = app.document;
    if (!document) return;
    const update = () => {
        const hide = document.documentName === 'Actor' && game.settings.get('cat', 'hideActivitiesOnActorSheet');
        if (hide || game.user.isGM) markRows(document, element, hide);
    };
    update();
    if (!element.classList.contains('tidy5e-sheet') || observedSheets.has(element)) return;
    observedSheets.add(element);
    let queued = false;
    const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            update();
            observer.takeRecords();
        });
    });
    observer.observe(element, {childList: true, subtree: true});
}
export default {
    hiddenActivities,
    markHiddenActivities,
    tidyActivitiesForPlay
};