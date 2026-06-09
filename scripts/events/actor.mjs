import specialDuration from '../mechanics/specialDuration.mjs';
import {queryUtils} from '../utilities/_module.mjs';
import {actors} from '../handlers/_module.mjs';
async function updateActor(actor, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    await specialDuration.specialDurationHitPoints(actor, updates);
    await specialDuration.specialDurationZeroSpeed(actor);
}
function preDeleteActor(actor, options, userId) {
    return actors.preDeleteActor(actor, options);
}
export default {
    updateActor,
    preDeleteActor
};