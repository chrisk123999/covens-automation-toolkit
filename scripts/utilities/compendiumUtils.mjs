import {CatCompendiumBrowser} from '../applications/_module.mjs';
import {genericUtils} from './_module.mjs';
async function selectFromCompendiumBrowser(tab, {packIds, filterPredicate, filters, lockedFilters, exceptionIdentifiers, exceptionUuids, minAmount = 1, maxAmount, title, hint, icon, position} = {}) {
    const options = {
        tab,
        exceptionUuids,
        exceptionIdentifiers,
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
function makeBrowserFilter(list, include = true) {
    return list.reduce((obj, key) => (obj[key] = include ? 1 : -1, obj), {});
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
async function selectSpellFromLists(listKeys, {amount = 1, minLevel, maxLevel, exceptions, filters, icon, title = 'CAT.CompendiumBrowser.Title'} = {}) {
    const packIds = Object.entries(game.settings.get('cat', 'spellCompendiums'))
        .filter(s => s[1].enabled)
        .map(s => s[0]);
    if (!packIds.length) return genericUtils.notify('CAT.Error.NoSpellCompendiums', {type: 'warn'});
    const labels = [];
    const validKeys = [];
    for (const key of listKeys) {
        const label = dnd5e.registry.spellLists.options.find(o => o.value === key)?.label;
        if (!label) continue;
        labels.push(label);
        validKeys.push(key);
    }
    if (!validKeys.length) return;
    const lockedFilters = {additional: {spelllist: makeBrowserFilter(validKeys)}};
    if (Number.isInteger(minLevel)) genericUtils.setProperty(lockedFilters, 'additional.level.min', minLevel);
    if (Number.isInteger(maxLevel)) genericUtils.setProperty(lockedFilters, 'additional.level.max', maxLevel);
    const result = await selectFromCompendiumBrowser('spells', {
        hint: _loc('CAT.CompendiumBrowser.SpellPicker', {lists: labels.join(', ')}),
        exceptionIdentifiers: exceptions,
        maxAmount: amount,
        lockedFilters,
        filters,
        packIds,
        title,
        icon
    });
    return result;
}
/**
 * Open the compendium browser for a choice of actor document.
 * @param {object} [options]
 * @param {string} [options.icon]
 * @param {string} [options.title]
 * @param {object[]} [options.filters] Additional filters, see dnd5e.Filter.
 * @param {number} [options.amount] The number of actors that can be chosen.
 * @param {number} [options.minCR] The minimum challenge rating offered as an option.
 * @param {number} [options.maxCR] The maxmium challenge rating offered as an option.
 * @param {string[]} [options.creatureTypes] Include provided types. Allowed types are defined in CONFIG.DND5E.creatureTypes.
 * @param {string[]} [options.excludeMovement] Exclude provided types. Allowed types are defined in CONFIG.DND5E.movementTypes.
 * @param {string[]} [options.packIds] Pack ids to use instead of the monster compendiums configured in settings.
 * @param {string[]} [options.exceptions] Uuids for actors that should be offered despite failing other filters.
 * @returns {Promise<>}
 */
async function selectNPCFromCompendiums({amount = 1, minCR, maxCR, creatureTypes, excludeMovement, packIds, exceptions, filters, icon, hint, title = 'CAT.CompendiumBrowser.Title'} = {}) {
    if (!packIds?.length)
        packIds = Object.entries(game.settings.get('cat', 'monsterCompendiums'))
            .filter(s => s[1].enabled)
            .map(s => s[0]);
    if (!packIds.length) return genericUtils.notify('CAT.Error.NoMonsterCompendiums', {type: 'warn'});
    const lockedFilters = {};
    if (Number.isNumeric(minCR)) genericUtils.setProperty(lockedFilters, 'additional.cr.min', minCR);
    if (Number.isNumeric(maxCR)) genericUtils.setProperty(lockedFilters, 'additional.cr.max', maxCR);
    if (creatureTypes?.length) genericUtils.setProperty(lockedFilters, 'additional.type', makeBrowserFilter(creatureTypes));
    if (excludeMovement?.length) genericUtils.setProperty(lockedFilters, 'additional.movement', makeBrowserFilter(excludeMovement, false));
    const result = await selectFromCompendiumBrowser('monsters', {
        exceptionUuids: exceptions,
        maxAmount: amount,
        lockedFilters,
        filters,
        packIds,
        title,
        icon,
        hint
    });
    return result;
}
export default {
    selectFromCompendiumBrowser,
    getDocumentByIdentifier,
    getDocumentByName,
    selectSpellFromLists,
    selectNPCFromCompendiums
};