import {activityUtils, actorUtils, dataUtils, effectUtils, itemUtils, queryUtils, regionUtils, tokenUtils} from './_module.mjs';
/** @import {CatEffectData} from './dataUtils.mjs' */
/** @import {EffectDurationData} from '@client/documents/_types.mjs' */
/**
 * The rules edition this document belongs to. Items carry it on their source data; everything else carries it on the automation flag.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {object} [options] Additional options.
 * @param {string} [options.documentType] Override the type used to pick where the rules live.
 * @returns {'2014'|'2024'|'all'|undefined}
 */
function getRules(document, {documentType = document.documentName} = {}) {
    return documentType === 'Item' ? document.system.source.rules : document.flags.cat?.automation?.rules;
}
/**
 * Get the module that registered this document's automation.
 * @param {foundry.abstract.Document} document Document to act on.
 * @returns {string|undefined}
 */
function getSource(document) {
    return document.flags.cat?.automation?.source;
}
/**
 * Get the identifier macros use to look this document up.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {object} [options] Additional options.
 * @param {string} [options.documentType] Override the type used to pick where the identifier lives.
 * @returns {string|undefined}
 */
function getIdentifier(document, {documentType = document.documentName} = {}) {
    switch (documentType) {
        case 'Activity': return document.identifier;
        case 'Item': return document.system.identifier;
        default: return document.flags.cat?.identifier ?? document.name.slugify();
    }
}
/**
 * Get the version of the automation registered on this document.
 * @param {foundry.abstract.Document} document Document to act on.
 * @returns {string|undefined}
 */
function getVersion(document) {
    return document.flags.cat?.automation?.version;
}
/**
 * Get the cast data stashed on any supported document type.
 * @param {foundry.abstract.Document} document Document to act on.
 * @returns {{castLevel: number, baseLevel: number, saveDC: number}} Values are -1 when nothing is stashed.
 */
function getSavedCastData(document) {
    let castData;
    switch(document.documentName) {
        case 'Activity': castData = activityUtils.getSavedCastData(document); break;
        case 'Item': castData = itemUtils.getSavedCastData(document); break;
        case 'Token': castData = tokenUtils.getSavedCastData(document); break;
        case 'Actor': castData = actorUtils.getSavedCastData(document); break;
        case 'ActiveEffect': castData = effectUtils.getCastData(document); break;
        case 'Region': castData = regionUtils.getCastData(document); break;
    }
    return {
        castLevel: -1,
        baseLevel: -1,
        saveDC: -1,
        ...castData
    };
}
/**
 * Delete embedded documents, delegating to a GM when the user lacks permission.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {string} type Embedded document name, such as `ActiveEffect`.
 * @param {string[]} ids Ids of the embedded documents to delete.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.forceGM] Delete through a GM even when the user has permission.
 * @param {object} [options.options] Passed to the deletion.
 * @returns {Promise<foundry.abstract.Document[]|undefined>}
 */
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
/**
 * Delete a document, delegating to a GM when the user lacks permission.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {object} [options] Additional options.
 * @param {object} [options.options] Passed to the deletion.
 * @param {boolean} [options.forceGM] Delete through a GM even when the user has permission.
 * @returns {Promise<foundry.abstract.Document>} The now deleted document.
 */
async function deleteDocument(document, {options, forceGM = false} = {}) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission && !forceGM) {
        await document.delete(options);
    } else {
        await queryUtils.query('deleteDocument', queryUtils.gmUser(), {uuid: document.uuid, options});
    }
    return document;
}
/**
 * Create embedded documents, delegating to a GM when the user lacks permission.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {string} type Embedded document name, such as `Item`.
 * @param {object[]} updates Document data to apply.
 * @param {object} [options] Additional options.
 * @returns {Promise<foundry.abstract.Document[]|undefined>}
 */
async function createEmbeddedDocuments(document, type, updates, options) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        return await document.createEmbeddedDocuments(type, updates, options);
    } else {
        const uuids = await queryUtils.query('createEmbeddedDocuments', queryUtils.gmUser(), {uuid: document.uuid, type, updates, options});
        return await Promise.all(uuids.map(async uuid => await fromUuid(uuid)));
    }
}
/**
 * Update a document, delegating to a GM when the user lacks permission.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {object} updates Document data to apply.
 * @param {object} [options] Additional options.
 * @returns {Promise<foundry.abstract.Document|undefined>} Only returned when the update went through a GM.
 */
async function update(document, updates, options) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        await document.update(updates, options);
    } else {
        const uuid = await queryUtils.query('update', queryUtils.gmID(), {uuid: document.uuid, updates, options});
        return await fromUuid(uuid);
    }
}
/**
 * Update embedded documents, delegating to a GM when the user lacks permission.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {string} type Embedded document name, such as `Token`.
 * @param {object[]} updates Each entry needs an `_id`.
 * @param {object} [options] Additional options.
 * @returns {Promise<foundry.abstract.Document[]>}
 */
async function updateEmbeddedDocuments(document, type, updates, options) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        return await document.updateEmbeddedDocuments(type, updates, options);
    } else {
        const uuids = await queryUtils.query('updateEmbeddedDocuments', queryUtils.gmUser(), {uuid: document.uuid, type, updates, options});
        return await Promise.all(uuids.map(async uuid => await fromUuid(uuid)));
    }
}
/**
 * Set a flag on a document, delegating to a GM when the user lacks permission.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {string} scope Module id owning the flag.
 * @param {string} key Flag key, below the scope.
 * @param {*} value Value to store.
 * @returns {Promise<foundry.abstract.Document>}
 */
async function setFlag(document, scope, key, value) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        return await document.setFlag(scope, key, value);
    } else {
        const uuid = await queryUtils.query('setFlag', queryUtils.gmID(), {uuid: document.uuid, scope, key, value});
        return await fromUuid(uuid);
    }
}
/**
 * Get an effect on this document by its identifier.
 * @param {foundry.abstract.Document} document Document to act on.
 * @param {string} identifier Identifier to match.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.multiple] Return every match rather than the first.
 * @param {boolean} [options.includeItemEffects] Also search the effects on the actor's items.
 * @returns {ActiveEffect|ActiveEffect[]|undefined}
 */
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
/**
 * Tie documents to a parent so they are deleted along with it.
 * @param {foundry.abstract.Document} parentDocument Document the others depend on.
 * @param {foundry.abstract.Document[]} [childDocuments] Documents deleted alongside the parent.
 * @returns {Promise<void>}
 */
async function makeDependent(parentDocument, childDocuments = []) {
    if (!childDocuments.length) return;
    await Promise.all(childDocuments.map(async document => MidiQOL.addDependent(parentDocument, document)));
}
/**
 * Run several document operations in one batch, applied all or nothing, delegating to a GM when the user lacks permission.
 * @param {DatabaseWriteOperation[]} operations Write operations to run together.
 * @returns {Promise<Array<foundry.abstract.Document[]>>}
 */
async function modifyBatch(operations) {
    if (queryUtils.isTheGM()) {
        return await foundry.documents.modifyBatch(operations);
    } else {
        operations.forEach(op => {
            if (op.parent) op.parent = op.parent.uuid;
        });
        const uuidBatches = await queryUtils.query('modifyBatch', queryUtils.gmUser(), {operations});
        if (!uuidBatches) return [];
        return await Promise.all(uuidBatches.map(async batch => {
            return (await Promise.all(batch.map(uuid => fromUuid(uuid)))).filter(Boolean);
        }));
    }
}
/**
 * Build an effect based on one attached to an item.
 * @param {foundry.documents.Item|dnd5e.dataModels.activity.BaseActivityData} document An item or activity from which to fetch an effect by {@link id}.
 * @param {string} id Id of the effect on the source document.
 * @param {object} [options] Additional options.
 * @param {EffectDurationData} [options.duration] Effect duration, fetched from {@link document} if absent.
 * @param {foundry.documents.Item} [options.concentrationItem] An item used to fetch a concentration effect, which is assigned as the origin for this effect.
 * @param {CatEffectData} [options.catData] See {@link CatEffectData}
 * @returns
 */
function getEffectData(document, id, {duration, concentrationItem, ...catData} = {}) {
    const sourceEffect = document.item ? document.item.effects.get(id) : document.effects.get(id);
    if (!sourceEffect) return;
    const effectData = sourceEffect.toObject();
    delete effectData._id;
    effectData.origin = !concentrationItem ? sourceEffect.uuid : effectUtils.getConcentrationEffect(document.actor, document.item ?? document)?.uuid;
    if (document.documentName === 'Activity' && !duration) effectData.duration = activityUtils.getEffectDuration(document);
    if (duration) effectData.duration = duration;
    return dataUtils.buildEffectData(effectData, catData);
}
/**
 * Build effect data from scratch, rather than from an effect already on a document.
 * @param {foundry.abstract.Document} document An activity supplies the duration when one is not passed.
 * @param {object} [options] Additional options.
 * @param {string} [options.name] Effect name.
 * @param {string} [options.img] Effect icon.
 * @param {string} [options.origin] Uuid the effect originates from.
 * @param {string} [options.identifier] The CAT identifier other macros will look this effect up by.
 * @param {object[]} [options.changes] Stored as `system.changes`.
 * @param {EffectDurationData} [options.duration] Effect duration data.
 * @param {CatEffectData} [options.buildOptions] See {@link CatEffectData}
 * @returns {object} Effect data ready for creation.
 */
function getBaseEffectData(document, {name, img, origin, identifier, changes = [], duration, ...buildOptions} = {}) {
    const effectData = {
        name,
        img,
        origin,
        system: {changes}
    };
    if (duration) {
        effectData.duration = duration;
    } else if (document?.documentName === 'Activity') {
        effectData.duration = activityUtils.getEffectDuration(document);
    }
    if (identifier) dataUtils.setIdentifier(effectData, identifier);
    return dataUtils.buildEffectData(effectData, buildOptions);
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
    makeDependent,
    modifyBatch,
    getEffectData,
    getBaseEffectData
};
