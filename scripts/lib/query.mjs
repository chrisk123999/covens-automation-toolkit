import {documentUtils, effectUtils} from '../utilities/_module.mjs';
import DialogApp, {dialogQueue} from '../applications/dialog.mjs';
async function dialog({title, content, inputs, buttons, config}) {
    return await DialogApp.dialog(title, content, inputs, buttons, config);
}
async function queuedDialog({title, content, inputs, buttons, config, reason}) {
    return await dialogQueue.showDialog(async (...args) => {
        if (reason) ui.notifications.info(reason);
        return await DialogApp.dialog(...args);
    }, title, content, inputs, buttons, config);
}
async function createEffects({uuid, effectDatas, effectOptions}) {
    const document = await fromUuid(uuid);
    if (!document) return;
    const effects = await effectUtils.createEffects(document, effectDatas, {effectOptions});
    return effects.map(effect => effect.uuid);
}
async function deleteEmbeddedDocuments({uuid, type, ids, options}) {
    const document = await fromUuid(uuid);
    if (!document) return;
    const documents = await documentUtils.deleteEmbeddedDocuments(document, type, ids, {options});
    return documents.map(document => document.uuid);
}
async function deleteDocument({uuid, options}) {
    const document = await fromUuid(uuid);
    if (!document) return;
    await document.delete(options);
    return uuid;
}
async function createEmbeddedDocuments({uuid, type, updates, options}) {
    const document = await fromUuid(uuid);
    if (!document) return;
    const documents = await documentUtils.createEmbeddedDocuments(document, type, updates, options);
    return documents.map(document => document.uuid);
}
async function updateEmbeddedDocuments({uuid, type, updates, options}) {
    const document = await fromUuid(uuid);
    if (!document) return;
    const documents = await documentUtils.updateEmbeddedDocuments(document, type, updates, options);
    return documents.map(document => document.uuid);
}
async function update({uuid, updates, options}) {
    const document = await fromUuid(uuid);
    if (!document) return;
    await document.update(updates, options);
    return document.uuid;
}
async function setFlag({uuid, scope, key, value}) {
    const document = await fromUuid(uuid);
    if (!document) return;
    await document.setFlag(scope, key, value);
    return document.uuid;
}
async function createActor({actorData}) {
    const actor = await Actor.implementation.create(actorData);
    return actor.uuid;
}
async function createFolder({folderData}) {
    const folder = await Folder.create(folderData);
    return folder.id;
}
async function manualRoll({roll: rollData}) {
    const ResolverClass = CONFIG.Dice.fulfillment.methods.cat?.resolver;
    if (!ResolverClass) return [];
    const roll = Roll.fromData(rollData);
    const resolver = new ResolverClass(roll);
    resolver._forcePrompt = true;
    await resolver.awaitFulfillment();
    const results = Roll.defaultImplementation.identifyFulfillableTerms(roll.terms).map(term => term.results.map(result => result.result));
    await resolver.close();
    return results;
}
async function modifyBatch({operations}) {
    if (!operations || !operations.length) return [];
    const reconstructedOperations = await Promise.all(operations.map(async op => {
        if (op.parent) op.parent = await fromUuid(op.parent);
        return op;
    }));
    const results = await foundry.documents.modifyBatch(reconstructedOperations);
    return results.map(batch => batch.map(doc => doc.uuid));
}
async function moveToken({uuid, waypoints, options}) {
    const token = await fromUuid(uuid);
    if (!token) return;
    return await token.move(waypoints, options);
}
function registerQueries() {
    const handlers = {
        createEffects,
        deleteEmbeddedDocuments,
        deleteDocument,
        createEmbeddedDocuments,
        dialog,
        queuedDialog,
        updateEmbeddedDocuments,
        update,
        setFlag,
        createActor,
        createFolder,
        manualRoll,
        modifyBatch,
        moveToken
    };
    for (const [name, fn] of Object.entries(handlers)) {
        globalThis.CONFIG.queries['cat.' + name] = fn;
    }
}
export default {
    createEffects,
    deleteEmbeddedDocuments,
    deleteDocument,
    registerQueries,
    createEmbeddedDocuments,
    dialog,
    queuedDialog,
    updateEmbeddedDocuments,
    update,
    setFlag,
    createActor,
    createFolder,
    manualRoll,
    modifyBatch,
    moveToken
};