import {CatCompendiumBrowser} from '../applications/_module.mjs';
async function selectFromCompendiumBrowser(tab, {packIds, filterPredicate, filters, selection, title, hint, icon, position} = {}) {
    const options = {
        tab,
        allowedPacks: packIds,
        filterPredicate,
        customFilters: filters,
        selection,
        hint,
        position
    };
    if (title || icon) {
        options.window = {};
        if (title) options.window.title = title;
        if (icon) options.window.icon = icon;
    }
    const results = await CatCompendiumBrowser.select(options);
    if (!results?.size) return;
    return (await Promise.all(Array.from(results).map(uuid => fromUuid(uuid)))).filter(Boolean);
}
export default {
    selectFromCompendiumBrowser
};