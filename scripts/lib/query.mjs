import {documentUtils, effectUtils, itemUtils, tokenUtils, workflowUtils} from '../utilities/_module.mjs';
import DialogApp, {dialogQueue} from '../applications/dialog.mjs';
import Logging from './logging.mjs';
async function dialog({title, content, inputs, buttons, config}) {
    return await DialogApp.dialog(title, content, inputs, buttons, config);
}
async function queuedDialog({title, content, inputs, buttons, config}) {
    return await dialogQueue.showDialog(async (...args) => await DialogApp.dialog(...args), title, content, inputs, buttons, config);
}
function macroWarning({source, identifier, message, user}) {
    Logging.addMacroWarning(source, identifier, message, {user});
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
async function deleteItemsByFlag({scope, key, value}) {
    return itemUtils.deleteWorldItemsByFlag(scope, key, value);
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
async function manualRoll({roll: rollData, label}) {
    const ResolverClass = CONFIG.Dice.fulfillment.methods.cat?.resolver;
    if (!ResolverClass) return [];
    const roll = Roll.fromData(rollData);
    const resolver = new ResolverClass(roll);
    resolver._forcePrompt = true;
    resolver._remoteLabel = label;
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
async function updateTargets({ids}) {
    canvas.tokens?.setTargets(ids);
}
async function addFavorites({actorUuid, entityUuids}) {
    const actor = await fromUuid(actorUuid);
    if (!actor?.system.addFavorite) return;
    const entities = (await Promise.all(entityUuids.map(i => fromUuid(i)))).filter(Boolean);
    for (const entity of entities) {
        const type = entity.documentName;
        if (type === 'Item') {
            await actor.system.addFavorite({
                id: foundry.utils.buildRelativeUuid(entity, entity.actor),
                type: 'item'
            });
        } else if (type === 'Activity') {
            await actor.system.addFavorite({
                id: entity.relativeUUID,
                type: 'activity'
            });
        }
    }
}
async function removeFavorites({actorUuid, entityUuids}) {
    const actor = await fromUuid(actorUuid);
    if (!actor?.system.removeFavorite) return;
    const entities = await Promise.all(entityUuids.map(i => fromUuid(i)).filter(Boolean));
    for (const i of entities) {
        const type = i.documentName;
        if (type === 'Item') {
            await actor.system.removeFavorite(foundry.utils.buildRelativeUuid(i, i.actor));
        } else if (type === 'Activity') {
            await actor.system.removeFavorite(i.relativeUUID);
        }
    }
}
async function syntheticItemDataRoll({itemData, actorUuid, targetUuids, config, options, dialog, message, atLevel, consumeUsage, consumeResources, spellSlot, fast}) {
    const actor = await fromUuid(actorUuid);
    const targets = targetUuids.map(t => fromUuidSync(t));
    const workflow = await workflowUtils.syntheticItemDataRoll(itemData, actor, targets, {config, options, dialog, message, atLevel, consumeUsage, consumeResources, spellSlot, fast});
    return workflow?.getSafeMacroData();
}
async function syntheticActivityDataRoll({activityData, itemUuid, targetUuids, config, options, dialog, message, atLevel, consumeUsage, consumeResources, spellSlot, fast}) {
    const item = await fromUuid(itemUuid);
    const targets = targetUuids.map(t => fromUuidSync(t));
    const workflow = await workflowUtils.syntheticActivityDataRoll(activityData, item, targets, {config, options, dialog, message, atLevel, consumeResources, consumeUsage, spellSlot, fast});
    return workflow?.getSafeMacroData();
}
async function aimDestination({uuid, range, centerpoint, requireSight, ignoreWalls}) {
    const token = await fromUuid(uuid);
    if (!token) return;
    const destination = await tokenUtils.aimDestination(token, {range, centerpoint, requireSight, ignoreWalls});
    if (!destination) return;
    return {x: destination.x, y: destination.y, elevation: destination.elevation, level: destination.level, cancelled: destination.cancelled};
}
function registerQueries() {
    const handlers = {
        aimDestination,
        createEffects,
        deleteEmbeddedDocuments,
        deleteDocument,
        deleteItemsByFlag,
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
        moveToken,
        updateTargets,
        addFavorites,
        removeFavorites,
        syntheticItemDataRoll,
        syntheticActivityDataRoll,
        macroWarning
    };
    for (const [name, fn] of Object.entries(handlers)) {
        globalThis.CONFIG.queries['cat.' + name] = fn;
    }
}
export default {
    createEffects,
    deleteEmbeddedDocuments,
    deleteDocument,
    deleteItemsByFlag,
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
    moveToken,
    updateTargets,
    addFavorites,
    removeFavorites,
    syntheticItemDataRoll,
    syntheticActivityDataRoll
};