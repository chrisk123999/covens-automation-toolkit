import {genericUtils, queryUtils, regionUtils} from '../utilities/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {auraEvents, regionEvents} from '../events/_module.mjs';
import specialDuration from '../mechanics/specialDuration.mjs';
import {regions} from '../handlers/_module.mjs';
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
    const coords = genericUtils.duplicate(movement.destination);
    const previousCoords = genericUtils.duplicate(movement.origin);
    if (!previousCoords) return;
    const xDiff = token.width * token.parent.grid.size / 2;
    const yDiff = token.height * token.parent.grid.size / 2;
    coords.x += xDiff;
    coords.y += yDiff;
    previousCoords.x += xDiff;
    previousCoords.y += yDiff;
    const ignore = genericUtils.getProperty(options, 'cat.movement.ignore');
    //let skipMove = genericUtils.getCPRSetting('movementPerformance') < 2 && !isFinalMovement;
    let skipMove = false;
    let previousRegions = token.parent.regions.filter(region => token.testInsideRegion(region, movement.origin));
    await movementPromise;
    if (!ignore) {
        const teleport = CONFIG.Token.movement.actions[movement.passed.waypoints.at(-1).action]?.teleport;
        genericUtils.setProperty(options, 'cat.movement.teleport', teleport);
        if (!skipMove) {
            if (isFinalMovement) await auraEvents.updateAuras(token.parent.tokens, {options, targetToken: token});
            await new Events.MovementEvent(token, constants.movementPasses.moved, {options}).run();
            await new Events.MovementEvent(token, constants.movementPasses.movedNear, {options}).run();
        }
        const moveRay = new foundry.canvas.geometry.Ray(previousCoords, coords);
        const currentRegions = Array.from(token.regions);
        const leavingRegions = previousRegions.filter(i => !currentRegions.includes(i));
        const enteringRegions = currentRegions.filter(i => !previousRegions.includes(i));
        const stayingRegions = previousRegions.filter(i => currentRegions.includes(i));
        const throughRegions = token.parent.regions.reduce((acc, region) => {
            const intersected = regionUtils.rayIntersectsRegion(region, moveRay);
            if (!intersected) return acc;
            acc.push(region);
            return acc;
        }, []);
        let enteredAndLeftRegions = [];
        if (!teleport) enteredAndLeftRegions = throughRegions.filter(i => !leavingRegions.includes(i) && !enteringRegions.includes(i) && !stayingRegions.includes(i));
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
    await specialDuration.specialDurationMove(token.actor);
}
export default {
    moveToken
};