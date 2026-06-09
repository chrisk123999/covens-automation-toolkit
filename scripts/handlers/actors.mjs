import {summonUtils} from '../utilities/_module.mjs';
function preDeleteActor(actor, options) {
    if (options.cat?.summonDelete) return;
    const summon = summonUtils.getSummonData(actor);
    if (!summon) return;
    summonUtils.deleteSummon(summon);
    return false;
}


export default {
    preDeleteActor
};