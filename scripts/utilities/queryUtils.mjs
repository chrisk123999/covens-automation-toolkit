import {genericUtils} from './genericUtils.mjs';
function gmID() {
    let gmID = game.settings.get('cat', 'gmID');
    const preferredGMId = game.settings.get('midi-qol', 'PreferredGM');  
    if (preferredGMId !== '') {
        const preferredGM = game.users.get(preferredGMId);
        if (preferredGM?.active) gmID = preferredGM.id;
    }
    return gmID;
}
function isTheGM() {
    return gmID() === game.user.id;
}
function hasPermission(document, userId) {
    const user = game.users.get(userId);
    if (!user) return false;
    return document.testUserPermission(user, 'OWNER');
}
function firstOwner(document, useId) {
    if (!document) return;
    const corrected = document instanceof TokenDocument ? document.actor : document instanceof foundry.canvas.placeables.Token ? document.document.actor : document;
    const permissions = genericUtils.getProperty(corrected ?? {}, 'ownership') ?? {};
    const playerOwners = Object.entries(permissions).filter(([id, level]) => !game.users.get(id)?.isGM && game.users.get(id)?.active && level === 3).map(([id]) => id);
    if (playerOwners.length > 0) return useId ? playerOwners[0] : game.users.get(playerOwners[0]);
    return useId ? gmID() : game.users.get(gmID());
}
export const queryUtils = {
    gmID,
    isTheGM,
    hasPermission,
    firstOwner
};