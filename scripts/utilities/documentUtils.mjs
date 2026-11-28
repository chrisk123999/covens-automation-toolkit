/**
 * Document reads and writes. Writes go through a GM when the user doesn't own the document, and the readers cover CAT
 * identifiers, rules, cast data and effect data.
 * @module
 */
import {constants} from '../lib/_module.mjs';
import {activityUtils, actorUtils, automationUtils, dataUtils, effectUtils, genericUtils, itemUtils, queryUtils, regionUtils, tokenUtils} from './_module.mjs';
/** @import {CatEffectData} from './dataUtils.mjs' */
/** @import {EffectDurationData} from '@client/documents/_types.mjs' */
/**
 * The rules edition this document belongs to. Items read it from `system.source.rules`, except DDB Importer items on
 * an NPC that is not polymorphed, which follow the NPC's stat block. Every other document reads it from the CAT
 * automation flag.
 * @param {foundry.abstract.Document} document  Document to read from.
 * @param {object} [options]                    Additional options.
 * @param {string} [options.documentType]       Read the rules as if the document were this type. Defaults to the
 *                                              document's own type.
 * @returns {'2014'|'2024'|'all'|undefined}
 * @example
 * if (documentUtils.getRules(item) === '2014') return;
 */
function getRules(document, {documentType = document.documentName} = {}) {
    if (documentType !== 'Item') return document.flags.cat?.automation?.rules;
    const actor = document.actor;
    const monsterRules = actor?.type === 'npc' && !actor.isPolymorphed && document.flags?.ddbimporter ? actor.system.source?.rules : undefined;
    return monsterRules || document.system.source.rules;
}
/**
 * The id of the module that registered this document's automation, read from the CAT automation flag.
 * @param {foundry.abstract.Document} document  Document to read from.
 * @returns {string|undefined}
 * @example
 * documentUtils.getSource(item); // 'chris-premades'
 */
function getSource(document) {
    return document.flags.cat?.automation?.source;
}
/**
 * The identifier macros use to look this document up. Activities use their `identifier`, items use `system.identifier`,
 * and every other document uses the CAT identifier flag, falling back to its slugified name.
 * @param {foundry.abstract.Document} document  Document to read from.
 * @param {object} [options]                    Additional options.
 * @param {string} [options.documentType]       Read the identifier as if the document were this type. Defaults to the
 *                                              document's own type.
 * @returns {string|undefined}
 * @example
 * const effect = actor.effects.find(effect => documentUtils.getIdentifier(effect) === 'hex');
 */
function getIdentifier(document, {documentType = document.documentName} = {}) {
    switch (documentType) {
        case 'Activity': return document.identifier;
        case 'Item': return document.system.identifier;
        default: return document.flags.cat?.identifier ?? document.name.slugify();
    }
}
/**
 * The identifier of the NPC that owns this document, used to match monster automations. Returns an empty string on a
 * non-NPC actor, and undefined for spells and documents without an actor.
 * @param {foundry.abstract.Document} document  Document to read from.
 * @returns {string|undefined}
 * @example
 * documentUtils.getMonsterIdentifier(item); // 'goblin' for a Goblin's Scimitar
 */
function getMonsterIdentifier(document) {
    if (!document.actor || document.type === 'spell') return;
    return document.actor.type === 'npc' ? getIdentifier(document.actor) : '';
}
/**
 * The feature type used to match automations, read from `system.type.value`. Any item on an NPC with a class item
 * returns `class`, so it matches class automations like a PC's would.
 * @param {foundry.abstract.Document} document  Document to read from.
 * @returns {string|undefined}
 * @example
 * documentUtils.getMatchFeatType(item); // 'class' for a Fighter's Second Wind
 */
function getMatchFeatType(document) {
    if (document.actor?.type === 'npc' && document.actor.itemTypes.class.length) return 'class';
    return document.system?.type?.value;
}
/**
 * The version of the automation registered on this document, read from the CAT automation flag.
 * @param {foundry.abstract.Document} document  Document to read from.
 * @returns {string|undefined}
 * @example
 * documentUtils.getVersion(item); // '1.2.0'
 */
function getVersion(document) {
    return document.flags.cat?.automation?.version;
}
/**
 * The cast data stashed on an activity, item, token, actor, active effect or region. Missing values are `-1`, and every
 * other document type returns all `-1`.
 * @param {foundry.abstract.Document} document  Document to read from.
 * @returns {{castLevel: number, baseLevel: number, saveDC: number}}
 *                                              Activities also carry `school`.
 * @example
 * const {castLevel, saveDC} = documentUtils.getSavedCastData(effect);
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
 * Delete embedded documents. A user who doesn't own the document, or its actor, sends the deletion to a GM.
 * @param {foundry.abstract.Document} document                Parent of the documents to delete.
 * @param {string} type                                       Embedded document name, such as `ActiveEffect`.
 * @param {string[]} ids                                      Ids of the embedded documents to delete.
 * @param {object} [options]                                  Additional options.
 * @param {boolean} [options.forceGM]                         Delete through a GM even when the user has permission.
 * @param {object} [options.options]                          Passed to the deletion.
 * @returns {Promise<foundry.abstract.Document[]|undefined>}  The deleted documents. Undefined when the GM query fails.
 * @example
 * await documentUtils.deleteEmbeddedDocuments(actor, 'ActiveEffect', effects.map(effect => effect.id));
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
 * Delete a document. A user who can't delete it sends the deletion to a GM. A document that is already gone, or already
 * being deleted, is skipped.
 * @param {foundry.abstract.Document} document    Document to delete.
 * @param {object} [options]                      Additional options.
 * @param {object} [options.options]              Passed to the deletion.
 * @param {boolean} [options.forceGM]             Delete through a GM even when the user has permission.
 * @returns {Promise<foundry.abstract.Document>}  The document passed in, once the deletion has finished.
 * @example
 * await documentUtils.deleteDocument(effect);
 */
async function deleteDocument(document, {options, forceGM = false} = {}) {
    if (document.collection && !document.collection.has(document.id)) return document;
    const pending = pendingDeletions.get(document.uuid);
    if (pending) {
        await pending;
        return document;
    }
    const deletion = (document.canUserModify(game.user, 'delete') && !forceGM)
        ? document.delete(options)
        : queryUtils.query('deleteDocument', queryUtils.gmUser(), {uuid: document.uuid, options});
    pendingDeletions.set(document.uuid, deletion);
    try {
        await deletion;
    } finally {
        pendingDeletions.delete(document.uuid);
    }
    return document;
}
const pendingDeletions = new Map();
/**
 * Create embedded documents. A user who doesn't own the document, or its actor, sends the creation to a GM.
 * @param {foundry.abstract.Document} document                Parent to create the documents on.
 * @param {string} type                                       Embedded document name, such as `Item`.
 * @param {object[]} updates                                  Data for each new document.
 * @param {object} [options]                                  Passed to the creation.
 * @returns {Promise<foundry.abstract.Document[]|undefined>}  The created documents. Undefined when the GM query fails.
 * @example
 * const [created] = await documentUtils.createEmbeddedDocuments(actor, 'Item', [itemData]);
 */
async function createEmbeddedDocuments(document, type, updates, options) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        return await document.createEmbeddedDocuments(type, updates, options);
    } else {
        const uuids = await queryUtils.query('createEmbeddedDocuments', queryUtils.gmUser(), {uuid: document.uuid, type, updates, options});
        if (!uuids) return;
        return await Promise.all(uuids.map(async uuid => await fromUuid(uuid)));
    }
}
/**
 * Update a document. A user who doesn't own the document, or its actor, sends the update to a GM.
 * @param {foundry.abstract.Document} document              Document to update.
 * @param {object} updates                                  Changes to apply.
 * @param {object} [options]                                Passed to the update.
 * @returns {Promise<foundry.abstract.Document|undefined>}  The updated document.
 * @example
 * await documentUtils.update(item, {'system.uses.spent': 0});
 */
async function update(document, updates, options) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    const regionBehavior = document.documentName === 'Region' && 'behaviors' in updates;
    if (hasPermission && !regionBehavior) {
        return await document.update(updates, options);
    } else {
        const uuid = await queryUtils.query('update', queryUtils.gmUser(), {uuid: document.uuid, updates, options});
        return await fromUuid(uuid);
    }
}
/**
 * Update embedded documents. A user who doesn't own the document, or its actor, sends the update to a GM.
 * @param {foundry.abstract.Document} document                Parent of the documents to update.
 * @param {string} type                                       Embedded document name, such as `Token`.
 * @param {object[]} updates                                  Changes for each document. Each entry needs an `_id`.
 * @param {object} [options]                                  Passed to the update.
 * @returns {Promise<foundry.abstract.Document[]|undefined>}  The updated documents. Undefined when the GM query fails.
 * @example
 * await documentUtils.updateEmbeddedDocuments(token.parent, 'Token', [{_id: token.id, hidden: true}]);
 */
async function updateEmbeddedDocuments(document, type, updates, options) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        return await document.updateEmbeddedDocuments(type, updates, options);
    } else {
        const uuids = await queryUtils.query('updateEmbeddedDocuments', queryUtils.gmUser(), {uuid: document.uuid, type, updates, options});
        if (!uuids) return;
        return await Promise.all(uuids.map(async uuid => await fromUuid(uuid)));
    }
}
/**
 * Set a flag on a document. A user who doesn't own the document, or its actor, sends the write to a GM. Activities are
 * written with {@link update}.
 * @param {foundry.abstract.Document} document    Document to write to.
 * @param {string} scope                          Module id owning the flag.
 * @param {string} key                            Flag key, below the scope. Dots create nested keys.
 * @param {*} value                               Value to store.
 * @returns {Promise<foundry.abstract.Document>}  The updated document.
 * @example
 * await documentUtils.setFlag(effect, 'cat', 'hex.targetUuid', target.document.uuid);
 */
async function setFlag(document, scope, key, value) {
    if (document.documentName === 'Activity') return await update(document, {['flags.' + scope + '.' + key]: value});
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    if (hasPermission) {
        return await document.setFlag(scope, key, value);
    } else {
        const uuid = await queryUtils.query('setFlag', queryUtils.gmUser(), {uuid: document.uuid, scope, key, value});
        return await fromUuid(uuid);
    }
}
/**
 * Find an effect on an actor or item by its identifier, read with {@link getIdentifier}. Returns undefined for any
 * other document type.
 * @param {foundry.abstract.Document} document    Actor or item to search.
 * @param {string} identifier                     Identifier to match.
 * @param {object} [options]                      Additional options.
 * @param {boolean} [options.multiple]            Return an array of every match rather than the first.
 * @param {boolean} [options.includeItemEffects]  On an actor, also search the effects on its items.
 * @param {Actor5e} [options.sourceActor]         Only match effects whose origin activity belongs to this actor.
 * @returns {ActiveEffect|ActiveEffect[]|undefined}
 * @example
 * const effect = documentUtils.getEffectByIdentifier(target.actor, 'hexed', {sourceActor: actor});
 */
function getEffectByIdentifier(document, identifier, {multiple, includeItemEffects, sourceActor} = {}) {
    const predicate = effect => getIdentifier(effect) === identifier && (!sourceActor || effectUtils.getOriginActivitySync(effect)?.actor?.uuid === sourceActor.uuid);
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
 * Make documents depend on a parent through midi-qol, so they are deleted when the parent is.
 * @param {foundry.abstract.Document} parentDocument      Document the others depend on.
 * @param {foundry.abstract.Document[]} [childDocuments]  Documents deleted alongside the parent.
 * @returns {Promise<void>}
 * @example
 * await documentUtils.makeDependent(concentrationEffect, [summonedToken]);
 */
async function makeDependent(parentDocument, childDocuments = []) {
    if (!childDocuments.length) return;
    await Promise.all(childDocuments.map(async document => MidiQOL.addDependent(parentDocument, document)));
}
/**
 * Run several write operations in one batch, applied all or nothing. Every user other than the active GM sends the
 * batch to that GM, and each operation's `parent` is replaced with its uuid in place.
 * @param {DatabaseWriteOperation[]} operations            Write operations to run together.
 * @returns {Promise<Array<foundry.abstract.Document[]>>}  The documents from each operation. An empty array when the GM
 *                                                         query fails.
 * @example
 * await documentUtils.modifyBatch([
 *     {action: 'update', documentName: 'ActiveEffect', parent: actor, updates: [{_id: effect.id, disabled: true}]}
 * ]);
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
 * Copy an effect from an item, or from an activity's item, as creation data without an `_id`. The origin is the source
 * effect, and an activity source applies its own duration and changes. Any other option is a {@link CatEffectData}
 * property applied with {@link dataUtils.buildEffectData}.
 * @param {foundry.documents.Item|dnd5e.dataModels.activity.BaseActivityData} document
 *                                                 Item or activity holding the effect.
 * @param {string} id                              Id of the effect on the item.
 * @param {object} [options]                       Additional options.
 * @param {EffectDurationData} [options.duration]  Replaces the effect's duration and skips the activity's applied
 *                                                 changes.
 * @param {foundry.documents.Item|boolean} [options.concentrationItem]
 *                                                 When set, the origin is the actor's concentration effect for this
 *                                                 item, or for `document`'s item when `true`.
 * @returns {object|undefined}                     Effect data. Undefined when the effect is missing.
 * @example
 * const effectData = documentUtils.getEffectData(workflow.activity, sourceEffect.id, {rules: '2024', specialDuration: ['turnEnd']});
 * await effectUtils.createEffects(target.actor, [effectData]);
 */
function getEffectData(document, id, {duration, concentrationItem, ...catData} = {}) {
    const sourceEffect = document.item ? document.item.effects.get(id) : document.effects.get(id);
    if (!sourceEffect) return;
    const effectData = sourceEffect.toObject();
    delete effectData._id;
    effectData.origin = !concentrationItem ? sourceEffect.uuid : effectUtils.getConcentrationEffect(document.actor, concentrationItem instanceof Item ? concentrationItem : document.item ?? document)?.uuid;
    if (duration) effectData.duration = duration;
    else if (document.documentName === 'Activity') genericUtils.mergeObject(effectData, document.getAppliedEffectChanges(sourceEffect));
    dataUtils.buildEffectData(effectData, catData);
    if (document.documentName === 'Activity' && effectData.system?.origin?.effect) effectData.system.origin.activity ??= document.uuid;
    return effectData;
}
/**
 * Build effect creation data from scratch. A spell or magical item marks the effect magical, and an activity supplies
 * the duration when none is passed. Any other option is a {@link CatEffectData} property applied with
 * {@link dataUtils.buildEffectData}.
 * @param {foundry.abstract.Document} document     Item or activity the effect comes from.
 * @param {object} [options]                       Additional options.
 * @param {string} [options.name]                  Effect name.
 * @param {string} [options.img]                   Effect icon.
 * @param {string} [options.origin]                Uuid the effect originates from.
 * @param {string} [options.identifier]            CAT identifier other macros look this effect up by.
 * @param {object[]} [options.changes]             Stored as `system.changes`.
 * @param {EffectDurationData} [options.duration]  Effect duration.
 * @returns {object}                               Effect data ready for creation.
 * @example
 * const effectData = documentUtils.getBaseEffectData(workflow.activity, {
 *     name: workflow.item.name, img: workflow.item.img, origin: workflow.activity.uuid, identifier: 'blessed',
 *     changes: [{key: 'system.bonuses.All-Attacks', type: 'add', value: '1d4'}]
 * });
 */
function getBaseEffectData(document, {name, img, origin, identifier, changes = [], duration, ...buildOptions} = {}) {
    const item = document?.documentName === 'Item' ? document : document?.item;
    const effectData = {
        name,
        img,
        origin,
        system: {changes, magical: itemUtils.isMagical(item)}
    };
    if (duration) {
        effectData.duration = duration;
    } else if (document?.documentName === 'Activity') {
        effectData.duration = activityUtils.getEffectDuration(document);
    }
    if (identifier) dataUtils.setIdentifier(effectData, identifier);
    return dataUtils.buildEffectData(effectData, buildOptions);
}
/**
 * Blank every string under a `description`, `biography`, `hint` or `chatFlavor` key, at any depth. Effect changes whose
 * key targets one of those fields have their `value` blanked too.
 * @param {*} data            Document source data, changed in place.
 * @param {boolean} [inside]  Whether `data` already sits under a description key.
 * @returns {*}               The same data.
 * @example
 * const itemData = documentUtils.stripDescriptions(item.toObject());
 */
function stripDescriptions(data, inside = false) {
    const DESCRIPTION_KEYS = ['description', 'biography', 'hint', 'chatFlavor'];
    if (typeof data === 'string') return inside ? '' : data;
    if (!data || typeof data !== 'object') return data;
    const targetsDescription = typeof data.key === 'string' && data.key.split('.').some(part => DESCRIPTION_KEYS.includes(part));
    for (const key of Object.keys(data)) data[key] = stripDescriptions(data[key], inside || DESCRIPTION_KEYS.includes(key) || (targetsDescription && key === 'value'));
    return data;
}
/**
 * Get a document's CAT automation status, plus the registered automation an item matches.
 * @param {foundry.abstract.Document} document  Document to act on.
 * @returns {{status: string, source: string|undefined, identifier: string|undefined, version: string|undefined}}
 */
function automationInfo(document) {
    const status = automationUtils.getAutomationStatus(document);
    const automation = document.documentName === 'Item' ? automationUtils.getCurrentAutomation(document) : undefined;
    return {
        status: foundry.utils.invertObject(constants.automationStatus)[status],
        source: automation?.source,
        identifier: automation?.identifier,
        version: automation?.version
    };
}
/**
 * Download a document's JSON with every description blanked by {@link stripDescriptions}. The data is stamped with the
 * world, uuid, core version and system version it came from.
 * @param {foundry.abstract.Document} document  Document to export.
 * @param {object} [options]                    Additional options.
 * @param {boolean} [options.automation]        Add a `catAutomation` entry with the automation status and match to the
 *                                              document and each of its items.
 * @example
 * documentUtils.exportDocument(actor, {automation: true});
 */
function exportDocument(document, {automation = false} = {}) {
    const data = stripDescriptions(document.toCompendium(null, {clearSource: false}));
    data._stats ??= {};
    data._stats.exportSource = {worldId: game.world.id, uuid: document.uuid, coreVersion: game.version, systemId: game.system.id, systemVersion: game.system.version};
    if (automation) {
        data.catAutomation = automationInfo(document);
        for (const item of data.items ?? []) item.catAutomation = automationInfo(document.items.get(item._id));
    }
    const filename = ['fvtt', document.documentName, document.name?.slugify(), document.id, genericUtils.dateStamp()].filterJoin('-');
    foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), 'application/json', `${filename}.json`);
}
export default {
    getRules,
    getSource,
    getIdentifier,
    getMatchFeatType,
    getMonsterIdentifier,
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
    getBaseEffectData,
    stripDescriptions,
    exportDocument
};
