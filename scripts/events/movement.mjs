import {genericUtils, regionUtils} from '../utilities/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {regionEvents} from '../events/_module.mjs';
import {effects, regions} from '../handlers/_module.mjs';
async function moveToken(token, movement, options, user) {
    if (user.id != game.user.id) return;
    const movementPromise = movement.animation.ended;
    const attachedRegions = token.attachments.regions;
    if (attachedRegions.size) {
        const dx = movement.destination.x - movement.origin.x;
        const dy = movement.destination.y - movement.origin.y;
        const tokenOldZ = movement.origin.elevation;
        const tokenNewZ = movement.destination.elevation;
        const dz = tokenNewZ - tokenOldZ;
        attachedRegions.forEach(region => {
            const currentAnchor = regionUtils.getShapeAnchor(region.shapes[0]);
            const currentBottom = region.elevation.bottom;
            const currentTop = region.elevation.top;
            const locationData = {
                oldX: currentAnchor.x - dx,
                oldY: currentAnchor.y - dy,
                oldBottom: isFinite(currentBottom) ? currentBottom - dz : currentBottom,
                oldTop: isFinite(currentTop) ? currentTop - dz : currentTop
            };
            regionEvents.doRegionMove(region, locationData, {movementPromise});
        });
    }
    if (!token.actor) return;
    //if (token.parent.id != canvas.scene.id) return;
    const validTypes = ['npc', 'character', 'vehicle'];
    if (!validTypes.includes(token.actor.type)) return;
    const isFinalMovement = !movement.pending.waypoints.length;
    if (!movement.origin) return;
    const ignore = genericUtils.getProperty(options, 'cat.movement.ignore');
    //let skipMove = genericUtils.getCPRSetting('movementPerformance') < 2 && !isFinalMovement;
    let skipMove = false;
    let previousRegions = token.parent.regions.filter(region => token.testInsideRegion(region, movement.origin));
    await movementPromise;
    if (!ignore) {
        const action = movement.passed.waypoints.at(-1).action;
        const teleport = CONFIG.Token.movement.actions[action]?.teleport;
        if (!skipMove) {
            await new Events.MovementEvent(token, constants.movementPasses.moved, {action, options, teleport}).run();
        }
        const currentRegions = Array.from(token.regions);
        const leavingRegions = previousRegions.filter(i => !currentRegions.includes(i));
        const enteringRegions = currentRegions.filter(i => !previousRegions.includes(i));
        const stayingRegions = previousRegions.filter(i => currentRegions.includes(i));
        const waypoints = [movement.origin, ...movement.passed.waypoints];
        const enteredAndLeftRegions = teleport ? [] : token.parent.regions.filter(region => !previousRegions.includes(region) && !currentRegions.includes(region) && token.segmentizeRegionMovementPath(region, waypoints).some(segment => segment.type === CONST.REGION_MOVEMENT_SEGMENTS.ENTER));
        await regions.updateRegionEffects(token, currentRegions);
        if (leavingRegions.length) {
            await regions.processRegionActivities(token, leavingRegions, constants.regionPasses.left);
            await new Events.RegionEvent(leavingRegions, constants.regionPasses.left, {tokens: [token]}).run();
        }
        if (enteringRegions.length) {
            await regions.processRegionActivities(token, enteringRegions, constants.regionPasses.enter);
            await new Events.RegionEvent(enteringRegions, constants.regionPasses.enter, {tokens: [token]}).run();
        }
        if (stayingRegions.length) {
            await regions.processRegionActivities(token, stayingRegions, constants.regionPasses.stay);
            await new Events.RegionEvent(stayingRegions, constants.regionPasses.stay, {tokens: [token]}).run();
        }
        if (enteredAndLeftRegions.length) {
            await regions.processRegionActivities(token, enteredAndLeftRegions, constants.regionPasses.passedThrough);
            await new Events.RegionEvent(enteredAndLeftRegions, constants.regionPasses.passedThrough, {tokens: [token]}).run();
        }
    }
    if (movement.passed.waypoints.at(-1)?.action !== 'fall') await effects.specialDurationMove(token.actor);
}
export default {
    moveToken
};