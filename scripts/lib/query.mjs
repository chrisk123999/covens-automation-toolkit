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
    const effects = await effectUtils.createEffects(document, effectDatas, effectOptions);
    return effects.map(effect => effect.uuid);
}
async function deleteEmbeddedDocuments({uuid, type, ids, options}) {
    const document = await fromUuid(uuid);
    if (!document) return;
    const documents = await documentUtils.deleteEmbeddedDocuments(document, type, ids, options);
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
function registerQueries() {
    const handlers = {
        createEffects,
        deleteEmbeddedDocuments,
        deleteDocument,
        createEmbeddedDocuments,
        dialog,
        queuedDialog
    };
    globalThis.CONFIG.queries.cat = handlers;
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
    queuedDialog
};