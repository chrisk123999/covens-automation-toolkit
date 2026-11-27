import {automationUtils, queryUtils, regionUtils, summonUtils} from '../utilities/_module.mjs';
import {actors, effects} from '../handlers/_module.mjs';
import constants from '../lib/constants.mjs';
async function updateActor(actor, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    const summon = summonUtils.getSummonData(actor);
    if (summon?.dismissAtZero && updates.system?.attributes?.hp?.value === 0) await constants.summons.zeroHP(summon);
    if (actor.flags.cat?.wallPanel && updates.system?.attributes?.hp?.value === 0) return regionUtils.breakWallPanel(actor);
    await effects.specialDurationHitPoints(actor, updates);
    if (updates.system?.attributes?.hp) await effects.refreshDisableConditions(actor);
    await effects.specialDurationZeroSpeed(actor);
    if (updates.system?.attributes?.inspiration === false) await automationUtils.calledEvent('heroicInspirationSpent', actor, {multiResult: true, canOverlap: true});
    if (updates.system?.tools) await automationUtils.calledEvent('toolsUpdated', actor, {canOverlap: true});
}
function preDeleteActor(actor, options, userId) {
    return actors.preDeleteActor(actor, options);
}
function createActor(actor) {
    constants.summons.register(actor);
}
function deleteActor(actor) {
    constants.summons.unregister(actor);
}
export default {
    updateActor,
    preDeleteActor,
    createActor,
    deleteActor
};