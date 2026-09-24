import {genericUtils} from './_module.mjs';
/**
 * The user id queries should be sent to: midi's preferred GM when active, otherwise the active GM.
 * @returns {string|undefined} Undefined when no GM is connected.
 */
function gmID() {
    let gmID = game.users.activeGM?.id;
    const preferredGMId = game.settings.get('midi-qol', 'PreferredGM');  
    if (preferredGMId !== '') {
        const preferredGM = game.users.get(preferredGMId);
        if (preferredGM?.active) gmID = preferredGM.id;
    }
    return gmID;
}
/**
 * Whether this client is the GM that queries are routed to.
 * @returns {boolean}
 */
function isTheGM() {
    return gmID() === game.user.id;
}
/**
 * The user document queries should be sent to.
 * @returns {foundry.documents.User|undefined} Undefined when no GM is connected.
 */
function gmUser() {
    return game.users.get(gmID());
}
/**
 * Whether this user owns the document, or the actor it belongs to.
 * @param {foundry.abstract.Document} document Document to test. An Activity is tested through its item.
 * @param {string} userId User to test ownership for.
 * @returns {boolean}
 */
function hasPermission(document, userId) {
    const user = game.users.get(userId);
    if (!user) return false;
    const doc = document.documentName === 'Activity' ? document.item : document;
    return (doc.actor ?? doc).testUserPermission(user, 'OWNER');
}
/**
 * The player who should act for this document, preferring one whose assigned character it is, and falling back to the GM.
 * @param {foundry.abstract.Document} document Document to find an owner for. Tokens resolve to their actor.
 * @param {boolean} [useId] Return the id rather than the user document.
 * @returns {foundry.documents.User|string|undefined} Undefined when no document is given.
 */
function firstOwner(document, useId) {
    if (!document) return;
    const corrected = document instanceof TokenDocument ? document.actor : document instanceof foundry.canvas.placeables.Token ? document.document.actor : document;
    const permissions = genericUtils.getProperty(corrected ?? {}, 'ownership') ?? {};
    const playerOwners = Object.entries(permissions).filter(([id, level]) => !game.users.get(id)?.isGM && game.users.get(id)?.active && level === 3).map(([id]) => id);
    if (playerOwners.length > 0) {
        let playerId = playerOwners.find(id => game.users.get(id)?.character?.uuid === corrected.uuid) ?? playerOwners[0];
        return useId ? playerId : game.users.get(playerId);
    }
    return useId ? gmID() : game.users.get(gmID());
}
/**
 * Run one of CAT's registered queries on another client.
 * @param {string} name Query name, without the `cat.` prefix.
 * @param {foundry.documents.User} user User whose client runs the query.
 * @param {object} queryData Passed to the query handler.
 * @param {number} [timeout] Milliseconds to wait before giving up.
 * @returns {Promise<*>} Whatever the query returns.
 */
async function query(name, user, queryData, timeout = 500) {
    return await user.query('cat.' + name, queryData, {timeout});
}
export default {
    gmID,
    isTheGM,
    hasPermission,
    firstOwner,
    query,
    gmUser
};