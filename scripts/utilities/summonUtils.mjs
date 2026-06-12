import {constants} from '../lib/_module.mjs';
async function createSummon(ownerActor, sourceActor, {created = game.time.worldTime, duration, animation, placeAlpha, avatarImg, tokenImg, name, updates, disposition, parent, sourceDocument} = {}) {
    return await constants.summons.createSummon(ownerActor, sourceActor, created, {duration, animation, placeAlpha, avatarImg, tokenImg, name, updates, disposition, parent, sourceDocument});
}
async function placeSummon(summon, range, {preAnimation, postAnimation, alpha, token} = {}) {
    return await constants.summons.placeSummon(summon, range, {preAnimation, postAnimation, alpha, token});
}
async function spawnSummon(summon, scene, location, {preAnimation, postAnimation, alpha} = {}) {
    return await constants.summons.spawnSummon(summon, scene, location, {preAnimation, postAnimation, alpha});
}
async function deleteSummon(summon, {preAnimation, postAnimation} = {}) {
    return await constants.summons.deleteSummon(summon, {preAnimation, postAnimation});
}
function removeSummon(summon, {preAnimation, postAnimation} = {}) {
    return constants.summons.removeSummon(summon, {preAnimation, postAnimation});
}
function getSummons(actor) {
    return constants.summons.getSummons(actor);
}
function getSummonData(actor) {
    return constants.summons.getSummonData(actor);
}
function getSummonBySource(document) {
    return constants.summons.getSummonsBySource(document);
}
function placeSummons(summons, range, {token} = {}) {
    return constants.summons.placeSummons(summons, range, {token});
}
async function placeAllSourceSummons(document, range, {token} = {}) {
    return await placeSummons(getSummonBySource(document), range, {token});
}
async function recallAllSourceSummons(document) {
    return await Promise.all(getSummonBySource(document).map(async summon => summon.recall()));
}
export default {
    createSummon,
    placeSummon,
    spawnSummon,
    removeSummon,
    getSummons,
    getSummonData,
    deleteSummon,
    getSummonBySource,
    placeSummons,
    placeAllSourceSummons,
    recallAllSourceSummons
};