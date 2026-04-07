import {constants} from '../lib/_module.mjs';
import {activityUtils, actorUtils, effectUtils, itemUtils, queryUtils, regionUtils, sceneUtils, tokenUtils} from '../utilities/_module.mjs';
function getRules(document, {documentType = document.documentName} = {}) {
    let rules = document.flags.cat?.automation?.rules;
    if (rules) return rules;
    if (documentType === 'Item') return document.system.source.rules;
}
function getSource(document) {
    return document.flags.cat?.automation?.source;
}
function getIdentifier(document, {documentType = document.documentName} = {}) {
    switch (documentType) {
        case 'Activity': return document.midiProperties.identifier;
        case 'Item': return document.system.identifier;
        default: return document.flags.cat?.identifier ?? document.name.slugify();
    }
}
function getConfigValue(document, key) {
    return constants.automations?.getConfigValue(document, key);
}
function getVersion(document) {
    return document.flags.cat?.automation?.version;
}
function getCurrentAutomation(document) {
    const identifier = getIdentifier(document);
    const rules = getRules(document);
    const source = getSource(document);
    if (!identifier || !rules || !source) return;
    return constants.automations.getAutomationByIdentifier(identifier, {rules, source});
}
function getAvailableAutomations(document) {
    const identifier = getIdentifier(document);
    const rules = getRules(document) ?? 'all';
    return constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true});
}
// TODO: May need to improve this, went with something simple
function getAutomationStatus(document) {
    const STATUSES = {
        UNAVAILABLE: -2,
        AVAILABLE: -1,
        OUTDATED: 0,
        UP_TO_DATE: 1,
        CONFIGURABLE: 2,
        GENERIC: 3
    };
    if (document.flags.cat?.config?.generic) return STATUSES.GENERIC;
    else {
        const currentAutomation = getCurrentAutomation(document);
        if (currentAutomation) {
            if (foundry.utils.isNewerVersion(currentAutomation.version, getVersion(document))) return STATUSES.OUTDATED;
            if (currentAutomation.config) return STATUSES.CONFIGURABLE;
            return STATUSES.UP_TO_DATE;
        }
        if (getAvailableAutomations(document).length) return STATUSES.AVAILABLE;
    }
    return STATUSES.UNAVAILABLE;
}
function getSavedCastData(document) {
    switch(document.documentName) {
        case 'Activity': return activityUtils.getSavedCastData(document);
        case 'Item': return itemUtils.getSavedCastData(document);
        case 'Token': return tokenUtils.getSavedCastData(document);
        case 'Actor': return actorUtils.getSavedCastData(document);
        case 'Effect': return effectUtils.getCastData(document);
        case 'Region': return regionUtils.getCastData(document);
        default: return {
            castLevel: -1,
            baseLevel: -1,
            saveDC: -1
        };
    }
}
async function deleteEmbeddedDocuments(document, type, ids, options, {forceGM = false} = {}) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    let documents;
    if (hasPermission && !forceGM) {
        documents = await document.deleteEmbeddedDocuments(type, ids, options);
    } else {
        const uuids = await queryUtils.query('cat.deleteEmbeddedDocuments', queryUtils.gmUser(), {uuid: document.uuid, type, ids, options});
        if (!uuids) return;
        documents = (await Promise.all(uuids.map(async uuid => fromUuid(uuid)))).filter(i => i);
    }
    return document;
}
export default {
    getRules,
    getSource,
    getIdentifier,
    getConfigValue,
    getVersion,
    getCurrentAutomation,
    getAvailableAutomations,
    getAutomationStatus,
    getSavedCastData,
    deleteEmbeddedDocuments
};