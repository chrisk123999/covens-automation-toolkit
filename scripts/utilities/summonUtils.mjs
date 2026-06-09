import {constants} from '../lib/_module.mjs';
async function createSummon(ownerActor, sourceActor, {created = game.time.worldTime, duration, placeAnimation, removeAnimation, placeAlpha, avatarImg, tokenImg, name, updates, disposition} = {}) {
    return await constants.summons.createSummon(ownerActor, sourceActor, created, {duration, placeAnimation, removeAnimation, placeAlpha, avatarImg, tokenImg, name, updates, disposition});
}
async function placeSummon(summon, range, {preAnimation, postAnimation, alpha, token} = {}) {
    return await constants.summons.placeSummon(summon, range, {preAnimation, postAnimation, alpha, token});
}
async function spawnSummon(summon, scene, location, {preAnimation, postAnimation, alpha} = {}) {
    return await constants.summons.spawnSummon(summon, scene, location, {preAnimation, postAnimation, alpha});
}
function removeSummon(summon, {preanimation, postAnimation} = {}) {
    return constants.summons.removeSummon(summon, {preanimation, postAnimation});
}
function getSummons(actor) {
    return constants.summons.getSummons(actor);
}
function getSummonData(actor) {
    return constants.summons.getSummonData(actor);
}
export default {
    createSummon,
    placeSummon,
    spawnSummon,
    removeSummon,
    getSummons,
    getSummonData
};