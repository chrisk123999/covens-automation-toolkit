import {summonUtils} from '../utilities/_module.mjs';
function preDeleteToken(token, options) {
    if (!token.actor || !token.actorLink || options.cat?.summonRemove) return;
    const summon = summonUtils.getSummonData(token.actor);
    if (!summon) return;
    summonUtils.removeSummon(summon, {token});
    return false;
}
export default {
    preDeleteToken
};