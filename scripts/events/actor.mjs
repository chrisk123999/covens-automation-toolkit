import {queryUtils, summonUtils} from '../utilities/_module.mjs';
import {actors, effects} from '../handlers/_module.mjs';
import constants from '../lib/constants.mjs';
async function updateActor(actor, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    const summon = summonUtils.getSummonData(actor);
    if (summon?.dismissAtZero && updates.system?.attributes?.hp?.value === 0) await constants.summons.zeroHP(summon);
    await effects.specialDurationHitPoints(actor, updates);
    await effects.specialDurationZeroSpeed(actor);
}
function preDeleteActor(actor, options, userId) {
    return actors.preDeleteActor(actor, options);
}
export default {
    updateActor,
    preDeleteActor
};