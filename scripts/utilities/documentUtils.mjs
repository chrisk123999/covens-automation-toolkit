import {activityUtils, actorUtils, effectUtils, itemUtils, queryUtils, regionUtils, tokenUtils} from './_module.mjs';
function getRules(document, {documentType = document.documentName} = {}) {
    return documentType === 'Item' ? document.system.source.rules : document.flags.cat?.automation?.rules;
}
function getSource(document) {
    return document.flags.cat?.automation?.source;
}
function getIdentifier(document, {documentType = document.documentName} = {}) {
    switch (documentType) {
        case 'Activity': return document.identifier;
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
async function deleteEmbeddedDocuments(document, type, ids, {forceGM = false, options} = {}) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    let documents;
    if (hasPermission && !forceGM) {
        documents = await document.deleteEmbeddedDocuments(type, ids, options);
    } else {
        const uuids = await queryUtils.query('deleteEmbeddedDocuments', queryUtils.gmUser(), {uuid: document.uuid, type, ids, options});
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
        await queryUtils.query('deleteDocument', queryUtils.gmUser(), {uuid: document.uuid, options});
    }
    return document;
}
async function createEmbeddedDocuments(document, type, updates, options) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        return await document.createEmbeddedDocuments(type, updates, options);
    } else {
        const uuids = await queryUtils.query('createEmbeddedDocuments', queryUtils.gmUser(), {uuid: document.uuid, type, updates, options});
        return await Promise.all(uuids.map(async uuid => await fromUuid(uuid)));
    }
}
async function update(document, updates, options) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        await document.update(updates, options);
    } else {
        const uuid = await queryUtils.query('update', queryUtils.gmID(), {uuid: document.uuid, updates, options});
        return await fromUuid(uuid);
    }
}
async function updateEmbeddedDocuments(document, type, updates, options) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        return await document.updateEmbeddedDocuments(type, updates, options);
    } else {
        const uuids = await queryUtils.query('updateEmbeddedDocuments', queryUtils.gmUser(), {uuid: document.uuid, type, updates, options});
        return await Promise.all(uuids.map(async uuid => await fromUuid(uuid)));
    }
}
async function setFlag(document, scope, key, value) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        return await document.setFlag(scope, key, value);
    } else {
        const uuid = await queryUtils.query('setFlag', queryUtils.gmID(), {uuid: document.uuid, scope, key, value});
        return await fromUuid(uuid);
    }
}
function getEffectByIdentifier(document, identifier, {multiple, includeItemEffects} = {}) {
    const predicate = effect => getIdentifier(effect) === identifier;
    let effects;
    if (document.documentName === 'Actor') {
        effects = actorUtils.getEffects(document, {includeItemEffects});
    } else if (document.documentName === 'Item') {
        effects = document.effects;
    } else return;
    if (!multiple) return effects.find(predicate);
    return effects.filter(predicate);
}
async function makeDependent(parentDocument, childDocuments = []) {
    if (!childDocuments.length) return;
    await Promise.all(childDocuments.map(async document => MidiQOL.addDependent(parentDocument, document)));
}
export default {
    getRules,
    getSource,
    getIdentifier,
    getVersion,
    getSavedCastData,
    deleteEmbeddedDocuments,
    deleteDocument,
    createEmbeddedDocuments,
    update,
    updateEmbeddedDocuments,
    setFlag,
    getEffectByIdentifier,
    makeDependent
};