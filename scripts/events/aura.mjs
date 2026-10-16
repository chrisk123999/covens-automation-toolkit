import {Auras, constants} from '../lib/_module.mjs';
function whenReady(callback) {
    return (...args) => Auras.isReady() ? callback(...args) : undefined;
}
function catReady() {
    return Auras.rebuild();
}
function canvasReady(board) {
    return Auras.viewScene(board.scene);
}
function createScene(scene) {
    Auras.indexScene(scene);
}
function deleteScene(scene) {
    Auras.forgetScene(scene);
}
function updateScene(scene, changes) {
    if ('active' in changes) Auras.resyncScenes([scene]);
}
function combatChanged(combat) {
    Auras.resyncScenes([combat.scene]);
}
function updateCombat(combat, changes) {
    if ('scene' in changes || [0, 1].includes(changes.round)) Auras.resyncScenes([combat.scene]);
}
function createToken(token) {
    Auras.refreshTokens([token], {reindex: true});
}
function updateToken(token, changes) {
    if (!Auras.isWorldScene(token.parent)) return;
    const reindex = constants.auraActorKeys.some(key => key in changes);
    if (!reindex && !constants.auraMembershipKeys.some(key => key in changes)) return;
    Auras.refreshTokens([token], {reindex});
    if ('actorId' in changes || 'actorLink' in changes) Auras.reconcile();
}
function moveToken(token, movement) {
    if (Auras.isWorldScene(token.parent)) Auras.passThrough(token, movement);
}
function deleteToken(token) {
    Auras.removeToken(token);
}
function itemChanged(item) {
    Auras.refreshItemActor(item);
}
function updateItem(item, changes) {
    const touched = 'effects' in changes || constants.auraItemPaths.some(path => foundry.utils.hasProperty(changes, path));
    Auras.refreshItemActor(item, {touched});
}
function effectChanged(effect) {
    Auras.refreshEffect(effect);
}
function updateActor(actor, changes) {
    const keys = Object.keys(foundry.utils.flattenObject(changes)).filter(key => key !== '_id' && !key.startsWith('_stats'));
    if (keys.length && keys.every(key => key.startsWith('system.attributes.hp'))) return;
    Auras.refreshActor(actor);
}
function deleteActor(actor) {
    Auras.removeActor(actor);
}
export default {
    catReady,
    canvasReady: whenReady(canvasReady),
    createScene: whenReady(createScene),
    deleteScene: whenReady(deleteScene),
    updateScene: whenReady(updateScene),
    combatChanged: whenReady(combatChanged),
    updateCombat: whenReady(updateCombat),
    createToken: whenReady(createToken),
    updateToken: whenReady(updateToken),
    moveToken: whenReady(moveToken),
    deleteToken: whenReady(deleteToken),
    itemChanged: whenReady(itemChanged),
    updateItem: whenReady(updateItem),
    effectChanged: whenReady(effectChanged),
    updateActor: whenReady(updateActor),
    deleteActor: whenReady(deleteActor)
};
