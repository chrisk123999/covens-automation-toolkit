/**
 * GM and owner lookups, and queries that run CAT code on another user's client.
 * @module
 */
import {Logging} from '../lib/_module.mjs';
/**
 * Get the id of the GM that queries go to: midi's preferred GM when that user is active, otherwise Foundry's active GM.
 * Logs a warning and notifies the user when no GM is connected.
 * @returns {string|undefined}  Undefined when no GM is connected.
 * @example
 * const gmId = queryUtils.gmID();
 */
function gmID() {
    let gmID = game.users.activeGM?.id;
    const preferredGMId = MidiQOL.configSettings()?.preferredGM ?? '';
    if (preferredGMId !== '') {
        const preferredGM = game.users.get(preferredGMId);
        if (preferredGM?.active) gmID = preferredGM.id;
    }
    if (!gmID) Logging.addMacroWarning('cat', 'queryUtils', 'CAT.Error.RequiresGM', {notify: true});
    return gmID;
}
/**
 * Whether this client is the GM that queries go to, as chosen by {@link gmID}. * @returns {boolean}
 * @example
 * if (!queryUtils.isTheGM()) return;
 */
function isTheGM() {
    return gmID() === game.user.id;
}
/**
 * Get the user document of the GM that queries go to, as chosen by {@link gmID}.
 * @returns {foundry.documents.User|undefined}  Undefined when no GM is connected.
 * @example
 * await queryUtils.query('createFolder', queryUtils.gmUser(), {folderData});
 */
function gmUser() {
    return game.users.get(gmID());
}
/**
 * Whether a user has Owner permission on a document. Embedded documents are tested through their actor, and an Activity
 * through its item's actor.
 * @param {foundry.abstract.Document} document  Document to test.
 * @param {string} userId                       User to test.
 * @returns {boolean}                           False when the user does not exist.
 * @example
 * if (!queryUtils.hasPermission(item, game.user.id)) return;
 */
function hasPermission(document, userId) {
    const user = game.users.get(userId);
    if (!user) return false;
    const doc = document.documentName === 'Activity' ? document.item : document;
    return (doc.actor ?? doc).testUserPermission(user, 'OWNER');
}
/**
 * Get the user who should act for a document. Picks an active player who owns it, including through the default
 * ownership level, preferring one whose assigned character it is, and otherwise the GM from {@link gmID}. Documents
 * with an actor are resolved to it.
 * @param {foundry.abstract.Document} document         Document to find an owner for.
 * @param {boolean} [useId]                            Return the user id instead of the user document.
 * @returns {foundry.documents.User|string|undefined}  Undefined when no document is given or no owner or GM is
 *                                                     connected.
 * @example
 * const userId = queryUtils.firstOwner(target.actor, true);
 * const confirmed = await dialogUtils.confirm(item.name, 'Use your reaction?', {userId});
 */
function firstOwner(document, useId) {
    if (!document) return;
    const corrected = document.actor ?? document;
    const playerOwners = game.users.filter(user => !user.isGM && user.active && corrected.testUserPermission(user, 'OWNER')).map(user => user.id);
    if (playerOwners.length > 0) {
        let playerId = playerOwners.find(id => game.users.get(id)?.character?.uuid === corrected.uuid) ?? playerOwners[0];
        return useId ? playerId : game.users.get(playerId);
    }
    return useId ? gmID() : game.users.get(gmID());
}
/**
 * Get the users who answer a dialog meant for a user, following CAT's Dialog Answerer setting. A GM, an unknown user,
 * or a world with no active GM always answers alone.
 * @param {string} userId  User the dialog is meant for.
 * @returns {string[]}     The player, the active GM, or both.
 * @example
 * const userIds = queryUtils.dialogUserIds(queryUtils.firstOwner(actor, true));
 */
function dialogUserIds(userId) {
    const user = game.users.get(userId);
    const gm = game.users.activeGM;
    if (!user || user.isGM || !gm) return [userId];
    switch (game.settings.get('cat', 'dialogAnswerer')) {
        case 'gm': return [gm.id];
        case 'both': return [userId, gm.id];
        default: return [userId];
    }
}
/**
 * Run one of CAT's registered queries on another user's client and wait for its result. Resolves undefined without a
 * user, such as {@link gmUser} with no GM connected. Throws when the user is inactive, the query fails, or no answer
 * arrives before the timeout.
 * @param {string} name                  Query name, without the `cat.` prefix.
 * @param {foundry.documents.User} user  User whose client runs the query.
 * @param {object} queryData             JSON-serializable data passed to the query handler.
 * @param {number} [timeout]             Milliseconds to wait for an answer. Defaults to `10000`.
 * @returns {Promise<*>}                 Whatever the query handler returns.
 * @example
 * const uuid = await queryUtils.query('createActor', queryUtils.gmUser(), {actorData});
 */
async function query(name, user, queryData, timeout = 10000) {
    if (!user) return;
    return await user.query('cat.' + name, queryData, {timeout});
}
export default {
    dialogUserIds,
    gmID,
    isTheGM,
    hasPermission,
    firstOwner,
    query,
    gmUser
};
