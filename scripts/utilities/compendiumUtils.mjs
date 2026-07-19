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
async function getDocumentByIdentifier(packId, identifier) {
    const pack = game.packs.get(packId);
    if (!pack) return;
    const index = await pack.getIndex({fields: ['system.identifier', 'flags.cat.automation.identifier']});
    const found = index.find(i => i.system.identifier === identifier || i.flags.cat?.automation?.identifier === identifier);
    if (!found) return;
    return await fromUuid(found.uuid);
}
async function getDocumentByName(packId, name) {
    const pack = game.packs.get(packId);
    if (!pack) return;
    const index = await pack.getIndex();
    const found = index.find(i => i.name === name);
    if (!found) return;
    return await fromUuid(found.uuid);
}
export default {
    selectFromCompendiumBrowser,
    getDocumentByIdentifier,
    getDocumentByName
};