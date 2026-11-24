/**
 * Compendium lookups by identifier, name or slug, and pickers built on CAT's compendium browser. Spell and monster
 * lookups default to the compendiums enabled in CAT's settings.
 * @module
 */
import {CatCompendiumBrowser} from '../applications/_module.mjs';
import {automationUtils, genericUtils, itemUtils} from './_module.mjs';
import {Logging} from '../lib/_module.mjs';
/**
 * Open CAT's compendium browser for the current user to choose documents, and load the chosen ones. Chosen uuids that
 * no longer resolve are dropped.
 * @param {string} tab                                        Browser tab to open, such as `'spells'` or `'monsters'`.
 * @param {object} [options]                                  Additional options.
 * @param {string[]} [options.packIds]                        Restrict the browser to these compendiums.
 * @param {Function} [options.filterPredicate]                Receives each index entry. Only entries returning true are
 *                                                            offered.
 * @param {object[]} [options.filters]                        Additional filters, see `dnd5e.Filter`.
 * @param {object} [options.lockedFilters]                    Filters the user cannot change.
 * @param {string[]} [options.exceptionIdentifiers]           Identifiers offered despite failing other filters.
 * @param {string[]} [options.exceptionUuids]                 Uuids offered despite failing other filters.
 * @param {number} [options.minAmount]                        Fewest documents that may be chosen. Defaults to 1.
 * @param {number} [options.maxAmount]                        Most documents that may be chosen.
 * @param {string} [options.title]                            Window title.
 * @param {string} [options.hint]                             Hint shown above the list.
 * @param {string} [options.icon]                             Window icon.
 * @param {object} [options.position]                         Initial window position.
 * @returns {Promise<foundry.abstract.Document[]|undefined>}  The chosen documents. Undefined if nothing is chosen or
 *                                                            the browser is closed.
 * @example
 * const [weapon] = await compendiumUtils.selectFromCompendiumBrowser('equipment', {maxAmount: 1, filterPredicate: entry => entry.type === 'weapon'}) ?? [];
 */
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
/**
 * Fetch a compendium document by its `system.identifier` or `flags.cat.identifier`, returning the first match in the
 * index. With `object`, returns its source data with the overrides below applied. The overrides are ignored without
 * `object`.
 * @param {string} packId                 Compendium to search.
 * @param {string} identifier             Identifier to match.
 * @param {object} [options]              Additional options.
 * @param {boolean} [options.object]      Return the document's source data instead of the document.
 * @param {string} [options.description]  Replace the description.
 * @param {string} [options.translate]    Localization key used as the document name and every effect name.
 * @param {number} [options.flatAttack]   Give every attack activity this flat attack bonus.
 * @param {number} [options.flatDC]       Give every save activity this flat DC.
 * @returns {Promise<foundry.abstract.Document|object|undefined>}
 *                                        Undefined if the compendium or a match is missing.
 * @example
 * const itemData = await compendiumUtils.getDocumentByIdentifier('dnd5e.spells', 'fire-bolt', {object: true, flatAttack: 7});
 */
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
        if (flatAttack) {
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
/**
 * Fetch a compendium document by exact, case-sensitive name, returning the first match in the index.
 * @param {string} packId                                   Compendium to search.
 * @param {string} name                                     Document name to match.
 * @param {object} [options]                                Additional options.
 * @param {string} [options.rules]                          Only match documents with these rules, `'2014'` or `'2024'`.
 *                                                          Documents without rules count as 2014.
 * @returns {Promise<foundry.abstract.Document|undefined>}  Undefined if the compendium or a match is missing.
 * @example
 * const goblin = await compendiumUtils.getDocumentByName('dnd5e.monsters', 'Goblin', {rules: '2014'});
 */
async function getDocumentByName(packId, name, {rules} = {}) {
    const pack = game.packs.get(packId);
    if (!pack) return;
    const index = await pack.getIndex({fields: ['system.source']});
    const found = index.find(i => i.name === name && (!rules || (i.system?.source?.rules || '2014') === rules));
    if (!found) return;
    return await fromUuid(found.uuid);
}
/**
 * Fetch the documents in a compendium whose slugified names match, in the order of the slugs given. Slugs with no match
 * are skipped.
 * @param {string} packId                           Compendium to search.
 * @param {string[]} slugs                          Slugified document names to match.
 * @returns {Promise<foundry.abstract.Document[]>}  Empty when the compendium is missing.
 * @example
 * const familiars = await compendiumUtils.getDocumentsBySlug('dnd5e.monsters', ['bat', 'cat', 'owl']);
 */
async function getDocumentsBySlug(packId, slugs) {
    const pack = game.packs.get(packId);
    if (!pack) return [];
    const index = await pack.getIndex();
    const entries = slugs.map(slug => index.find(entry => entry.name.slugify() === slug)).filter(Boolean);
    return await Promise.all(entries.map(entry => fromUuid(entry.uuid)));
}
/**
 * Build a compendium browser filter object from a list of keys.
 * @param {string[]} list      Values the filter accepts.
 * @param {boolean} [include]  False to exclude the listed keys instead.
 * @returns {Record<string, number>}
 */
// used locally only
function makeBrowserFilter(list, include = true) {
    return list.reduce((obj, key) => (obj[key] = include ? 1 : -1, obj), {});
}
/**
 * Ids of the compendiums enabled in a CAT compendium setting, lowest priority number first.
 * @param {string} settingKey  CAT setting holding compendium configuration, such as `'spellCompendiums'` or
 *                             `'monsterCompendiums'`.
 * @returns {string[]}
 * @example
 * const packIds = compendiumUtils.getEnabledCompendiumIds('spellCompendiums');
 */
function getEnabledCompendiumIds(settingKey) {
    return Object.entries(game.settings.get('cat', settingKey) ?? {})
        .filter(s => s[1].enabled)
        .sort((a, b) => a[1].priority - b[1].priority)
        .map(s => s[0]);
}
/**
 * Whether an Item compendium holds any spells. Reads the index already loaded and does not fetch it.
 * @param {CompendiumCollection} pack  Item compendium to check.
 * @returns {boolean}
 * @example
 * const spellPacks = game.packs.filter(pack => pack.documentName === 'Item' && compendiumUtils.isSpellPack(pack));
 */
function isSpellPack(pack) {
    return pack.index.some(entry => entry.type === 'spell');
}
/**
 * Where a compendium comes from: the name of the package that provides it, or World, and its sidebar folder path.
 * @param {CompendiumCollection} pack            Compendium to describe.
 * @returns {{source: string, folders: string}}  `folders` joins folder names with ` / `, and is empty when the
 *                                               compendium is not in a folder.
 * @example
 * compendiumUtils.getPackOrigin(pack); // {source: "Player's Handbook", folders: 'Sources / 2024'}
 */
function getPackOrigin(pack) {
    const {packageType, packageName} = pack.metadata;
    const source = packageType === 'world' ? _loc('PACKAGE.Type.world') : automationUtils.getSourceName(packageName);
    const folders = pack.folder ? [...pack.folder.ancestors].reverse().concat(pack.folder).map(folder => folder.name).join(' / ') : '';
    return {source, folders};
}
/**
 * Single-line picker label for a compendium: its title followed by its origin from {@link getPackOrigin}.
 * @param {CompendiumCollection} pack  Compendium to label.
 * @returns {string}
 * @example
 * compendiumUtils.getPackLabel(pack); // "Monsters (Player's Handbook • Sources / 2024)"
 */
function getPackLabel(pack) {
    const {source, folders} = getPackOrigin(pack);
    return `${pack.title} (${folders ? `${source} • ${folders}` : source})`;
}
/**
 * Open the compendium browser for a choice of spells from registered spell lists, locked to those lists and any level
 * or casting time limits. List keys that are not registered are skipped with a warning. Warns and returns nothing when
 * no spell compendium is enabled.
 * @param {string[]} listKeys                              Spell list keys in the form `type:identifier`, such as
 *                                                         `class:wizard`. Allowed types are defined in
 *                                                         `CONFIG.DND5E.spellListTypes`.
 * @param {object} [options]                               Additional options.
 * @param {string} [options.icon]                          Window icon.
 * @param {string} [options.title]                         Window title. Defaults to the compendium browser title.
 * @param {object[]} [options.filters]                     Additional filters, see `dnd5e.Filter`.
 * @param {number} [options.amount]                        Most spells that can be chosen. Defaults to 1.
 * @param {number} [options.minLevel]                      Lowest spell level offered.
 * @param {number} [options.maxLevel]                      Highest spell level offered.
 * @param {string[]} [options.castTime]                    Activation types offered, such as `action` or `bonus`.
 * @param {string[]} [options.packIds]                     Compendiums to search instead of the enabled spell
 *                                                         compendiums.
 * @param {string[]} [options.exceptions]                  Identifiers of spells offered despite failing other filters.
 * @returns {Promise<foundry.documents.Item[]|undefined>}  The chosen spells. Undefined if nothing is chosen, the
 *                                                         browser is closed, or no list key is registered.
 * @example
 * const [spell] = await compendiumUtils.selectSpellFromLists(['class:wizard'], {maxLevel: 2, castTime: ['action']}) ?? [];
 */
async function selectSpellFromLists(listKeys, {amount = 1, minLevel, maxLevel, castTime, packIds, exceptions, filters, icon, title = 'CAT.CompendiumBrowser.Title'} = {}) {
    if (!packIds?.length) packIds = getEnabledCompendiumIds('spellCompendiums');
    if (!packIds.length) return Logging.addMacroWarning('cat', 'selectSpellFromLists', 'CAT.Error.NoSpellCompendiums', {notify: 'warn'});
    const labels = [];
    const validKeys = [];
    for (const key of listKeys) {
        const label = dnd5e.registry.spellLists.options.find(o => o.value === key)?.label;
        if (!label) {
            Logging.addMacroWarning('cat', 'selectSpellFromLists', 'CAT.Error.UnregisteredSpellList', {notify: 'warn', format: {key}});
            continue;
        }
        labels.push(label);
        validKeys.push(key);
    }
    if (!validKeys.length) return;
    const lockedFilters = {additional: {spelllist: makeBrowserFilter(validKeys)}};
    if (castTime?.length) lockedFilters.additional.activationType = makeBrowserFilter(castTime);
    if (Number.isInteger(parseInt(minLevel))) genericUtils.setProperty(lockedFilters, 'additional.level.min', minLevel);
    if (Number.isInteger(parseInt(maxLevel))) genericUtils.setProperty(lockedFilters, 'additional.level.max', maxLevel);
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
 * Open the compendium browser's monsters tab for a choice of actors, locked to the given challenge rating, creature
 * type and movement limits. Warns when no monster compendium is enabled.
 * @param {object} [options]                                Additional options.
 * @param {string} [options.icon]                           Window icon.
 * @param {string} [options.title]                          Window title. Defaults to the compendium browser title.
 * @param {string} [options.hint]                           Hint shown above the list.
 * @param {object[]} [options.filters]                      Additional filters, see `dnd5e.Filter`.
 * @param {number} [options.amount]                         Most actors that can be chosen. Defaults to 1.
 * @param {number} [options.minCR]                          Lowest challenge rating offered.
 * @param {number} [options.maxCR]                          Highest challenge rating offered.
 * @param {string[]} [options.creatureTypes]                Creature types offered, from `CONFIG.DND5E.creatureTypes`.
 * @param {string[]} [options.excludeMovement]              Movement types that rule an actor out, from
 *                                                          `CONFIG.DND5E.movementTypes`.
 * @param {string[]} [options.packIds]                      Compendiums to search instead of the enabled monster
 *                                                          compendiums.
 * @param {string[]} [options.exceptions]                   Uuids of actors offered despite failing other filters.
 * @returns {Promise<foundry.documents.Actor[]|undefined>}  The chosen actors. Undefined if nothing is chosen or the
 *                                                          browser is closed.
 * @example
 * const [beast] = await compendiumUtils.selectActor({creatureTypes: ['beast'], maxCR: 1, excludeMovement: ['fly']}) ?? [];
 */
async function selectActor({amount = 1, minCR, maxCR, creatureTypes, excludeMovement, packIds, exceptions, filters, icon, hint, title = 'CAT.CompendiumBrowser.Title'} = {}) {
    if (!packIds?.length) packIds = getEnabledCompendiumIds('monsterCompendiums');
    if (!packIds.length) {
        genericUtils.notify('CAT.Error.NoMonsterCompendiums', {type: 'warn'});
        return;
    }
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
/**
 * Filter the NPCs in the monster compendiums by challenge rating, creature type, subtype and name without opening the
 * compendium browser. When several compendiums hold an actor with the same name, the first in priority order wins.
 * @param {object} [options]                     Additional options.
 * @param {string[]} [options.packIds]           Compendiums to search instead of the enabled monster compendiums.
 * @param {number} [options.maxCR]               Highest challenge rating kept. Actors without one are dropped.
 * @param {string[]} [options.creatureTypes]     Creature types kept.
 * @param {string[]} [options.creatureSubtypes]  Creature subtypes kept, matched case-insensitively as part of the
 *                                               subtype text.
 * @param {string[]} [options.names]             Actor names kept, matched case-insensitively.
 * @returns {Promise<object[]>}                  Index entries, one per actor name, sorted by challenge rating then
 *                                               name.
 * @example
 * const entries = await compendiumUtils.getFilteredActors({maxCR: 0.25, creatureTypes: ['beast']});
 * const actor = await fromUuid(entries[0].uuid);
 */
async function getFilteredActors({packIds, maxCR, creatureTypes, creatureSubtypes, names} = {}) {
    if (!packIds?.length) packIds = getEnabledCompendiumIds('monsterCompendiums');
    const subtypes = (creatureSubtypes ?? []).map(subtype => subtype.toLowerCase());
    const lowerNames = (names ?? []).map(name => name.toLowerCase());
    const found = new Map();
    const packs = packIds.map(packId => game.packs.get(packId)).filter(pack => pack?.documentName === 'Actor');
    const indexes = await Promise.all(packs.map(pack => pack.getIndex({fields: ['system.details.cr', 'system.details.type', 'type']})));
    for (const index of indexes) {
        index.forEach(entry => {
            if (entry.type !== 'npc' || found.has(entry.name)) return;
            const type = entry.system?.details?.type;
            if (Number.isNumeric(maxCR) && (entry.system?.details?.cr ?? Infinity) > maxCR) return;
            if (creatureTypes?.length && !creatureTypes.includes(type?.value)) return;
            if (subtypes.length && !subtypes.some(subtype => (type?.subtype ?? '').toLowerCase().includes(subtype))) return;
            if (lowerNames.length && !lowerNames.includes(entry.name.toLowerCase())) return;
            found.set(entry.name, entry);
        });
    }
    return Array.from(found.values()).sort((a, b) => (a.system?.details?.cr ?? 0) - (b.system?.details?.cr ?? 0) || a.name.localeCompare(b.name));
}
/**
 * Find the uuid of a compendium document by its `system.identifier` or `flags.cat.identifier`, without loading the
 * document.
 * @param {string} packId                Compendium to search.
 * @param {string} identifier            Identifier to match.
 * @returns {Promise<string|undefined>}  Undefined if the compendium or a match is missing.
 * @example
 * const uuid = await compendiumUtils.getDocumentUuidByIdentifier('dnd5e.spells', 'fireball');
 */
async function getDocumentUuidByIdentifier(packId, identifier) {
    const pack = game.packs.get(packId);
    if (!pack) return;
    const index = await pack.getIndex({fields: ['system.identifier', 'flags.cat.identifier']});
    return index.find(i => i.system.identifier === identifier || i.flags.cat?.identifier === identifier)?.uuid;
}
/**
 * Find the uuid of a spell by its identifier, searching the enabled spell compendiums in priority order with
 * {@link getDocumentUuidByIdentifier}.
 * @param {string} identifier            Identifier to match.
 * @param {object} [options]             Additional options.
 * @param {string[]} [options.packIds]   Compendiums to search instead of the enabled ones, in order.
 * @returns {Promise<string|undefined>}  Undefined if no compendium has a match.
 * @example
 * const uuid = await compendiumUtils.getSpellUuid('misty-step');
 */
async function getSpellUuid(identifier, {packIds} = {}) {
    if (!packIds?.length) packIds = getEnabledCompendiumIds('spellCompendiums');
    for (const id of packIds) {
        const uuid = await getDocumentUuidByIdentifier(id, identifier);
        if (uuid) return uuid;
    }
}
/**
 * Fetch a spell by identifier from the enabled spell compendiums, in priority order. Returns an unsaved synthetic item
 * built with {@link itemUtils.syntheticItem}, or its source data with `object`. With `rules`, a copy written for that
 * rules version is preferred over the first match. Warns when no spell compendium is enabled.
 * @param {string} identifier                        Identifier to match.
 * @param {object} [options]                         Additional options.
 * @param {string[]} [options.packIds]               Compendiums to search instead of the enabled spell compendiums.
 * @param {string} [options.rules]                   Rules version to prefer, `'2014'` or `'2024'`.
 * @param {boolean} [options.object]                 Return the spell's source data instead of an item.
 * @param {foundry.documents.Actor} [options.actor]  Parent actor for the synthetic item. Ignored with `object`.
 * @param {string} [options.description]             Replace the description.
 * @param {string} [options.translate]               Localization key used as the spell name and every effect name.
 * @param {number} [options.flatAttack]              Give every attack activity this flat attack bonus.
 * @param {number} [options.flatDC]                  Give every save activity this flat DC.
 * @returns {Promise<Item5e|object|undefined>}       Undefined when no compendium has the spell.
 * @example
 * const spell = await compendiumUtils.getSpell('command', {actor, flatDC: 15});
 * const guidance = await compendiumUtils.getSpell('guidance', {object: true, rules: '2014'});
 */
async function getSpell(identifier, {packIds, rules, object = false, actor, description, translate, flatAttack, flatDC} = {}) {
    if (!packIds?.length) packIds = getEnabledCompendiumIds('spellCompendiums');
    if (!packIds.length) {
        genericUtils.notify('CAT.Error.NoSpellCompendiums', {type: 'warn'});
        return;
    }
    let found;
    for (const id of packIds) {
        const spell = await getDocumentByIdentifier(id, identifier, {object: true, description, translate, flatAttack, flatDC});
        if (!spell) continue;
        found ??= spell;
        if (!rules || spell.system.source?.rules === rules) {
            found = spell;
            break;
        }
    }
    if (!found) return;
    return object ? found : itemUtils.syntheticItem(found, actor);
}
export default {
    selectFromCompendiumBrowser,
    getDocumentByIdentifier,
    getDocumentUuidByIdentifier,
    getSpellUuid,
    getDocumentByName,
    getDocumentsBySlug,
    selectSpellFromLists,
    selectActor,
    getFilteredActors,
    getEnabledCompendiumIds,
    isSpellPack,
    getPackLabel,
    getPackOrigin,
    getSpell
};
