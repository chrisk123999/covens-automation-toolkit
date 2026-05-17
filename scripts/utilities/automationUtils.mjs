import {documentUtils, genericUtils} from './_module.mjs';
import {constants} from '../lib/_module.mjs';
import {itemEvents} from '../events/_module.mjs';
function getCurrentAutomation(item) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item);
    const source = documentUtils.getSource(item);
    const type = item.type === 'spell' ? 'character' : item.actor?.type ?? 'character';
    const monsterIdentifier = type === 'npc' ? documentUtils.getIdentifier(item.actor) : undefined;
    if (!identifier || !rules || !source) return;
    return constants.automations.getAutomationByIdentifier(identifier, {rules, source, monsterIdentifier});
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
        const currentAutomation = getCurrentAutomation(item);
        if (currentAutomation) {
            if (foundry.utils.isNewerVersion(currentAutomation.version, documentUtils.getVersion(item))) return STATUSES.OUTDATED;
            if (currentAutomation.config) return STATUSES.CONFIGURABLE;
            return STATUSES.UP_TO_DATE;
        }
        if (getAvailableAutomations(item).length) return STATUSES.AVAILABLE;
    }
    return STATUSES.UNAVAILABLE;
}
function getAvailableAutomations(item) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item) ?? 'all';
    return constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true});
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
        document = await Item.create(documentData, {keepId: true});
    }
    if (!document) return;
    if (!skipEvent && actor) await itemEvents.itemMedkit(document);
    if (openSheet) await document.sheet.render(true);
}
export default {
    getCurrentAutomation,
    getAutomationStatus,
    getAvailableAutomations,
    getConfigValue,
    getAutomationSources,
    getAppliedOrPreferedAutomation,
    updateItem
};