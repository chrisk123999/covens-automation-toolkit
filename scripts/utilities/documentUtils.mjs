import {activityUtils, actorUtils, effectUtils, itemUtils, queryUtils, regionUtils, tokenUtils} from './_module.mjs';
function getRules(document, {documentType = document.documentName} = {}) {
    return documentType === 'Item' ? document.system.source.rules : document.flags.cat?.automation?.rules;
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
function getVersion(document) {
    return document.flags.cat?.automation?.version;
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
    return documents;
}
async function deleteDocument(document, {options, forceGM = false} = {}) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission && !forceGM) {
        await document.delete(options);
    } else {
        await queryUtils.query('cat.deleteDocument', queryUtils.gmUser(), {uuid: document.uuid, options});
    }
    return document;
}
export default {
    getRules,
    getSource,
    getIdentifier,
    getVersion,
    getSavedCastData,
    deleteEmbeddedDocuments,
    deleteDocument
};