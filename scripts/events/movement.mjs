import {genericUtils, queryUtils, regionUtils} from '../utils.mjs';
import {constants, Events} from '../lib.mjs';
async function moveToken(token, movement, options, user) {
    if (!queryUtils.isTheGM()) return;
    if (!token.actor) return;
    if (token.actor.type === 'group') return;
    if (token.parent.id != canvas.scene.id) return;
    const isFinalMovement = !movement.pending.waypoints.length;
    const previousCoords = genericUtils.duplicate(movement.origin);
    const coords = genericUtils.duplicate(movement.destination);
    if (!previousCoords) return;
    const xDiff = token.width * canvas.grid.size / 2;
    const yDiff = token.height * canvas.grid.size / 2;
    coords.x += xDiff;
    coords.y += yDiff;
    previousCoords.x += xDiff;
    previousCoords.y += yDiff;
    const ignore = genericUtils.getProperty(options, 'cat.movement.ignore');
    //let skipMove = genericUtils.getCPRSetting('movementPerformance') < 2 && !isFinalMovement;
    let skipMove = false;
    let previousRegions = token.parent.regions.filter(region => token.testInsideRegion(region, movement.origin));
    await token.object.movementAnimationPromise;
    if (!ignore) {
        const teleport = CONFIG.Token.movement.actions[movement.passed.waypoints.at(-1).action]?.teleport;
        genericUtils.setProperty(options, 'cat.movement.teleport', teleport);
        if (!skipMove) {
            //if (isFinalMovement);//await auras.updateAuras(token, options);
            await new Events.MovementEvent(token, constants.movementPasses.moved, {options}).run();
            await new Events.MovementNearEvent(token, 'movedNear', {options}).run();
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
        if (leavingRegions.length) await new Events.RegionEvent(leavingRegions, 'left', {tokens: [token]}).run();
        if (enteringRegions.length) await new Events.RegionEvent(enteringRegions, 'enter', {tokens: [token]}).run();
        if (stayingRegions.length) await new Events.RegionEvent(stayingRegions, 'stay', {tokens: [token]}).run();
        if (enteredAndLeftRegions.length) await new Events.RegionEvent(enteredAndLeftRegions, 'passedThrough', {tokens: [token]}).run();
    }
}
export const movementEvents = {
    moveToken
};