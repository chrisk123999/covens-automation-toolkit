import {documentUtils, genericUtils} from './_module.mjs';
import {constants} from '../lib/_module.mjs';
import {itemEvents} from '../events/_module.mjs';
function getCurrentAutomation(item) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item);
    const source = documentUtils.getSource(item);
    const type = item.type;
    const actorType = type === 'spell' ? 'character' : item.actor?.type ?? 'character';
    const monsterIdentifier = actorType === 'npc' ? documentUtils.getIdentifier(item.actor) : undefined;
    if (!identifier || !rules || !source) return;
    return constants.automations.getAutomationByIdentifier(identifier, {rules, source, monsterIdentifier, type});
}
// TODO: May need to improve this, went with something simple
function getAutomationStatus(item) {
    const STATUSES = {
        UNAVAILABLE: -2,
        AVAILABLE: -1,
        OUTDATED: 0,
        UP_TO_DATE: 1,
        CONFIGURABLE: 2,
        GENERIC: 3
    };
    if (item.flags.cat?.config?.generic) return STATUSES.GENERIC;
    else {
        const storedHash = getStoredHash(item);
        if (storedHash) {
            const hash = getDocumentHash(item);
            if (hash != storedHash) return STATUSES.OUTDATED;
            return STATUSES.UP_TO_DATE;
        } else {
            const currentAutomation = getCurrentAutomation(item);
            if (currentAutomation) {
                if (foundry.utils.isNewerVersion(currentAutomation.version, documentUtils.getVersion(item))) return STATUSES.OUTDATED;
                if (currentAutomation.config) return STATUSES.CONFIGURABLE;
                return STATUSES.UP_TO_DATE;
            }
            if (getAvailableAutomations(item).length) return STATUSES.AVAILABLE;
        }
    }
    return STATUSES.UNAVAILABLE;
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
    return constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true}, type);
}
function getConfigValue(item, key) {
    return constants.automations.getConfigValue(item, key);
}
function getAutomationSources() {
    const settings = game.settings.get('cat', 'automationSources');
    return Object.entries(settings).filter(([key, value]) => value.enabled).sort((a, b) => a[1].priority - b[1].priority).map(([key, value]) => key);
}
function getAppliedOrPreferedAutomation(item) {
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
        automation = getAppliedOrPreferedAutomation(item);
    }
    if (!automation) return;
    const sourceDocument = await fromUuid(automation.uuid);
    if (!sourceDocument) return;
    const documentData = sourceDocument.toObject();
    documentData._id = item.id;
    delete documentData.ownership;
    const keepPaths = [
        '_stats.compendiumSource',
        'flags.ddbimporter',
        'flags.dnd5e.advancementOrigin',
        'flags.dnd5e.cachedFor',
        'flags.dnd5e.sourceId',
        'flags.tidy5e-sheet',
        'folder',
        'name',
        'system.advancement',
        'system.attunement',
        'system.chatFlavor',
        'system.container',
        'system.description.chat',
        'system.description.value',
        'system.equipped',
        'system.materials',
        'system.quantity',
        'system.source',
        'system.sourceItem',
        'system.prepared',
        'system.method',
        'flags.core.sourceId',
        'flags.cat.config',
        'ownership',
        'sort'
    ];
    if (item.type === 'spell') keepPaths.push('system.uses');
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
    await documentUtils.deleteDocument(item);
    let document;
    if (actor) {
        document = (await documentUtils.createEmbeddedDocuments(actor, 'Item', [documentData], {keepId: true}))?.[0];
    } else {
        document = await Item.create(documentData, {keepId: true}); //May need to GM socket this.
    }
    if (!document) return;
    if (!skipEvent && actor) await itemEvents.itemMedkit(document);
    if (openSheet) await document.sheet.render(true);
}
async function updateScales(item, {automation} = {}) {
    automation ??= getCurrentAutomation(item);
    if (!automation) return;
    const rules = documentUtils.getRules(item);
    const classIdentifier = getConfigValue(item, 'classIdentifier');
    const subclassIdentifier = getConfigValue(item, 'subclassIdentifier');
    const updates = [];
    automation.scales.forEach(scaleData => {
        let scale = constants.scales.getScaleByIdentifier(scaleData.identifier, {rules, source: scaleData.source, classIdentifier});
        let targetIdentifier = classIdentifier;
        if (!scale && subclassIdentifier) {
            scale = constants.scales.getScaleByIdentifier(scaleData.identifier, {rules, source: automation.source, classIdentifier: subclassIdentifier});
            targetIdentifier = subclassIdentifier;
        }
        if (!scale) return;
        const classItem = item.actor.classes[targetIdentifier];
        if (!classItem) return;
        const scaleValue = classItem.advancement.byType.ScaleValue.find(i => i.configuration.identifier === scale.identifier);
        if (scaleValue && scaleValue.type === scale.data.type) return;
        const advancementKey = scaleValue ? scaleValue.id : (scale.data._id ?? foundry.utils.randomID());
        const classData = classItem.toObject();
        classData.system.advancement[advancementKey] = scale.data;
        if (scaleValue) delete classData.system.advancement[advancementKey]._id;
        const change = {_id: classItem.id, 'system.advancement': classData.system.advancement};
        const currentUpdate = updates.find(i => i._id === classItem.id);
        if (currentUpdate) {
            genericUtils.mergeObject(currentUpdate, change);
        } else {
            updates.push(change);
        }
    });
    if (updates.length) {
        await documentUtils.updateEmbeddedDocuments(item.actor, 'Item', updates);
    }
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
    const deleteFields = ['_stats', '_id', 'folder', 'sort', 'ownership'];
    for (let field of deleteFields) delete documentData[field];
    if (documentData.flags.cat?.automation?.hash) delete documentData.flags.cat.automation.hash;
    if (foundry.utils.isEmpty(documentData.flags.cat)) delete documentData.flags.cat;
    const jsonDocument = JSON.stringify(documentData);
    return simpleHash(jsonDocument);
}
async function setDocumentHash(document, hash) {
    return await documentUtils.setFlag(document, 'cat', 'automation.hash', hash);
}
function getStoredHash(document) {
    return document.flags.cat?.automation?.hash;
}
/**
 * Stub for Chris's planned API. Replaces flags.cat.macros wholesale with the per-event entries provided.
 * @param {Document} document
 * @param {Object<string, Array<{identifier:string, source:string, rules:string}>>} eventMap
 *   e.g. {roll: [{identifier, source, rules}], save: [...]}
 */
async function setRegisteredMacros(document, eventMap) {
    if (!document) return;
    return documentUtils.update(document, {'flags.cat.macros': eventMap});
}

export default {
    getCurrentAutomation,
    getAutomationStatus,
    getAvailableAutomations,
    setRegisteredMacros,
    getConfigValue,
    getAutomationSources,
    getAppliedOrPreferedAutomation,
    updateItem,
    updateScales,
    getDocumentHash,
    setDocumentHash,
    getStoredHash,
    isUpToDate
};