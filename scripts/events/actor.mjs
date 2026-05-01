import specialDuration from '../mechanics/specialDuration.mjs';
import {queryUtils} from '../utilities/_module.mjs';
async function updateActor(actor, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    await specialDuration.specialDurationHitPoints(actor, updates);
    await specialDuration.specialDurationZeroSpeed(actor);
}
export default {
    updateActor
};