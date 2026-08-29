import {CatCompendiumBrowser} from '../applications/_module.mjs';
import {genericUtils} from './_module.mjs';
async function selectFromCompendiumBrowser(tab, {packIds, filterPredicate, filters, lockedFilters, exceptions, minAmount = 1, maxAmount, title, hint, icon, position} = {}) {
    const options = {
        tab,
        exceptions,
        allowedPacks: packIds,
        filterPredicate,
        customFilters: filters,
        selection: {min: minAmount, max: maxAmount},
        hint,
        position
    };
    if (title || icon) {
        options.window = {};
        if (title) options.window.title = title;
        if (icon) options.window.icon = icon;
    }
    if (lockedFilters) genericUtils.setProperty(options, 'filters.locked', lockedFilters);
    const results = await CatCompendiumBrowser.select(options);
    if (!results?.size) return;
    return (await Promise.all(Array.from(results).map(uuid => fromUuid(uuid)))).filter(Boolean);
}
async function getDocumentByIdentifier(packId, identifier, {object = false, description, translate, flatAttack, flatDC} = {}) {
    const pack = game.packs.get(packId);
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
/**
 * Open the compendium browser for a choice of spell from the provided classes.
 * Spells are collected from the spell compendiums configured in settings.
 * Spell lists are taken from the DND5E registry.
 * @param {string[]} listKeys Class list keys in the form 'type:identifier'. Allowed types are defined in CONFIG.DND5E.spellListTypes.
 * @param {object} [options]
 * @param {string} [options.icon]
 * @param {string} [options.title]
 * @param {object[]} [options.filters] Additional filters, see dnd5e.Filter.
 * @param {number} [options.amount] The number of spells that can be chosen.
 * @param {number} [options.minLevel] The minimum spell level offered as an option.
 * @param {number} [options.maxLevel] The maxmium spell level offered as an option.
 * @param {string[]} [options.exceptions] Item identifiers for spells that should be offered despite failing other filters.
 * @returns {Promise<>}
 */
async function getSpellFromLists(listKeys, {amount = 1, minLevel, maxLevel, exceptions, filters, icon, title = 'CAT.CompendiumBrowser.Title'} = {}) {
    const labels = [];
    const validKeys = [];
    for (const key of listKeys) {
        const label = dnd5e.registry.spellLists.options.find(o => o.value === key)?.label;
        if (!label) continue;
        labels.push(label);
        validKeys.push(key);
    }
    if (!validKeys.length) return;
    const packIds = Object.entries(game.settings.get('cat', 'spellCompendiums'))
        .filter(s => s[1].enabled)
        .map(s => s[0]);
    const lockedFilters = {additional: {spelllist: validKeys.reduce((obj, key) => (obj[key] = 1, obj), {})}};
    if (Number.isInteger(minLevel)) genericUtils.setProperty(lockedFilters, 'additional.level.min', minLevel);
    if (Number.isInteger(maxLevel)) genericUtils.setProperty(lockedFilters, 'additional.level.max', maxLevel);
    const result = await selectFromCompendiumBrowser('spells', {
        hint: _loc('CAT.CompendiumBrowser.SpellPicker', {lists: labels.join(', ')}),
        maxAmount: amount,
        lockedFilters,
        exceptions,
        filters,
        packIds,
        title,
        icon
    });
    return result;
}
export default {
    selectFromCompendiumBrowser,
    getDocumentByIdentifier,
    getDocumentByName,
    getSpellFromLists
};