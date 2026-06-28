import {documentUtils, genericUtils} from './_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {itemEvents} from '../events/_module.mjs';
function getCurrentAutomation(item) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item);
    const source = documentUtils.getSource(item);
    const type = item.type;
    const actorType = type === 'spell' ? 'character' : item.actor?.type ?? 'character';
    const monsterIdentifier = actorType === 'npc' ? documentUtils.getIdentifier(item.actor) : undefined;
    if (!identifier || !rules) return;
    if (!source) {
        const allAutomations = constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true, type, monsterIdentifier});
        return allAutomations.find(automation => automation.uuid === item.uuid);
    }
    return constants.automations.getAutomationByIdentifier(identifier, {rules, source, monsterIdentifier, type});
}
function getAutomationStatus(document) {
    if (document.documentName === 'Item') return getItemAutomationStatus(document);
    if (document.documentName === 'Actor') return getActorAutomationStatus(document);
    return -2;
}
function getActorAutomationStatus(actor) {
    return actor.items.reduce((lowest, item) => {
        const status = getItemAutomationStatus(item);
        if (status === -2) return lowest;
        return lowest === -2 ? status : Math.min(lowest, status);
    }, -2);
}
function getItemAutomationStatus(item) {
    if (item.flags.cat?.genericConfig) return constants.automationStatus.GENERIC;
    const isApplied = getStoredHash(item) || getCurrentAutomation(item);
    if (isApplied) {
        if (!isUpToDate(item)) return constants.automationStatus.OUTDATED;
        const currentAutomation = getCurrentAutomation(item);
        if (currentAutomation?.config) return constants.automationStatus.CONFIGURABLE;
        return constants.automationStatus.UP_TO_DATE;
    }
    if (getAvailableAutomations(item).length) return constants.automationStatus.AVAILABLE;
    return constants.automationStatus.UNAVAILABLE;
}
function isUpToDate(item) {
    const storedHash = getStoredHash(item);
    if (storedHash) {
        const hash = getDocumentHash(item);
        if (hash != storedHash) return false;
        return true;
    }
    const currentAutomation = getCurrentAutomation(item);
    if (currentAutomation) {
        if (foundry.utils.isNewerVersion(currentAutomation.version, documentUtils.getVersion(item))) return false;
        return true;
    }
    return true;
}
function getAvailableAutomations(item) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item) ?? 'all';
    const type = item.type;
    return constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true, type});
}
function getConfigValue(item, key) {
    return constants.automations.getConfigValue(item, key);
}
function getGenericConfigValue(item, source, identifier, key) {
    return constants.macros.getGenericConfigValue(item, source, identifier, key);
}
async function setConfigValue(item, key, value) {
    return await documentUtils.setFlag(item, 'cat', 'config.' + key, value);
}
async function setGenericConfigValue(item, source, identifier, key, value) {
    return await documentUtils.setFlag(item, 'cat', 'genericConfig.' + source + '.' + identifier + '.' + key, value);
}
function getConfigValues(item, keys = []) {
    const results = {};
    keys.forEach(key => {
        results[key] = getConfigValue(item, key);
    });
    return results;
}
function getGenericConfigValues(item, source, identifier, keys = []) {
    const results = {};
    keys.forEach(key => {
        results[key] = getGenericConfigValue(item, source, identifier, key);
    });
    return results;
}
async function setConfigValues(item, values = {}) {
    const updates = {};
    for (const [key, value] of Object.entries(values)) {
        updates['flags.cat.config.' + key] = value;
    }
    return await documentUtils.update(item, updates);
}
async function setGenericConfigValues(item, source, identifier, values = {}) {
    const updates = {};
    const prefix = 'flags.cat.genericConfig.' + source + '.' + identifier + '.';
    for (const [key, value] of Object.entries(values)) {
        updates[prefix + key] = value;
    }
    return await documentUtils.update(item, updates);
}
function getAllGenericConfigs(item) {
    return item.flags.cat?.genericConfig || {};
}
async function setAllGenericConfigs(item, configData) {
    return await documentUtils.update(item, {'flags.cat.genericConfig': configData});
}
function getAutomationSources({packsOnly = false} = {}) {
    const settings = game.settings.get('cat', 'automationSources');
    const entries = Object.entries(settings).filter(([key, value]) => value.enabled && (!packsOnly || value.pack)).map(([key, value]) => [key, value.priority]);
    return entries.sort((a, b) => a[1] - b[1]).map(([key]) => key);
}
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
async function updateItem(item, {source, monsterIdentifier, skipEvent, openSheet} = {}) {
    let automation;
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item);
    if (source) {
        automation = constants.automations.getAutomationByIdentifier(identifier, {rules, source, monsterIdentifier});
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
    genericUtils.setProperty(documentData, 'flags.cat.automation.source', automation.source);
    genericUtils.setProperty(documentData, 'flags.cat.automation.version', automation.version);
    const defaultImages = Object.values(CONFIG.DND5E.defaultArtwork.Item);
    if (!defaultImages.includes(oldDocumentData.img)) {
        documentData.effects.filter(effect => effect.img === documentData.img).forEach(effect => effect.img = oldDocumentData.img);
        if (documentData.system.activities) Object.values(documentData.system.activities).filter(activity => activity.img === documentData.img).forEach(activity => activity.img = oldDocumentData.img);
        documentData.img = oldDocumentData.img;
    }
    if (item.flags.dnd5e?.cachedFor && item.system.linkedActivity) {
        const enchantId = item.system.linkedActivity.constructor.ENCHANTMENT_ID;
        const enchantment = oldDocumentData.effects.find(effect => effect._id === enchantId);
        if (enchantment) {
            documentData.effects ??= [];
            documentData.effects.push(enchantment);
        }
    }
    const actor = item.actor;
    const pack = item.pack;
    await documentUtils.deleteDocument(item);
    let document;
    if (actor) {
        document = (await documentUtils.createEmbeddedDocuments(actor, 'Item', [documentData], {keepId: true}))?.[0];
    } else {
        document = await Item.create(documentData, {keepId: true, pack}); //May need to GM socket this.
    }
    if (!document) return;
    if (actor) await updateScales(document, {automation});
    if (!skipEvent && actor) await itemEvents.itemMedkit(document);
    if (openSheet) await document.sheet.render(true);
}
function getGenericAnimationConfig(document, source, identifier, settingKey, key) {
    return constants.animations.getGenericAnimationConfig(document, source, identifier, settingKey, key);
}
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
        const classItem = item.actor.classes[targetIdentifier];
        if (!classItem) return;
        const scaleValue = classItem.advancement.byType?.ScaleValue?.find(i => i.configuration.identifier === targetIdentifier);
        if (scaleValue && scaleValue.type === scale.data.type) return;
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
function simpleHash(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; 
    }
    return hash;
}
function getDocumentHash(document) {
    const documentData = document.toObject();
    const deleteFields = ['_stats', '_id', 'folder', 'sort', 'ownership', 'img'];
    for (let field of deleteFields) delete documentData[field];
    if (documentData.effects) documentData.effects.forEach(effect => delete effect.img);
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
async function setDocumentHash(document, hash) {
    return await documentUtils.setFlag(document, 'cat', 'automation.hash', hash);
}
function getStoredHash(document) {
    return document.flags.cat?.automation?.hash;
}
async function getSourceDocumentByIdentifier(identifier, type) {
    const sortedPacks = getSourceDataSources(type);
    if (!sortedPacks) return;
    for (const packId of sortedPacks) {
        const pack = game.packs.get(packId);
        if (!pack) continue;
        const index = await pack.getIndex({fields: ['system.identifier', 'flags.cat.automation.identifier']});
        const match = index.find(document => documentUtils.getIdentifier(document) === identifier);
        if (match) return await pack.getDocument(match._id);
    }
}
async function calledEvent(pass, actor, {multiResult, canOverlap, data} = {}) {
    return new Events.CalledEvent(actor, pass, data).run({canOverlap, multiResult});
}
function calledEventSync(pass, actor, {multiResult, canOverlap, data} = {}) {
    return new Events.CalledEvent(actor, pass, data).runSync({canOverlap, multiResult});
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
    calledEvent,
    calledEventSync
};