import {genericUtils} from '../utilities/genericUtils.mjs';
import {queryUtils} from '../utilities/queryUtils.mjs';
async function moveToken(token, movement, options, user) {
    if (!queryUtils.isTheGM()) return;
    if (!token.actor) return;
    if (token.actor.type === 'group') return;
    if (token.parent.id != canvas.scene.id) return;
    let isFinalMovement = !movement.pending.waypoints.length;
    let previousCoords = genericUtils.duplicate(movement.origin);
    let coords = genericUtils.duplicate(movement.destination);
    if (!previousCoords) return;
    let xDiff = token.width * canvas.grid.size / 2;
    let yDiff = token.height * canvas.grid.size / 2;
    coords.x += xDiff;
    coords.y += yDiff;
    previousCoords.x += xDiff;
    previousCoords.y += yDiff;
    let ignore = genericUtils.getProperty(options, 'cat.movement.ignore');
    let skipMove = genericUtils.getCPRSetting('movementPerformance') < 2 && !isFinalMovement;
    let previousRegions = token.parent.regions.filter(region => token.testInsideRegion(region, movement.origin));
    await token.object.movementAnimationPromise;
    if (!ignore) {
        let teleport = CONFIG.Token.movement.actions[movement.passed.waypoints.at(-1).action]?.teleport;
        genericUtils.setProperty(options, 'cat.movement.teleport', teleport);
        if (!skipMove) {
            if (isFinalMovement) ;//await auras.updateAuras(token, options);
            //Stuff here
        }

    }
}