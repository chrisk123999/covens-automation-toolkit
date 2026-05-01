import {documentUtils, effectUtils} from '../utilities/_module.mjs';
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
    return documents.map(effect => effect.uuid);
}
async function deleteDocument({uuid, options}) {
    const document = await fromUuid(uuid);
    if (!document) return;
    await document.delete(options);
    return uuid;
}
function registerQueries() {
    globalThis.CONFIG.queries.cat = {
        createEffects,
        deleteEmbeddedDocuments,
        deleteDocument
    };
}
export default {
    createEffects,
    deleteEmbeddedDocuments,
    deleteDocument,
    registerQueries
};