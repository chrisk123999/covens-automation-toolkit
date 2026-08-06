import {CatCompendiumBrowser} from '../applications/_module.mjs';
import {genericUtils} from './_module.mjs';
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
async function getDocumentByIdentifier(packId, identifier, {object = false, description, translate, flatAttack, flatDC} = {}) {
    console.log(packId, identifier);
    const pack = game.packs.get(packId);
    console.log(pack);
    if (!pack) return;
    const index = await pack.getIndex({fields: ['system.identifier', 'flags.cat.identifier']});
    const found = index.find(i => i.system.identifier === identifier || i.flags.cat?.identifier === identifier);
    if (!found) return;
    if (object) {
        const document = await fromUuid(found.uuid);
        const documentData = document.toObject();
        if (description) documentData.system.description.value = description;
        if (translate) {
            documentData.name = _loc(translate);
            documentData.effects?.forEach(effectData => {
                effectData.name = _loc(translate);
            });
        }
        let activities = documentData.system.activities;
        if (flatAttack) { // I haven't tested these in v14 just copy/pasted
            let activityIds = Object.entries(activities).filter(i => i[1].type === 'attack').map(i => i[0]);
            for (let activityId of activityIds) {
                genericUtils.setProperty(documentData, 'system.activities.' + activityId + '.attack.flat', true);
                genericUtils.setProperty(documentData, 'system.activities.' + activityId + '.attack.bonus', flatAttack);
            }
        }
        if (flatDC) {
            let activityIds = Object.entries(activities).filter(i => i[1].type === 'save').map(i => i[0]);
            for (let activityId of activityIds) {
                genericUtils.setProperty(documentData, 'system.activities.' + activityId + '.save.dc', {
                    calculation: '',
                    formula: flatDC.toString(),
                    value: flatDC
                });
            }
        }
        return documentData;
    }
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