/**
 * Automations applied to items: status, config values, source priority and applying an automation. Also covers generic
 * macro config, animation selections stored in config, and called events.
 * @module
 */
import {itemEvents} from '../events/_module.mjs';
import {constants, Events, Logging} from '../lib/_module.mjs';
import {animationUtils, compendiumUtils, dataUtils, documentUtils, effectUtils, genericUtils, itemUtils, queryUtils} from './_module.mjs';
/**
 * The registered automation applied to an item, matched on its identifier, rules and flagged source. With no source
 * flagged, only an automation whose own document is this item matches. Returns undefined when the item has no
 * identifier or rules.
 * @param {Item5e} item  Item to look up.
 * @returns {Automation|undefined}
 * @example
 * const automation = automationUtils.getCurrentAutomation(item);
 * if (automation) console.log(automation.source, automation.version);
 */
function getCurrentAutomation(item) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item);
    const source = documentUtils.getSource(item);
    const type = item.type;
    const sourceType = itemUtils.getAdvancementSourceKey(item);
    const monsterIdentifier = documentUtils.getMonsterIdentifier(item);
    const featType = documentUtils.getMatchFeatType(item);
    if (!identifier || !rules) return;
    if (!source) {
        const allAutomations = constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true, type, featType, monsterIdentifier, sourceType});
        return allAutomations.find(automation => automation.uuid === item.uuid);
    }
    return constants.automations.getAutomationByIdentifier(identifier, {rules, source, monsterIdentifier, type, featType, sourceType});
}
/**
 * Whether the item is the registered automation's own source document, rather than a copy an automation was applied to.
 * @param {Item5e} item                      Item to check.
 * @param {object} [options]                 Additional options.
 * @param {Automation} [options.automation]  Already-resolved automation. Defaults to {@link getCurrentAutomation}.
 * @returns {boolean}
 * @example
 * if (automationUtils.isSelfAutomation(item)) return;
 */
function isSelfAutomation(item, {automation = getCurrentAutomation(item)} = {}) {
    return automation?.uuid === item.uuid;
}
/**
 * Automation status of a document. Items report their own status and actors the lowest across their items. Any other
 * document carrying CAT config is `CONFIGURABLE`, a scene otherwise reports the lowest across its token actors, and
 * everything else is `UNAVAILABLE`.
 * @param {ClientDocument} document  Document to check.
 * @returns {number}                 A `constants.automationStatus` value.
 * @example
 * const status = automationUtils.getAutomationStatus(item);
 * if (status === constants.automationStatus.OUTDATED) await automationUtils.updateItem(item);
 */
function getAutomationStatus(document) {
    if (document.documentName === 'Item') return getItemAutomationStatus(document);
    if (document.documentName === 'Actor') return getActorAutomationStatus(document);
    if (getCatConfigKinds(document).length) return constants.automationStatus.CONFIGURABLE;
    if (document.documentName === 'Scene') return getLowestStatus([...new Set(document.tokens.contents.map(token => token.actorLink ? token.baseActor : token.actor).filter(Boolean))], getActorAutomationStatus);
    return constants.automationStatus.UNAVAILABLE;
}
/**
 * The lowest automation status across an actor's items, ignoring items that are `UNAVAILABLE`.
 * @param {Actor5e} actor  Actor to check.
 * @returns {number}       A `constants.automationStatus` value. `UNAVAILABLE` when no item qualifies.
 * @example
 * const status = automationUtils.getActorAutomationStatus(actor);
 */
function getActorAutomationStatus(actor) {
    return getLowestStatus(actor.items, getItemAutomationStatus);
}
/**
 * The lowest automation status across these documents, ignoring any with nothing to automate.
 * @param {Iterable<foundry.abstract.Document>} documents  Documents to read.
 * @param {function(foundry.abstract.Document): number} getStatus
 *                                                         Status getter for one document.
 * @returns {number}                                       A `constants.automationStatus` value, or -2 when no document
 *                                                         qualifies.
 */
function getLowestStatus(documents, getStatus) {
    return documents.reduce((lowest, document) => {
        const status = getStatus(document);
        if (status === -2) return lowest;
        return lowest === -2 ? status : Math.min(lowest, status);
    }, -2);
}
/**
 * Whether this item is automated, and if so whether it is current, configurable or outdated.
 * @param {Item5e} item  Item to act on.
 * @returns {number}     A `constants.automationStatus` value.
 */
function getItemAutomationStatus(item) {
    const automation = getCurrentAutomation(item);
    if (getStoredHash(item) || automation) {
        if (!isUpToDate(item, {automation})) return constants.automationStatus.OUTDATED;
        if (automation?.config) return constants.automationStatus.CONFIGURABLE;
        return constants.automationStatus.UP_TO_DATE;
    }
    if (getMassApplyAutomations(item).length) return constants.automationStatus.AVAILABLE;
    if (item.flags.cat?.genericConfig) return constants.automationStatus.GENERIC;
    return constants.automationStatus.UNAVAILABLE;
}
/**
 * Whether the applied automation is current. A registered automation is compared by version, and an embedded one by
 * content hash. Returns true when nothing is applied.
 * @param {Item5e} item                      Item to check.
 * @param {object} [options]                 Additional options.
 * @param {Automation} [options.automation]  Automation to compare against. Defaults to {@link getCurrentAutomation}.
 * @returns {boolean}
 * @example
 * if (!automationUtils.isUpToDate(item)) await automationUtils.updateItem(item);
 */
function isUpToDate(item, {automation} = {}) {
    const currentAutomation = automation ?? getCurrentAutomation(item);
    if (currentAutomation) {
        if (foundry.utils.isNewerVersion(currentAutomation.version, documentUtils.getVersion(item) ?? '0')) return false;
        return true;
    }
    const storedHash = getStoredHash(item);
    if (storedHash) {
        const hash = getDocumentHash(item);
        if (hash != storedHash) return false;
        return true;
    }
    return true;
}
/**
 * Every registered automation matching the item's identifier, across all sources and in registration order. Items
 * without rules match every rules version.
 * @param {Item5e} item                        Item to look up.
 * @param {object} [options]                   Additional options.
 * @param {string[]} [options.excludeSources]  Source ids to leave out.
 * @param {string} [options.rules]             Rules version to match instead of the item's own.
 * @returns {Automation[]}
 * @example
 * const automations = automationUtils.getAvailableAutomations(item, {excludeSources: ['dnd5e']});
 */
function getAvailableAutomations(item, {excludeSources = [], rules = documentUtils.getRules(item) ?? 'all'} = {}) {
    const identifier = documentUtils.getIdentifier(item);
    const type = item.type;
    const sourceType = itemUtils.getAdvancementSourceKey(item);
    return constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true, type, featType: documentUtils.getMatchFeatType(item), excludeSources, sourceType, monsterIdentifier: documentUtils.getMonsterIdentifier(item)});
}
/**
 * Read one automation config value from a document. Falls back to the default registered on the matching automation, or
 * undefined when neither exists.
 * @param {foundry.abstract.Document} item  Document holding the config, usually an item.
 * @param {string} key                      Config key.
 * @returns {*}
 * @example
 * const formula = automationUtils.getConfigValue(workflow.item, 'formula');
 */
function getConfigValue(item, key) {
    return constants.automations.getConfigValue(item, key);
}
/**
 * {@link getConfigValue} that reads the origin item's config when the document is an active effect. Falls back to the
 * effect itself when it has no origin item.
 * @param {foundry.abstract.Document} document  Document holding the config, or an effect whose origin holds it.
 * @param {string} key                          Config key.
 * @returns {*}
 * @example
 * const bonus = automationUtils.getOriginConfigValue(effect, 'bonus');
 */
function getOriginConfigValue(document, key) {
    const item = document.documentName === 'ActiveEffect' ? effectUtils.getOriginActivitySync(document)?.item ?? document : document;
    return getConfigValue(item, key);
}
/**
 * Read one config value for a generic macro applied to a document. Falls back to the generic macro's registered
 * default, or undefined when neither exists.
 * @param {foundry.abstract.Document} item       Document holding the config.
 * @param {string} source                        Module that registered the generic macro.
 * @param {string} identifier                    Generic macro identifier.
 * @param {string} key                           Config key.
 * @param {object} [options]                     Additional options.
 * @param {'2014'|'2024'|'all'} [options.rules]  Rules version of the generic macro whose default is used. Defaults to
 *                                               the document's own.
 * @returns {*}
 * @example
 * const range = automationUtils.getGenericConfigValue(item, 'my-module', 'myGeneric', 'range');
 */
function getGenericConfigValue(item, source, identifier, key, {rules} = {}) {
    return constants.macros.getGenericConfigValue(item, source, identifier, key, {rules});
}
/**
 * Store one automation config value in the document's `flags.cat.config`.
 * @param {foundry.abstract.Document} item        Document to update.
 * @param {string} key                            Config key.
 * @param {*} value                               Value to store.
 * @returns {Promise<foundry.abstract.Document>}  The updated document.
 * @example
 * await automationUtils.setConfigValue(item, 'formula', '2d6');
 */
async function setConfigValue(item, key, value) {
    return await documentUtils.setFlag(item, 'cat', 'config.' + key, value);
}
/**
 * Store one generic macro config value in the document's `flags.cat.genericConfig`.
 * @param {foundry.abstract.Document} item        Document to update.
 * @param {string} source                         Module that registered the generic macro.
 * @param {string} identifier                     Generic macro identifier.
 * @param {string} key                            Config key.
 * @param {*} value                               Value to store.
 * @returns {Promise<foundry.abstract.Document>}  The updated document.
 * @example
 * await automationUtils.setGenericConfigValue(item, 'my-module', 'myGeneric', 'range', 60);
 */
async function setGenericConfigValue(item, source, identifier, key, value) {
    return await documentUtils.setFlag(item, 'cat', 'genericConfig.' + source + '.' + identifier + '.' + key, value);
}
/**
 * {@link getConfigValue} for several keys at once.
 * @param {foundry.abstract.Document} item  Document holding the config.
 * @param {string[]} [keys]                 Config keys to read.
 * @returns {object}                        Values keyed by config key.
 * @example
 * const {formula, bonus} = automationUtils.getConfigValues(workflow.item, ['formula', 'bonus']);
 */
function getConfigValues(item, keys = []) {
    const results = {};
    keys.forEach(key => {
        results[key] = getConfigValue(item, key);
    });
    return results;
}
/**
 * {@link getGenericConfigValue} for several keys at once. Defaults are read for the document's own rules unless `rules`
 * is given.
 * @param {foundry.abstract.Document} item       Document holding the config.
 * @param {string} source                        Module that registered the generic macro.
 * @param {string} identifier                    Generic macro identifier.
 * @param {string[]} [keys]                      Config keys to read.
 * @param {object} [options]                     Additional options.
 * @param {'2014'|'2024'|'all'} [options.rules]  Rules version of the generic macro whose defaults are used.
 * @returns {object}                             Values keyed by config key.
 * @example
 * const config = automationUtils.getGenericConfigValues(item, 'my-module', 'myGeneric', ['range', 'color']);
 */
function getGenericConfigValues(item, source, identifier, keys = [], {rules} = {}) {
    const results = {};
    keys.forEach(key => {
        results[key] = getGenericConfigValue(item, source, identifier, key, {rules});
    });
    return results;
}
/**
 * Store several automation config values in one document update.
 * @param {foundry.abstract.Document} item                  Document to update.
 * @param {object} [values]                                 Values keyed by config key.
 * @returns {Promise<foundry.abstract.Document|undefined>}  The updated document.
 * @example
 * await automationUtils.setConfigValues(item, {formula: '2d6', bonus: 2});
 */
async function setConfigValues(item, values = {}) {
    const updates = {};
    for (const [key, value] of Object.entries(values)) {
        updates['flags.cat.config.' + key] = value;
    }
    return await documentUtils.update(item, updates);
}
/**
 * Store several generic macro config values in one document update.
 * @param {foundry.abstract.Document} item                  Document to update.
 * @param {string} source                                   Module that registered the generic macro.
 * @param {string} identifier                               Generic macro identifier.
 * @param {object} [values]                                 Values keyed by config key.
 * @returns {Promise<foundry.abstract.Document|undefined>}  The updated document.
 * @example
 * await automationUtils.setGenericConfigValues(item, 'my-module', 'myGeneric', {range: 60, color: 'blue'});
 */
async function setGenericConfigValues(item, source, identifier, values = {}) {
    const updates = {};
    const prefix = 'flags.cat.genericConfig.' + source + '.' + identifier + '.';
    for (const [key, value] of Object.entries(values)) {
        updates[prefix + key] = value;
    }
    return await documentUtils.update(item, updates);
}
/**
 * Every generic macro config stored on an item, keyed by source and then identifier. Registered defaults are not
 * included.
 * @param {Item5e} item  Item to read.
 * @returns {object}     An empty object when none are stored.
 * @example
 * const configs = automationUtils.getAllGenericConfigs(item);
 * const myConfig = configs['my-module']?.myGeneric;
 */
function getAllGenericConfigs(item) {
    return item.flags.cat?.genericConfig || {};
}
/**
 * Replace every generic macro config on an item in one update.
 * @param {Item5e} item                                     Item to update.
 * @param {object} configData                               Config keyed by source and then identifier.
 * @returns {Promise<foundry.abstract.Document|undefined>}  The updated item.
 * @example
 * await automationUtils.setAllGenericConfigs(targetItem, automationUtils.getAllGenericConfigs(item));
 */
async function setAllGenericConfigs(item, configData) {
    return await documentUtils.update(item, {'flags.cat.genericConfig': configData});
}
/**
 * Enabled automation source ids from the Automation Sources setting, sorted by the priority the GM configured.
 * @param {object} [options]             Additional options.
 * @param {boolean} [options.packsOnly]  Only include sources that supply a compendium.
 * @returns {string[]}
 * @example
 * const [preferredSource] = automationUtils.getAutomationSources();
 */
function getAutomationSources({packsOnly = false} = {}) {
    const settings = game.settings.get('cat', 'automationSources');
    const entries = Object.entries(settings).filter(([key, value]) => value.enabled && (!packsOnly || value.pack)).map(([key, value]) => [key, value.priority]);
    return entries.sort((a, b) => a[1] - b[1]).map(([key]) => key);
}
/**
 * Whether a source supplies plain content rather than automations. Content sources are the system, the official
 * Player's Handbook and Dungeon Master's Guide modules, and DDBI.
 * @param {string} source  Source id.
 * @returns {boolean}
 * @example
 * automationUtils.isContentSource('dnd5e'); // true
 * automationUtils.isContentSource('chris-premades'); // false
 */
function isContentSource(source) {
    return constants.contentSources.includes(source);
}
/**
 * Whether a source takes part in mass apply. Uses the source's `massApply` setting, which defaults to off for content
 * sources and on for the rest.
 * @param {string} source   Source id.
 * @param {object} [entry]  The source's Automation Sources setting entry. Defaults to the stored one.
 * @returns {boolean}
 * @example
 * if (!automationUtils.isMassApplySource(automation.source)) return;
 */
function isMassApplySource(source, entry = game.settings.get('cat', 'automationSources')[source]) {
    return entry?.massApply ?? !isContentSource(source);
}
/**
 * Whether mass apply must skip this item for a source. True when the item is flagged to be ignored in CAT or DDBI, or
 * when replacing it from a content source would reset its advancements.
 * @param {Item5e} item    Item to check.
 * @param {string} source  Source id.
 * @returns {boolean}
 * @example
 * if (automationUtils.isMassApplyBlocked(item, automation.source)) return;
 */
function isMassApplyBlocked(item, source) {
    if (item.flags.cat?.ignoreItem) return true;
    if (item.flags.ddbimporter?.ignoreItemForChrisPremades) return true;
    return ['class', 'subclass'].includes(item.type) && isContentSource(source);
}
/**
 * Automations mass apply may put on an item: {@link getAvailableAutomations} minus sources excluded from mass apply and
 * sources blocked for this item.
 * @param {Item5e} item             Item to look up.
 * @param {object} [options]        Additional options.
 * @param {string} [options.rules]  Rules version to match instead of the item's own.
 * @returns {Automation[]}
 * @example
 * if (automationUtils.getMassApplyAutomations(item).length) await automationUtils.updateItem(item, {massApply: true});
 */
function getMassApplyAutomations(item, {rules} = {}) {
    const sources = game.settings.get('cat', 'automationSources');
    const excludeSources = [...constants.automations.sources].filter(source => !isMassApplySource(source, sources[source]));
    return getAvailableAutomations(item, {excludeSources, rules}).filter(automation => !isMassApplyBlocked(item, automation.source));
}
/**
 * Display name for an automation source. Checks registered source names, then compendium titles, module titles and the
 * system title.
 * @param {string} id  Automation source id.
 * @returns {string}   The id itself when nothing matches.
 * @example
 * automationUtils.getSourceName(automation.source);
 */
function getSourceName(id) {
    return constants.automations?.sourceNames?.[id]
        ?? game.packs.get(id)?.title
        ?? game.modules.get(id)?.title
        ?? (game.system?.id === id ? game.system.title : null)
        ?? id;
}
/**
 * Enabled source ids for one kind of source document, read from that kind's compendium setting and sorted by the
 * priority the GM configured.
 * @param {'Monster'|'Item'|'Spell'|'Macro'} type  Kind of source document.
 * @param {object} [options]                       Additional options.
 * @param {boolean} [options.packsOnly]            Only include sources that supply a compendium.
 * @returns {string[]|undefined}                   Undefined for an unsupported type.
 * @example
 * const spellPacks = automationUtils.getSourceDataSources('Spell');
 */
function getSourceDataSources(type, {packsOnly = false} = {}) {
    const settingKeys = {
        Monster: 'monsterCompendiums',
        Item: 'itemCompendiums',
        Spell: 'spellCompendiums',
        Macro: 'macroCompendiums'
    };
    const key = settingKeys[type];
    if (!key) return;
    const settings = game.settings.get('cat', key);
    const entries = Object.entries(settings).filter(([key, value]) => value.enabled && (!packsOnly || value.pack)).map(([key, value]) => [key, value.priority]);
    return entries.sort((a, b) => a[1] - b[1]).map(([key]) => key);
}
/**
 * The automation already applied to an item, or else the highest priority available one from {@link sortByPriority}.
 * @param {Item5e} item  Item to look up.
 * @returns {Automation|undefined}
 * @example
 * const automation = automationUtils.getAppliedOrPreferredAutomation(item);
 */
function getAppliedOrPreferredAutomation(item) {
    return getCurrentAutomation(item) ?? sortByPriority(getAvailableAutomations(item))[0];
}
/**
 * Sort automations by the priority set in the Automation Sources setting. Automations from sources that are disabled or
 * not listed keep their input order after the rest.
 * @param {Automation[]} automations  Automations to sort.
 * @returns {Automation[]}            A new sorted array. The input is not changed.
 * @example
 * const [best] = automationUtils.sortByPriority(automationUtils.getAvailableAutomations(item));
 */
function sortByPriority(automations) {
    const priority = getAutomationSources();
    const rank = automation => {
        const index = priority.indexOf(automation.source);
        return index === -1 ? Infinity : index;
    };
    return [...automations].sort((a, b) => rank(a) - rank(b));
}
/**
 * Documents nested under this one that have their own medkit.
 * @param {ClientDocument} document  Document to act on.
 * @returns {Array}                  Child documents, in display order.
 * @internal
 */
function getMedkitChildren(document) {
    if (!(document instanceof foundry.abstract.Document)) return [];
    switch (document.documentName) {
        case 'Actor': return [...document.items, ...document.effects];
        case 'Item': return [...(document.system?.activities ?? []), ...document.effects];
        case 'Scene': return [...(document.regions ?? []), ...(document.tokens ?? [])];
        default: return [];
    }
}
/**
 * Which kinds of CAT configuration a document carries.
 * @param {ClientDocument} document  Document to act on.
 * @returns {string[]}               Flag keys holding content, in declaration order.
 * @internal
 */
function getCatConfigKinds(document) {
    const flags = document.flags?.cat ?? {};
    return ['config', 'genericConfig', 'macros', 'embeddedMacros', 'alternateAttributes', 'placed', 'animation'].filter(key => {
        const value = flags[key];
        return Array.isArray(value) ? value.length > 0 : !!value && Object.keys(value).length > 0;
    });
}
/**
 * Which kinds of options an item's applied automation offers that the item has not saved yet.
 * @param {ClientDocument} document  Document to act on.
 * @returns {string[]}               `options` and/or `animationOptions`.
 */
function getOfferedConfigKinds(document) {
    if (document.documentName !== 'Item') return [];
    const configs = Object.values(getCurrentAutomation(document)?.config ?? {});
    const isAnimation = config => config.type === 'selectAnimation' || config.category === 'animations';
    const kinds = [];
    if (!document.flags.cat?.config && configs.some(config => !isAnimation(config))) kinds.push('options');
    if (configs.some(isAnimation)) kinds.push('animationOptions');
    return kinds;
}
/**
 * {@link getAutomationStatus} for any document, including activities. A cast activity reports the status of its spell
 * from the preferred spell compendium.
 * @param {ClientDocument} document  Document or activity to check.
 * @returns {Promise<number>}        A `constants.automationStatus` value.
 * @example
 * const status = await automationUtils.getAnyAutomationStatus(activity);
 */
async function getAnyAutomationStatus(document) {
    if (document.type === 'cast') {
        const identifier = document.flags?.cat?.spellIdentifier || (await fromUuid(document.spell?.uuid))?.identifier;
        const spell = identifier ? await compendiumUtils.getSpellUuid(identifier).then(uuid => uuid && fromUuid(uuid)) : null;
        if (spell) return getAutomationStatus(spell);
    }
    return getAutomationStatus(document);
}
/**
 * How many documents nested under this one have a generic automation applied.
 * @param {ClientDocument} document  Document to act on.
 * @returns {number}                 Count of descendants carrying a generic config.
 * @internal
 */
function countDescendantGenerics(document) {
    return getMedkitChildren(document).reduce((total, child) => {
        const generic = child.flags?.cat?.genericConfig;
        const own = generic && Object.keys(generic).length > 0 ? 1 : 0;
        return total + own + countDescendantGenerics(child);
    }, 0);
}
/**
 * Every medkit-editable document beneath this one, pruned to branches that hold an automation.
 * @param {ClientDocument} document  Document to act on.
 * @returns {Promise<Array>}         Nested {uuid, documentName, name, type, status, automated, kinds, children} nodes.
 * @internal
 */
async function getAutomationTree(document) {
    const branches = [];
    for (const child of getMedkitChildren(document)) {
        const children = await getAutomationTree(child);
        const status = await getAnyAutomationStatus(child);
        const automated = status >= constants.automationStatus.OUTDATED;
        const kinds = [...getCatConfigKinds(child), ...getOfferedConfigKinds(child)];
        if (!automated && !kinds.length && !children.length) continue;
        branches.push({
            uuid: child.uuid,
            documentName: child.documentName ?? 'Activity',
            name: child.name ?? child.label ?? child.id,
            type: child.type,
            status,
            automated,
            kinds,
            children
        });
    }
    return branches;
}
/**
 * Repoint every cast activity at the same spell in the preferred spell compendium.
 * @param {object} documentData  Item data, mutated in place.
 */
async function relinkCastActivities(documentData) {
    for (const activity of Object.values(documentData.system?.activities ?? {})) {
        if (activity.type !== 'cast') continue;
        const identifier = activity.flags?.cat?.spellIdentifier || (await fromUuid(activity.spell?.uuid))?.identifier;
        if (!identifier) continue;
        const uuid = await compendiumUtils.getSpellUuid(identifier);
        if (uuid) activity.spell.uuid = uuid;
    }
}
/**
 * Whether dnd5e already removed or replaced the item.
 * @param {Item5e} item  Item to check.
 * @returns {boolean}
 */
function isReplaced(item) {
    const actor = item.parent;
    if (!(actor instanceof Actor)) return false;
    if (!actor.items.has(item.id)) return true;
    if (!item.flags.dnd5e?.cachedFor) return false;
    return item.system.linkedActivity?.spell?.uuid !== item._stats.compendiumSource;
}
/**
 * Whether an image is a system or DDBI placeholder that an automation's own image may replace.
 * @param {string} img  Image path.
 * @returns {boolean}
 */
function isDefaultImage(img) {
    if (!img || img === Item.DEFAULT_ICON || Object.values(CONFIG.DND5E.defaultArtwork.Item).includes(img)) return true;
    if (!game.modules.get('ddb-importer')?.active) return false;
    const storage = game.settings.get('ddb-importer', 'persistent-storage-location').replace(/^\[.+?\]\s*/, '').replace(/^\/|\/$/g, '');
    const path = '/' + decodeURIComponent(img);
    return ['ddb/item/', 'ddb/loot/', 'spell/school/'].some(folder => path.includes('/' + storage + '/' + folder));
}
/**
 * Apply an automation to an item by overwriting the item with the automation's source document. Paths CAT preserves, a
 * custom image and the description are kept, and the source and version are flagged. On an actor, the automation's
 * scales are then written with {@link updateScales} and the medkit item event fires. Does nothing when no automation
 * matches or the item was already replaced.
 * @param {Item5e} item                  Item to update.
 * @param {object} [options]             Additional options.
 * @param {string} [options.source]      Source id to apply instead of the applied or preferred one.
 * @param {string} [options.rules]       Rules version to apply instead of the item's own. Only used with `source`.
 * @param {boolean} [options.skipEvent]  Skip the medkit item event.
 * @param {boolean} [options.openSheet]  Render the item sheet afterwards.
 * @param {boolean} [options.massApply]  Tell medkit macros to take defaults instead of prompting.
 * @returns {Promise<void>}
 * @example
 * await automationUtils.updateItem(item, {source: 'chris-premades', openSheet: true});
 */
async function updateItem(item, {source, rules = documentUtils.getRules(item), skipEvent, openSheet, massApply = false} = {}) {
    if (isReplaced(item)) return;
    let automation;
    const identifier = documentUtils.getIdentifier(item);
    if (source) {
        const sourceType = itemUtils.getAdvancementSourceKey(item);
        automation = constants.automations.getAutomationByIdentifier(identifier, {rules, source, monsterIdentifier: documentUtils.getMonsterIdentifier(item), type: item.type, featType: documentUtils.getMatchFeatType(item), sourceType});
    } else {
        automation = getAppliedOrPreferredAutomation(item);
    }
    if (!automation) return;
    const sourceDocument = await fromUuid(automation.uuid);
    if (!sourceDocument) return;
    const documentData = sourceDocument.toObject();
    documentData._id = item.id;
    delete documentData.ownership;
    const keepPaths = constants.getItemKeepPaths({spell: item.type === 'spell'});
    const oldDocumentData = item.toObject();
    keepPaths.forEach(field => {
        const fieldValue = genericUtils.getProperty(oldDocumentData, field);
        if (fieldValue) genericUtils.setProperty(documentData, field, fieldValue);
    });
    if (['2014', '2024'].includes(automation.rules)) genericUtils.setProperty(documentData, 'system.source.rules', automation.rules);
    const existingDescription = genericUtils.getProperty(documentData, 'system.description.value');
    if (existingDescription) {
        const stripped = itemUtils.stripDescriptionBlock(existingDescription);
        genericUtils.setProperty(documentData, 'system.description.value', game.settings.get('cat', 'fixDescriptionEnrichers') ? itemUtils.resolveDescriptionEnrichers(stripped, item) : stripped);
    }
    genericUtils.setProperty(documentData, 'flags.cat.automation.source', automation.source);
    genericUtils.setProperty(documentData, 'flags.cat.automation.version', automation.version);
    delete documentData.flags.cat.automation.sourceType;
    delete documentData.flags.cat.automation.aliases;
    delete documentData.flags.cat.automation.monsterIdentifier;
    if (!isDefaultImage(oldDocumentData.img)) {
        documentData.effects.filter(effect => effect.img === documentData.img).forEach(effect => effect.img = oldDocumentData.img);
        if (documentData.system.activities) Object.values(documentData.system.activities).filter(activity => activity.img === documentData.img).forEach(activity => activity.img = oldDocumentData.img);
        documentData.img = oldDocumentData.img;
    }
    for (const effect of documentData.effects) {
        if (effect.origin !== sourceDocument.uuid && !Object.values(effect.system?.origin ?? {}).includes(sourceDocument.uuid)) continue;
        dataUtils.setOrigin(effect, item);
    }
    dataUtils.convertItemToMetric(documentData);
    if (item.flags.dnd5e?.cachedFor && item.system.linkedActivity) {
        const enchantId = item.system.linkedActivity.constructor.ENCHANTMENT_ID;
        const enchantment = oldDocumentData.effects.find(effect => effect._id === enchantId);
        if (enchantment) {
            documentData.effects ??= [];
            documentData.effects.push(enchantment);
        }
    }
    await relinkCastActivities(documentData);
    const actor = item.actor;
    await documentUtils.update(item, documentData, {recursive: false, diff: false});
    if (actor) await updateScales(item, {automation});
    if (!skipEvent && actor) await itemEvents.itemMedkit(item, {massApply});
    if (openSheet) await item.sheet.render(true);
}
/**
 * Read one animation config value for an animation selected in a generic macro's config. Checks the document's stored
 * animation config first, then the animation's registered default.
 * @param {foundry.abstract.Document} document  Document holding the config.
 * @param {string} source                       Module that registered the generic macro.
 * @param {string} identifier                   Generic macro identifier.
 * @param {string} settingKey                   Config key holding the animation selection.
 * @param {string} key                          Animation config key.
 * @returns {*}                                 Undefined when no animation is selected.
 * @example
 * const color = automationUtils.getGenericAnimationConfig(item, 'my-module', 'myGeneric', 'animation', 'color');
 */
function getGenericAnimationConfig(document, source, identifier, settingKey, key) {
    return constants.animations.getGenericAnimationConfig(document, source, identifier, settingKey, key);
}
/**
 * Read one animation config value for an animation selected in an automation's own config. Checks the document's stored
 * animation config first, then the animation's registered default.
 * @param {foundry.abstract.Document} document  Document holding the config.
 * @param {string} settingKey                   Config key holding the animation selection.
 * @param {string} key                          Animation config key.
 * @returns {*}                                 Undefined when no animation is selected.
 * @example
 * const color = automationUtils.getAnimationConfig(workflow.item, 'animation', 'color');
 */
function getAnimationConfig(document, settingKey, key) {
    const animationData = getConfigValue(document, settingKey);
    if (!animationData?.source || !animationData?.identifier) return;
    return constants.animations.getAnimationConfig(document, animationData.source, animationData.identifier, key);
}
/**
 * Whether a scale advancement already on a class or subclass matches the registered one.
 * @param {Scale} registeredScale  Scale registered by an automation.
 * @param {object} targetScale     Existing ScaleValue advancement.
 * @returns {boolean}
 */
function scalesMatch(registeredScale, targetScale) {
    if (targetScale.type !== registeredScale.data.type) return false;
    for (const [key, data] of Object.entries(registeredScale.data.configuration.scale)) {
        const target = targetScale.configuration.scale[key];
        if (!target) return false;
        for (const [valueKey, value] of Object.entries(data)) {
            const targetValue = target[valueKey];
            if (value && typeof value === 'object' ? !foundry.utils.equals(value, targetValue ?? {}) : targetValue !== value) return false;
        }
    }
    return true;
}
/**
 * The class or subclass on this actor that a scale should be written to.
 * @param {Actor5e} actor      Actor to act on.
 * @param {string} identifier  Class or subclass identifier.
 * @returns {Item5e|undefined}
 */
function resolveScaleHolder(actor, identifier) {
    if (!identifier) return;
    return actor.classes[identifier] ?? actor.itemTypes.subclass.find(subclass => subclass.identifier === identifier);
}
/**
 * Write the scale advancements an automation registers onto the owning actor's class or subclass. The target comes from
 * the item's `classIdentifier` and `subclassIdentifier` config values. Scales that already match are left alone, and
 * all changes go out in one embedded update.
 * @param {Item5e} item                      Item on an actor.
 * @param {object} [options]                 Additional options.
 * @param {Automation} [options.automation]  Automation whose scales are written. Defaults to
 *                                           {@link getCurrentAutomation}.
 * @returns {Promise<void>}
 * @example
 * await automationUtils.updateScales(item);
 */
async function updateScales(item, {automation} = {}) {
    automation ??= getCurrentAutomation(item);
    if (!automation) return;
    const rules = documentUtils.getRules(item);
    const classIdentifier = getConfigValue(item, 'classIdentifier');
    const subclassIdentifier = getConfigValue(item, 'subclassIdentifier');
    if (!classIdentifier && !subclassIdentifier) return;
    const updates = [];
    automation.scales?.forEach(scaleData => {
        let scale = constants.scales.getScaleByIdentifier(scaleData.identifier, {rules, source: scaleData.source});
        let targetIdentifier = classIdentifier;
        if (!scale && subclassIdentifier) {
            scale = constants.scales.getScaleByIdentifier(scaleData.identifier, {rules, source: automation.source});
            targetIdentifier = subclassIdentifier;
        }
        if (!scale) return;
        const classItem = resolveScaleHolder(item.actor, targetIdentifier) ?? resolveScaleHolder(item.actor, subclassIdentifier);
        if (!classItem) return;
        const scaleValue = classItem.advancement.byType?.ScaleValue?.find(i => i.configuration.identifier === scale.identifier);
        if (scaleValue && scalesMatch(scale, scaleValue)) return;
        const classData = classItem.toObject();
        const existingKey = scaleValue && Object.keys(classData.system.advancement).find(key => classData.system.advancement[key]._id === scaleValue.id);
        const advancementKey = existingKey ?? scale.data._id ?? foundry.utils.randomID();
        const advancementData = genericUtils.deepClone(scale.data);
        advancementData._id = scaleValue?.id ?? advancementKey;
        advancementData.configuration.identifier = scale.identifier;
        classData.system.advancement[advancementKey] = advancementData;
        const change = {_id: classItem.id, 'system.advancement': classData.system.advancement};
        const currentUpdate = updates.find(i => i._id === classItem.id);
        if (currentUpdate) {
            genericUtils.mergeObject(currentUpdate, change);
        } else {
            updates.push(change);
        }
    });
    if (updates.length) await documentUtils.updateEmbeddedDocuments(item.actor, 'Item', updates);
}
/**
 * Areas where an item has drifted from its applied automation's source document. Uses are skipped when CAT preserves
 * them across updates. Returns an empty array when no automation is applied or the item is the automation's own
 * document.
 * @param {Item5e} item          Item to compare.
 * @returns {Promise<string[]>}  Any of `uses`, `activities`, `consumption` and `effects`.
 * @example
 * const issues = await automationUtils.getDataIssues(item);
 * if (issues.length) await automationUtils.updateItem(item);
 */
async function getDataIssues(item) {
    const automation = getCurrentAutomation(item);
    if (!automation || isSelfAutomation(item, {automation})) return [];
    const sourceDocument = await fromUuid(automation.uuid);
    if (!sourceDocument) return [];
    const itemData = item.toObject();
    const sourceData = sourceDocument.toObject();
    const usesOf = uses => ({max: uses?.max ?? '', recovery: (uses?.recovery ?? []).map(({period, type, formula}) => ({period, type, formula: formula ?? ''}))});
    const changesOf = effect => (effect.changes ?? effect.system?.changes ?? []).map(({_id, ...change}) => change);
    const issues = new Set();
    if (!constants.getItemKeepPaths({spell: item.type === 'spell'}).includes('system.uses') && !foundry.utils.equals(usesOf(itemData.system.uses), usesOf(sourceData.system.uses))) issues.add('uses');
    for (const [id, sourceActivity] of Object.entries(sourceData.system.activities ?? {})) {
        const activity = itemData.system.activities?.[id];
        if (!activity || activity.type !== sourceActivity.type) {
            issues.add('activities');
            continue;
        }
        if (!foundry.utils.equals(usesOf(activity.uses), usesOf(sourceActivity.uses))) issues.add('uses');
        if (!foundry.utils.equals(activity.consumption ?? {}, sourceActivity.consumption ?? {})) issues.add('consumption');
    }
    for (const sourceEffect of sourceData.effects) {
        const effect = itemData.effects.find(effect => effect._id === sourceEffect._id);
        if (!effect || !foundry.utils.equals(changesOf(effect), changesOf(sourceEffect))) issues.add('effects');
    }
    return Array.from(issues);
}
/**
 * Small non-cryptographic string hash, used to tell whether an embedded automation has been edited.
 * @param {string} str  String to hash.
 * @returns {number}
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash;
}
/**
 * Hash of this document's meaningful data, ignoring ids, sorting, ownership, artwork and any path the medkit preserves
 * across an update.
 * @param {foundry.abstract.Document} document  Document to act on.
 * @returns {number}
 * @internal
 */
function getDocumentHash(document) {
    const documentData = document.toObject();
    const deleteFields = ['_stats', '_id', 'folder', 'sort', 'ownership', 'img'];
    for (let field of deleteFields) delete documentData[field];
    if (documentData.effects) documentData.effects.forEach(effect => {
        delete effect.img;
        delete effect._stats;
    });
    const keepPaths = constants.getItemKeepPaths({spell: document.type === 'spell'});
    const deletions = {};
    for (const path of keepPaths) deletions[path] = _del;
    deletions['flags.cat.automation'] = _del;
    genericUtils.mergeObject(documentData, genericUtils.expandObject(deletions), {applyOperators: true});
    if (genericUtils.isEmpty(documentData.flags?.cat)) delete documentData.flags.cat;
    const jsonDocument = JSON.stringify(documentData);
    return simpleHash(jsonDocument);
}
/**
 * Store a document hash so later edits can be detected.
 * @param {foundry.abstract.Document} document  Document to act on.
 * @param {number} hash                         Hash to store.
 * @returns {Promise<foundry.abstract.Document>}
 * @internal
 */
async function setDocumentHash(document, hash) {
    return await documentUtils.setFlag(document, 'cat', 'automation.hash', hash);
}
/**
 * The hash stored by {@link setDocumentHash}, if any.
 * @param {foundry.abstract.Document} document  Document to act on.
 * @returns {number|undefined}
 * @internal
 */
function getStoredHash(document) {
    return document.flags.cat?.automation?.hash;
}
/**
 * Find a source document by identifier, searching the compendiums from {@link getSourceDataSources} in priority order.
 * Returns the first match.
 * @param {string} identifier                               Identifier to match.
 * @param {'Monster'|'Item'|'Spell'|'Macro'} type           Kind of source document.
 * @returns {Promise<foundry.abstract.Document|undefined>}  Undefined when nothing matches or the type is unsupported.
 * @example
 * const spell = await automationUtils.getSourceDocumentByIdentifier('fireball', 'Spell');
 */
async function getSourceDocumentByIdentifier(identifier, type) {
    const sortedPacks = getSourceDataSources(type);
    if (!sortedPacks) return;
    for (const packId of sortedPacks) {
        const pack = game.packs.get(packId);
        if (!pack) continue;
        const index = await pack.getIndex({fields: ['system.identifier', 'flags.cat.identifier']});
        const match = index.find(document => documentUtils.getIdentifier(document) === identifier);
        if (match) return await pack.getDocument(match._id);
    }
}
/**
 * Run a called event on an actor, so macros on the actor can respond to something that is not a workflow. Macros run in
 * priority order. Without `multiResult`, the first truthy result is returned and the remaining macros are skipped.
 * @param {string} pass                    Called event pass to run.
 * @param {Actor5e} actor                  Actor whose macros run.
 * @param {object} [options]               Additional options.
 * @param {boolean} [options.multiResult]  Run every macro and collect each truthy result.
 * @param {boolean} [options.canOverlap]   Let several macros with the same name run.
 * @param {object} [options.data]          Data passed to the macros as `data`.
 * @returns {Promise<*>}                   The first truthy result, an array of results with `multiResult`, or
 *                                         undefined.
 * @example
 * const edits = await automationUtils.calledEvent('preCreateRageEffect', workflow.actor, {canOverlap: true, multiResult: true, data: {effectData}});
 */
async function calledEvent(pass, actor, {multiResult, canOverlap, data} = {}) {
    return new Events.CalledEvent(actor, pass, data).run({canOverlap, multiResult});
}
/**
 * {@link calledEvent} for synchronous callers, such as data preparation. Macros that return promises are not awaited.
 * @param {string} pass                    Called event pass to run.
 * @param {Actor5e} actor                  Actor whose macros run.
 * @param {object} [options]               Additional options.
 * @param {boolean} [options.multiResult]  Run every macro and collect each truthy result.
 * @param {boolean} [options.canOverlap]   Let several macros with the same name run.
 * @param {object} [options.data]          Data passed to the macros as `data`.
 * @returns {*}                            The first truthy result, an array of results with `multiResult`, or
 *                                         undefined.
 * @example
 * const bonuses = automationUtils.calledEventSync('myPass', actor, {multiResult: true});
 */
function calledEventSync(pass, actor, {multiResult, canOverlap, data} = {}) {
    return new Events.CalledEvent(actor, pass, data).runSync({canOverlap, multiResult});
}
/**
 * Run a macro on another client. The macro must be registered as a remote macro.
 * @throws Times out after the number of seconds configured in MidiQOL's reaction timer setting.
 * @param {string} source             Module id.
 * @param {string} identifier         Macro identifier.
 * @param {'2014'|'2024'|'all'} rules
 * @param {object} macroData          Data provided to the macro scope. Must be serializable.
 * @param {string} userId
 * @returns {Promise}                 Return data from the macro, or an array of return data
 *                                    if the registered macro has many entries.
 * @example
 * // register
 * cat.api.registerFnMacro({
    identifier: 'buildComplicatedDialog',
    source: 'chris-premades',
    rules: 'all',
    macros: {
        remote: [{macro: () => console.log('Hello')}]
    }
})
 * // call
 * const userId = queryUtils.firstOwner(targetActor, true);
 * const prompt = await automationUtils.remoteMacro('chris-premades', 'buildComplicatedDialog', 'all', userId);
 */
async function remoteMacro(source, identifier, rules, macroData, userId) {
    const user = game.users.get(userId);
    if (!user) return Logging.addMacroWarning(source, identifier, `Remote macro sent to an unknown user: ${userId}`);
    if (!game.user.hasPermission('MACRO_SCRIPT'))
        return Logging.addMacroWarning(source, identifier, `User ${user.name} (${userId}) does not have permission to execute macros.`);
    return await queryUtils.query('remoteMacro', user, {source, identifier, rules, macroData}, 1000 * MidiQOL.configSettings().reactionTimeout);
}
/**
 * The animation selected in a config key, with its resolved config values. Pass `source` and `identifier` when the
 * selection lives in a generic macro's config. Returns no animation when none is selected, CAT Animations defers to
 * AA/BLFX for the item, Sequencer is unavailable, or a requirement is not met. A missing requirement also shows a
 * warning.
 * @param {foundry.abstract.Document} document                   Document holding the config, or an activity.
 * @param {string} settingKey                                    Config key holding the animation selection.
 * @param {object} [options]                                     Additional options.
 * @param {string} [options.source]                              Module that registered the generic macro.
 * @param {string} [options.identifier]                          Generic macro identifier.
 * @param {'2014'|'2024'|'all'} [options.rules]                  Rules version of the generic macro. Defaults to the
 *                                                               document's own.
 * @returns {{animation: Animation|undefined, options: object}}  Options are keyed by animation config key, and empty
 *                                                               when there is no animation.
 * @example
 * const {animation, options} = automationUtils.getResolvedAnimation(item, 'animation');
 * if (animation?.macros?.play) animation.macros.play(workflow.token.document, target, options);
 */
function getResolvedAnimation(document, settingKey, {source, identifier, rules} = {}) {
    const isGeneric = source && identifier;
    const animationSetting = isGeneric ? getGenericConfigValue(document, source, identifier, settingKey, {rules}) : getConfigValue(document, settingKey);
    if (!animationSetting || !animationSetting.source || !animationSetting.identifier || animationSetting.source === 'none' || animationSetting.identifier === 'none') return {animation: undefined, options: {}};
    const item = document instanceof Item ? document : document.item;
    if (animationUtils.deferredToAABLFX(item)) return {animation: undefined, options: {}};
    const animation = constants.animations.getAnimation(animationSetting.source, animationSetting.identifier);
    if (!animation || !animationUtils.sequencerCheck()) return {animation: undefined, options: {}};
    const missing = animation.requirements?.find(requirement => !animationUtils.meetsRequirement(requirement));
    if (missing) {
        genericUtils.notify('CAT.Error.NoAnimations', {type: 'warn', format: {module: missing}});
        return {animation: undefined, options: {}};
    }
    const options = {};
    if (animation.config) Object.keys(animation.config).forEach(key => options[key] = isGeneric ? getGenericAnimationConfig(document, source, identifier, settingKey, key) : getAnimationConfig(document, settingKey, key));
    return {animation, options};
}
/**
 * Find a document by name, searching the enabled compendiums for that type in the priority order the GM configured.
 * Returns the first match.
 * @param {string} name                                     Document name to match.
 * @param {'monster'|'item'|'spell'|'macro'} type           Kind of source document.
 * @param {object} [options]                                Additional options.
 * @param {string} [options.rules]                          Only match documents with these rules, `2014` or `2024`.
 * @returns {Promise<foundry.abstract.Document|undefined>}  Undefined when nothing matches or the type is unsupported.
 * @example
 * const wolf = await automationUtils.getCompendiumDocumentByName('Wolf', 'monster', {rules: '2024'});
 */
async function getCompendiumDocumentByName(name, type, {rules} = {}) {
    if (!['monster', 'item', 'spell', 'macro'].includes(type)) return;
    let setting = Object.entries(game.settings.get('cat', type + 'Compendiums')).map(([key, value]) => ({id: key, ...value})).filter(i => i.enabled).sort((a, b) => a.priority - b.priority);
    let result;
    for (const data of setting) {
        result = await compendiumUtils.getDocumentByName(data.id, name, {rules});
        if (result) return result;
    }
}
export default {
    getCurrentAutomation,
    getAutomationStatus,
    isSelfAutomation,
    getAvailableAutomations,
    getConfigValue,
    getOriginConfigValue,
    getGenericConfigValue,
    setConfigValue,
    setGenericConfigValue,
    getConfigValues,
    getGenericConfigValues,
    setConfigValues,
    setGenericConfigValues,
    getAutomationSources,
    isContentSource,
    isMassApplySource,
    isMassApplyBlocked,
    getMassApplyAutomations,
    getAppliedOrPreferredAutomation,
    sortByPriority,
    updateItem,
    updateScales,
    getDataIssues,
    getDocumentHash,
    setDocumentHash,
    getStoredHash,
    isUpToDate,
    getActorAutomationStatus,
    getAllGenericConfigs,
    setAllGenericConfigs,
    getGenericAnimationConfig,
    getSourceDataSources,
    getSourceDocumentByIdentifier,
    getSourceName,
    calledEvent,
    calledEventSync,
    remoteMacro,
    getAnimationConfig,
    getResolvedAnimation,
    getCompendiumDocumentByName,
    getMedkitChildren,
    getAnyAutomationStatus,
    getCatConfigKinds,
    getAutomationTree,
    countDescendantGenerics
};
