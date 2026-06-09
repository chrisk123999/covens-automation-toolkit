import {summonUtils} from '../utilities/_module.mjs';
function preDeleteToken(token, options) {
    if (!token.actor || !token.actorLink || options.cat?.summonRemove) return;
    const summon = summonUtils.getSummonData(token.actor);
    if (!summon) return;
    summonUtils.removeSummon(summon, {token});
    return false;
}
function preCreateToken(token, options) {
    if (!token.actor || !token.actorLink || options.cat?.summonCreate) return;
    const summon = summonUtils.getSummonData(token.actor);
    if (!summon) return;
    summonUtils.spawnSummon(summon, token.scene, {x: token.x, y: token.y, elevation: token.elevation});
    return false;
}
export default {
    preDeleteToken,
    preCreateToken
};