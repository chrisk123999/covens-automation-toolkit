import {itemEvents} from '../events/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {compendiumUtils, documentUtils, genericUtils, itemUtils} from './_module.mjs';
/**
 * The registered automation currently applied to this item, matched on its identifier, rules and source. With no source flagged, only an embedded macro automation belonging to this item matches.
 * @param {Item5e} item Item to act on.
 * @returns {Automation|undefined}
 */
function getCurrentAutomation(item) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item);
    const source = documentUtils.getSource(item);
    const type = item.type;
    const sourceType = itemUtils.getAdvancementSourceKey(item);
    const actorType = type === 'spell' ? 'character' : item.actor?.type ?? 'character';
    const monsterIdentifier = actorType === 'npc' ? documentUtils.getIdentifier(item.actor) : undefined;
    if (!identifier || !rules) return;
    if (!source) {
        const allAutomations = constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true, type, monsterIdentifier, sourceType});
        return allAutomations.find(automation => automation.uuid === item.uuid);
    }
    return constants.automations.getAutomationByIdentifier(identifier, {rules, source, monsterIdentifier, type, sourceType});
}
/**
 * Automation status of an item, or the lowest status across an actor's items.
 * @param {Item5e|Actor5e} document Document to act on.
 * @returns {number} A {@link constants.automationStatus} value, or -2 for an unsupported document.
 */
function getAutomationStatus(document) {
    if (document.documentName === 'Item') return getItemAutomationStatus(document);
    if (document.documentName === 'Actor') return getActorAutomationStatus(document);
    return -2;
}
/**
 * The lowest automation status across this actor's items, ignoring items with nothing to automate.
 * @param {Actor5e} actor Actor to act on.
 * @returns {number} A {@link constants.automationStatus} value, or -2 when no item qualifies.
 */
function getActorAutomationStatus(actor) {
    return actor.items.reduce((lowest, item) => {
        const status = getItemAutomationStatus(item);
        if (status === -2) return lowest;
        return lowest === -2 ? status : Math.min(lowest, status);
    }, -2);
}
/**
 * Whether this item is automated, and if so whether it is current, configurable or outdated.
 * @param {Item5e} item Item to act on.
 * @returns {number} A {@link constants.automationStatus} value.
 */
function getItemAutomationStatus(item) {
    const isApplied = getStoredHash(item) || getCurrentAutomation(item);
    if (isApplied) {
        if (!isUpToDate(item)) return constants.automationStatus.OUTDATED;
        const currentAutomation = getCurrentAutomation(item);
        if (currentAutomation?.config) return constants.automationStatus.CONFIGURABLE;
        return constants.automationStatus.UP_TO_DATE;
    }
    if (getAvailableAutomations(item).length) return constants.automationStatus.AVAILABLE;
    if (item.flags.cat?.genericConfig) return constants.automationStatus.GENERIC;
    return constants.automationStatus.UNAVAILABLE;
}
/**
 * Whether the applied automation is current: a registered automation is compared by version, an embedded one by content hash. True when nothing is applied.
 * @param {Item5e} item Item to act on.
 * @returns {boolean}
 */
function isUpToDate(item) {
    const currentAutomation = getCurrentAutomation(item);
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
 * Every registered automation that could be applied to this item, across all sources.
 * @param {Item5e} item Item to act on.
 * @param {object} [options] Additional options.
 * @param {string[]} [options.excludeSources] Sources to leave out.
 * @returns {Automation[]}
 */
function getAvailableAutomations(item, {excludeSources = []} = {}) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item) ?? 'all';
    const type = item.type;
    const sourceType = itemUtils.getAdvancementSourceKey(item);
    return constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true, type, excludeSources, sourceType});
}
/**
 * One config value for the automation on this document, falling back to the registered default.
 * @param {foundry.abstract.Document} item Item to act on.
 * @param {string} key Config key.
 * @returns {*}
 */
function getConfigValue(item, key) {
    return constants.automations.getConfigValue(item, key);
}
/**
 * One config value for a generic macro applied to this document, falling back to its default.
 * @param {foundry.abstract.Document} item Item to act on.
 * @param {string} source Module that registered the generic macro.
 * @param {string} identifier Generic macro identifier.
 * @param {string} key Config key.
 * @param {object} [options] Additional options.
 * @param {'2014'|'2024'|'all'} [options.rules] Defaults to the document's own rules.
 * @returns {*}
 */
function getGenericConfigValue(item, source, identifier, key, {rules} = {}) {
    return constants.macros.getGenericConfigValue(item, source, identifier, key, {rules});
}
/**
 * Store one config value for the automation on this document.
 * @param {foundry.abstract.Document} item Item to act on.
 * @param {string} key Config key.
 * @param {*} value Value to store.
 * @returns {Promise<foundry.abstract.Document>}
 */
async function setConfigValue(item, key, value) {
    if (item.documentName === 'Activity') {
        const updateKey = 'flags.cat.config.' + key;
        return await documentUtils.update(item, {[updateKey]: value});
    }
    return await documentUtils.setFlag(item, 'cat', 'config.' + key, value);
}
/**
 * Store one config value for a generic macro applied to this document.
 * @param {foundry.abstract.Document} item Item to act on.
 * @param {string} source Module that registered the generic macro.
 * @param {string} identifier Generic macro identifier.
 * @param {string} key Config key.
 * @param {*} value Value to store.
 * @returns {Promise<foundry.abstract.Document>}
 */
async function setGenericConfigValue(item, source, identifier, key, value) {
    return await documentUtils.setFlag(item, 'cat', 'genericConfig.' + source + '.' + identifier + '.' + key, value);
}
/**
 * {@link getConfigValue} for several keys at once.
 * @param {foundry.abstract.Document} item Item to act on.
 * @param {string[]} [keys] Config keys to read.
 * @returns {object} Values keyed by config key.
 */
function getConfigValues(item, keys = []) {
    const results = {};
    keys.forEach(key => {
        results[key] = getConfigValue(item, key);
    });
    return results;
}
/**
 * {@link getGenericConfigValue} for several keys at once.
 * @param {foundry.abstract.Document} item Item to act on.
 * @param {string} source Module that registered the generic macro.
 * @param {string} identifier Generic macro identifier.
 * @param {string[]} [keys] Config keys to read.
 * @returns {object} Values keyed by config key.
 */
function getGenericConfigValues(item, source, identifier, keys = []) {
    const results = {};
    keys.forEach(key => {
        results[key] = getGenericConfigValue(item, source, identifier, key);
    });
    return results;
}
/**
 * Store several automation config values in one update.
 * @param {foundry.abstract.Document} item Item to act on.
 * @param {object} [values] Values keyed by config key.
 * @returns {Promise<foundry.abstract.Document|undefined>}
 */
async function setConfigValues(item, values = {}) {
    const updates = {};
    for (const [key, value] of Object.entries(values)) {
        updates['flags.cat.config.' + key] = value;
    }
    return await documentUtils.update(item, updates);
}
/**
 * Store several generic macro config values in one update.
 * @param {foundry.abstract.Document} item Item to act on.
 * @param {string} source Module that registered the generic macro.
 * @param {string} identifier Generic macro identifier.
 * @param {object} [values] Values keyed by config key.
 * @returns {Promise<foundry.abstract.Document|undefined>}
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
 * Every generic macro config stored on this item, keyed by source and then identifier.
 * @param {Item5e} item Item to act on.
 * @returns {object}
 */
function getAllGenericConfigs(item) {
    return item.flags.cat?.genericConfig || {};
}
/**
 * Replace every generic macro config on this item.
 * @param {Item5e} item Item to act on.
 * @param {object} configData Keyed by source and then identifier.
 * @returns {Promise<foundry.abstract.Document|undefined>}
 */
async function setAllGenericConfigs(item, configData) {
    return await documentUtils.update(item, {'flags.cat.genericConfig': configData});
}
/**
 * Enabled automation source ids, in the priority order the user configured.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.packsOnly] Only sources that supply a compendium.
 * @returns {string[]}
 */
function getAutomationSources({packsOnly = false} = {}) {
    const settings = game.settings.get('cat', 'automationSources');
    const entries = Object.entries(settings).filter(([key, value]) => value.enabled && (!packsOnly || value.pack)).map(([key, value]) => [key, value.priority]);
    return entries.sort((a, b) => a[1] - b[1]).map(([key]) => key);
}
/**
 * Display name for an automation source, resolving registered names, compendiums, modules and the system.
 * @param {string} id Automation source id.
 * @returns {string} The id itself when nothing else matches.
 */
function getSourceName(id) {
    return constants.automations?.sourceNames?.[id]
        ?? game.packs.get(id)?.metadata.label
        ?? game.modules.get(id)?.title
        ?? (game.system?.id === id ? game.system.title : null)
        ?? id;
}
/**
 * Enabled compendium ids for one kind of source document, in the priority order the user configured.
 * @param {'Monster'|'Item'|'Spell'|'Macro'} type Kind of source document.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.packsOnly] Only sources that supply a compendium.
 * @returns {string[]|undefined} Undefined for an unsupported type.
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
 * The automation already applied to this item, or the best available one by source priority.
 * @param {Item5e} item Item to act on.
 * @returns {Automation|undefined}
 */
function getAppliedOrPreferredAutomation(item) {
    const currentAutomation = getCurrentAutomation(item);
    if (currentAutomation) return currentAutomation;
    const allAutomations = getAvailableAutomations(item);
    if (!allAutomations.length) return;
    const sources = getAutomationSources();
    for (const source of sources) {
        const match = allAutomations.find(automation => automation.source === source);
        if (match) return match;
    }
}
/**
 * Repoint every cast activity at the same spell in the user's preferred spell compendium,
 * so a cast grants the automated copy rather than whichever compendium the automation shipped against.
 * @param {object} documentData Mutated in place.
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
 * Apply an automation to an item, replacing it with the source document while keeping the paths in
 * {@link constants.getItemKeepPaths}, the item's artwork, and any enchantment applied to it. Also relinks
 * cast activities, injects registered scales, and fires the medkit event.
 * @param {Item5e} item Item to act on.
 * @param {object} [options] Additional options.
 * @param {string} [options.source] Force a source rather than using the preferred one.
 * @param {string} [options.monsterIdentifier] Narrows the lookup for monster feature automations.
 * @param {boolean} [options.skipEvent] Do not fire the medkit item event.
 * @param {boolean} [options.openSheet] Render the item sheet afterwards.
 */
async function updateItem(item, {source, monsterIdentifier, skipEvent, openSheet} = {}) {
    let automation;
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item);
    if (source) {
        const sourceType = itemUtils.getAdvancementSourceKey(item);
        automation = constants.automations.getAutomationByIdentifier(identifier, {rules, source, monsterIdentifier, type: item.type, sourceType});
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
    const existingDescription = genericUtils.getProperty(documentData, 'system.description.value');
    if (existingDescription) {
        const stripped = itemUtils.stripDescriptionBlock(existingDescription);
        genericUtils.setProperty(documentData, 'system.description.value', game.settings.get('cat', 'fixDescriptionEnrichers') ? itemUtils.resolveDescriptionEnrichers(stripped, item) : stripped);
    }
    genericUtils.setProperty(documentData, 'flags.cat.automation.source', automation.source);
    genericUtils.setProperty(documentData, 'flags.cat.automation.version', automation.version);
    if (documentData.flags.cat.automation.sourceType) delete documentData.flags.cat.automation.sourceType;
    const defaultImages = Object.values(CONFIG.DND5E.defaultArtwork.Item);
    if (!defaultImages.includes(oldDocumentData.img)) {
        documentData.effects.filter(effect => effect.img === documentData.img).forEach(effect => effect.img = oldDocumentData.img);
        if (documentData.system.activities) Object.values(documentData.system.activities).filter(activity => activity.img === documentData.img).forEach(activity => activity.img = oldDocumentData.img);
        documentData.img = oldDocumentData.img;
    }
    for (const effect of documentData.effects) {
        if (effect.origin !== sourceDocument.uuid) continue;
        effect.origin = item.uuid;
    }
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
    if (!skipEvent && actor) await itemEvents.itemMedkit(item);
    if (openSheet) await item.sheet.render(true);
}
/**
 * One animation config value for an animation chosen through a generic macro's config.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {string} source Module that registered the generic macro.
 * @param {string} identifier Generic macro identifier.
 * @param {string} settingKey Config key holding the animation selection.
 * @param {string} key Animation config key.
 * @returns {*}
 */
function getGenericAnimationConfig(document, source, identifier, settingKey, key) {
    return constants.animations.getGenericAnimationConfig(document, source, identifier, settingKey, key);
}
/**
 * One animation config value for an animation chosen through an automation's own config.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {string} settingKey Config key holding the animation selection.
 * @param {string} key Animation config key.
 * @returns {*} Undefined when no animation is selected.
 */
function getAnimationConfig(document, settingKey, key) {
    const animationData = getConfigValue(document, settingKey);
    if (!animationData?.source || !animationData?.identifier) return;
    return constants.animations.getAnimationConfig(document, animationData.source, animationData.identifier, key);
}
/**
 * Whether a scale advancement already on a class or subclass matches the registered one.
 * @param {Scale} registeredScale Scale registered by an automation.
 * @param {object} targetScale Existing ScaleValue advancement.
 * @returns {boolean}
 */
function scalesMatch(registeredScale, targetScale) {
    if (targetScale.type !== registeredScale.data.type) return false;
    for (const [key, data] of Object.entries(registeredScale.data.configuration.scale)) {
        const target = targetScale.configuration.scale[key];
        if (!target) return false;
        for (const [valueKey, value] of Object.entries(data)) {
            const targetValue = target[valueKey];
            if (targetValue !== value) return false;
        }
    }
    return true;
}
/**
 * The class or subclass on this actor that a scale should be written to.
 * @param {Actor5e} actor Actor to act on.
 * @param {string} identifier Class or subclass identifier.
 * @returns {Item5e|undefined}
 */
function resolveScaleHolder(actor, identifier) {
    if (!identifier) return;
    return actor.classes[identifier] ?? actor.itemTypes.subclass.find(subclass => subclass.identifier === identifier);
}
/**
 * Write the scales an automation registers onto the actor's class or subclass, as named by the automation's
 * classIdentifier and subclassIdentifier config. Scales already matching are left alone.
 * @param {Item5e} item Item to act on.
 * @param {object} [options] Additional options.
 * @param {Automation} [options.automation] Defaults to the automation currently applied.
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
        const advancementKey = scaleValue ? scaleValue.id : (scale.data._id ?? foundry.utils.randomID());
        const classData = classItem.toObject();
        classData.system.advancement[advancementKey] = scale.data;
        classData.system.advancement[advancementKey].configuration.identifier = scale.identifier;
        if (scaleValue) delete classData.system.advancement[advancementKey]._id;
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
 * Small non-cryptographic string hash, used to tell whether an embedded automation has been edited.
 * @param {string} str String to hash.
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
 * Hash of this document's meaningful data, ignoring ids, sorting, ownership,
 * artwork and any path the medkit preserves across an update.
 * @param {foundry.abstract.Document} document Document to act on.
 * @returns {number}
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
    for (const path of keepPaths) {
        const parts = path.split('.');
        parts[parts.length - 1] = '-=' + parts[parts.length - 1];
        deletions[parts.join('.')] = null;
    }
    deletions['flags.cat.-=automation'] = null;
    genericUtils.mergeObject(documentData, genericUtils.expandObject(deletions), {applyOperators: true});
    if (genericUtils.isEmpty(documentData.flags?.cat)) delete documentData.flags.cat;
    const jsonDocument = JSON.stringify(documentData);
    return simpleHash(jsonDocument);
}
/**
 * Store a document hash so later edits can be detected.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {number} hash Hash to store.
 * @returns {Promise<foundry.abstract.Document>}
 */
async function setDocumentHash(document, hash) {
    return await documentUtils.setFlag(document, 'cat', 'automation.hash', hash);
}
/**
 * The hash stored by {@link setDocumentHash}, if any.
 * @param {foundry.abstract.Document} document Document to act on.
 * @returns {number|undefined}
 */
function getStoredHash(document) {
    return document.flags.cat?.automation?.hash;
}
/**
 * Find a source document by identifier, searching the configured compendiums in priority order.
 * @param {string} identifier Identifier to match.
 * @param {'Monster'|'Item'|'Spell'|'Macro'} type Kind of source document.
 * @returns {Promise<foundry.abstract.Document|undefined>}
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
 * Run a called event, letting macros respond to something that is not a workflow.
 * @param {string} pass Called event pass to run.
 * @param {Actor5e} actor Actor to act on.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.multiResult] Collect a result from every macro rather than the first.
 * @param {boolean} [options.canOverlap] Allow several macros with the same name to run.
 * @param {object} [options.data] Passed to the macros.
 * @returns {Promise<*>}
 */
async function calledEvent(pass, actor, {multiResult, canOverlap, data} = {}) {
    return new Events.CalledEvent(actor, pass, data).run({canOverlap, multiResult});
}
/**
 * {@link calledEvent} for synchronous callers, such as data preparation.
 * @param {string} pass Called event pass to run.
 * @param {Actor5e} actor Actor to act on.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.multiResult] Collect a result from every macro rather than the first.
 * @param {boolean} [options.canOverlap] Allow several macros with the same name to run.
 * @param {object} [options.data] Passed to the macros.
 * @returns {*}
 */
function calledEventSync(pass, actor, {multiResult, canOverlap, data} = {}) {
    return new Events.CalledEvent(actor, pass, data).runSync({canOverlap, multiResult});
}
/**
 * The animation selected in a config key, together with its own config values.
 * Pass a source and identifier when the selection lives in a generic macro's config rather than an automation's.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {string} settingKey Config key holding the animation selection.
 * @param {object} [options] Additional options.
 * @param {string} [options.source] Module that registered the generic macro.
 * @param {string} [options.identifier] Generic macro identifier.
 * @param {'2014'|'2024'|'all'} [options.rules] Rules edition. Defaults to the document's own.
 * @returns {{animation: Animation|undefined, options: object}} Animation is undefined when none is selected.
 */
function getResolvedAnimation(document, settingKey, {source, identifier, rules} = {}) {
    const isGeneric = source && identifier;
    const animationSetting = isGeneric ? getGenericConfigValue(document, source, identifier, settingKey, {rules}) : getConfigValue(document, settingKey);
    if (!animationSetting || !animationSetting.source || !animationSetting.identifier || animationSetting.source === 'none' || animationSetting.identifier === 'none') return {animation: undefined, options: {}};
    const animation = constants.animations.getAnimation(animationSetting.source, animationSetting.identifier);
    if (!animation) return {animation: undefined, options: {}};
    const options = {};
    if (animation.config) Object.keys(animation.config).forEach(key => options[key] = isGeneric ? getGenericAnimationConfig(document, source, identifier, settingKey, key) : getAnimationConfig(document, settingKey, key));
    return {animation, options};
}
/**
 * Find a document by name, searching the configured compendiums for that type in priority order.
 * @param {string} name Document name to match.
 * @param {'monster'|'item'|'spell'|'macro'} type Kind of source document.
 * @returns {Promise<foundry.abstract.Document|undefined>}
 */
async function getCompendiumDocumentByName(name, type) {
    if (!['monster', 'item', 'spell', 'macro'].includes(type)) return;
    let setting = Object.entries(game.settings.get('cat', type + 'Compendiums')).map(([key, value]) => ({id: key, ...value})).filter(i => i.enabled).sort((a, b) => a.priority - b.priority);
    let result;
    for (const data of setting) {
        result = await compendiumUtils.getDocumentByName(data.id, name);
        if (result) return result;
    }
}
export default {
    getCurrentAutomation,
    getAutomationStatus,
    getAvailableAutomations,
    getConfigValue,
    getGenericConfigValue,
    setConfigValue,
    setGenericConfigValue,
    getConfigValues,
    getGenericConfigValues,
    setConfigValues,
    setGenericConfigValues,
    getAutomationSources,
    getAppliedOrPreferredAutomation,
    updateItem,
    updateScales,
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
    getAnimationConfig,
    getResolvedAnimation,
    getCompendiumDocumentByName
};
