import {constants, Events} from '../lib/_module.mjs';
import {crosshairUtils, genericUtils, queryUtils} from './_module.mjs';
/**
 * Movement action for drag ruler. 'catForce' does not consume movement.
 * @typedef {'blink'|'burrow'|'catForce'|'climb'|'crawl'|'displace'|'fly'|'jump'|'swim'|'walk'} MovementAction
 */
/** @import {Animations} from '../lib/_module.mjs' */
/** @import {Crosshairs} from '../lib/_module.mjs' */

function getSavedCastData(token) {
    return token.flags.cat?.castData;
}
function getDistance(token, target, {wallsBlock, checkCover, convertToFt = true} = {}) {
    const distance =  MidiQOL.computeDistance(token.object, target.object, {wallsBlock, includeCover: checkCover});
    return convertToFt ? genericUtils.convertDistance(token.parent, distance) : distance;
}
function checkCover(sourceToken, targetToken, {activity, displayName}) {
    // TODO replace the following with MidiQOL.getCoverBonus when that becomes available
    const statusCover = targetToken.actor.statuses.has('coverTotal') ? 999 : (targetToken.actor.system.attributes.ac.cover ?? 0);
    const moduleCover = MidiQOL.computeCoverBonus(sourceToken.object, targetToken.object, activity);
    const cover = Math.max(moduleCover, statusCover);
    if (!displayName) return cover;
    const names = {
        0: 'DND5E.COMMON.No',
        2: 'DND5E.Cover.Half',
        5: 'DND5E.CoverThreeQuarters',
        999: 'DND5E.CoverTotal'
    };
    return _loc('CAT.Common.Cover', {amount: _loc(names[cover]), cover: _loc('DND5E.Cover')});
}
function isEnemy(source, target, {dispositionA, dispositionB} = {}) {
    dispositionA ??= source.disposition;
    dispositionB ??= target.disposition;
    return (dispositionA >= 0 && dispositionB < 0) || (dispositionA < 0 && dispositionB >= 0);
}
function getCombatData(token) {
    const combat = token.combatant?.combat;
    return {
        inCombat: !!combat,
        combatId: combat ? combat.id : null,
        currentRound: combat ? combat.round : null,
        currentTurn: combat ? combat.turn : null
    };
}
function findNearby(token, range, {disposition = 'all', includeIncapacitated = true, includeToken = false} = {}) {
    const dispositions = {
        all: undefined,
        ally: 1,
        neutral: 0,
        enemy: -1
    };
    return MidiQOL.findNearby(dispositions[disposition], token.object, range, {includeIncapacitated, includeToken}).map(placeable => placeable.document).filter(token => !token.hidden);
}
async function moveToken(token, waypoints, options = {}) {
    if (token.object && options.constrainOptions?.ignoreWalls !== true) {
        const origin = {x: token.x, y: token.y, elevation: token.elevation};
        const [path] = token.object.constrainMovementPath([origin, ...waypoints], {...options.constrainOptions, preview: false});
        if (!path.some(waypoint => !waypoint.intermediate && (waypoint.x !== token.x || waypoint.y !== token.y))) return;
    }
    const hasPermission = queryUtils.hasPermission(token, game.user.id);
    if (hasPermission) {
        return await token.move(waypoints, options);
    } else {
        return await queryUtils.query('moveToken', queryUtils.gmUser(), {uuid: token.uuid, waypoints, options});
    }
}
/**
 * Teleport a token to a chosen position. Always uses {@link MovementAction} displace.
 * @param {foundry.documents.TokenDocument} token The token document to teleport.
 * @param {object} [options]
 * @param {Crosshairs} [options.destination] Data for crosshair result (see {@link Crosshairs.prototype.toObject}). A new crosshair is prompted if {@link destination} is undefined.
 * @param {Animations['Animation']} [options.animation] Animation data (see {@link Animations.Animation}).
 * @param {number} [options.range] Maximum distance in scene units.
 * @returns {Promise<undefined>}
 */
async function teleportToken(token, {destination, animation, range = 30} = {}) {
    if (!destination) {
        const result = await new Events.MovementEvent(token, constants.movementPasses.aimTeleport, {range, animation, teleport: true}).run();
        if (result) return;
        destination = await crosshairUtils.aimCrosshair({token, maxRange: range});
    }
    if (!destination || destination?.cancelled) return;
    const result = await new Events.MovementEvent(token, constants.movementPasses.preTeleport, {destination, animation, range, teleport: true}).run();
    if (result) return;
    const preAnimation = animation?.macros?.preAnimation;
    if (preAnimation) await preAnimation(token, {destination});
    await moveToken(token, [
        {
            x: destination.x,
            y: destination.y,
            action: 'displace'
        }
    ]);
    const postAnimation = animation?.macros?.postAnimation;
    if (postAnimation) await postAnimation(token, {destination});
    await new Events.MovementEvent(token, constants.movementPasses.postTeleport, {destination, animation, teleport: true, action: 'displace'}).run();
}
/**
 * Move a token to a chosen position.
 * @param {foundry.documents.TokenDocument} token The token document to move.
 * @param {object} [options]
 * @param {Crosshairs} [options.destination] Data for crosshair result (see {@link Crosshairs.prototype.toObject}). A new crosshair is prompted if {@link destination} is undefined.
 * @param {Animations['Animation']} [options.animation] Animation data (see {@link Animations.Animation}).
 * @param {foundry.documents.TokenDocument} [options.sourceToken] Origin of the movement.
 * @param {MovementAction} [options.action] See {@link MovementAction}.
 * @param {number} [options.range] Maximum distance in scene units.
 * @returns {Promise<undefined>}
 */
async function displaceToken(token, {sourceToken, destination, animation, range = 5, action = 'catForce'} = {}) {
    destination ??= await crosshairUtils.aimCrosshair({token, maxRange: range});
    if (!destination || destination?.cancelled) return;
    const result = await new Events.MovementEvent(token, constants.movementPasses.displace, {sourceToken, animation, action, destination, range}).run();
    if (result) return;
    const preAnimation = animation?.macros?.preAnimation;
    if (preAnimation) await preAnimation(token, {sourceToken, destination});
    await moveToken(token, [
        {
            x: destination.x,
            y: destination.y,
            action
        }
    ],{
        constrainOptions: {
            ignoreWalls: false
        }
    });
    const postAnimation = animation?.macros?.postAnimation;
    if (postAnimation) await postAnimation(token, {sourceToken, destination, action});
}
/**
 * Push a token in a given direction.
 * @param {foundry.documents.TokenDocument} token The token document to push.
 * @param {object} options
 * @param {foundry.canvas.geometry.Ray} [options.ray] Direction for the push. If not provided, {@link sourceToken} is used to create a ray directly away from {@link token}.
 * @param {foundry.documents.TokenDocument} [options.sourceToken] Origin of the push. Must be provided if {@link ray} is undefined.
 * @param {MovementAction} [options.action] See {@link MovementAction}.
 * @param {number} [options.distance=5] Push distance in scene units.
 * @returns {Promise<undefined>}
 */
async function slideToken(token, {sourceToken, distance = 5, ray, action = 'catForce'} = {}) {
    const results = await new Events.MovementEvent(token, constants.movementPasses.slide, {sourceToken, range: distance, ray, action}).run({multiResult: true});
    if (results && results.length) {
        if (results.includes(0)) return;
        distance = results.reduce((acc, curr) => {
            return typeof curr === 'number' ? acc + curr : acc;
        }, distance);
    }
    if (distance === 0) return;
    let angle;
    if (ray) {
        angle = ray.angle;
    } else if (sourceToken) {
        angle = Math.atan2(token.y - sourceToken.y, token.x - sourceToken.x);
    } else {
        return;
    }
    const scene = token.parent;
    const isGridless = scene.grid.isGridless || scene.grid.type === CONST.GRID_TYPES.GRIDLESS;
    const dUnits = distance / scene.dimensions.distance;
    let kGrid = dUnits;
    if (!isGridless) {
        const ux = Math.abs(Math.cos(angle));
        const uy = Math.abs(Math.sin(angle));
        const maxU = Math.max(ux, uy);
        const minU = Math.min(ux, uy);
        const diagonalRule = scene.grid.diagonals;
        if (diagonalRule === CONST.GRID_DIAGONALS.EQUIDISTANT) {
            kGrid = dUnits / maxU;
        } else if (diagonalRule === CONST.GRID_DIAGONALS.ALTERNATING_1 || diagonalRule === CONST.GRID_DIAGONALS.ALTERNATING_2) {
            kGrid = dUnits / (maxU + 0.5 * minU);
        } else if (diagonalRule === CONST.GRID_DIAGONALS.RECTILINEAR || diagonalRule === CONST.GRID_DIAGONALS.ILLEGAL) {
            kGrid = dUnits / (maxU + minU);
        } else if (diagonalRule === CONST.GRID_DIAGONALS.EXACT || diagonalRule === CONST.GRID_DIAGONALS.APPROXIMATE) {
            kGrid = dUnits;
        }
    }
    const pixelDistance = kGrid * scene.dimensions.size;
    let targetPoint = {
        x: token.x + Math.cos(angle) * pixelDistance,
        y: token.y + Math.sin(angle) * pixelDistance
    };
    if (!isGridless) targetPoint = scene.grid.getSnappedPoint(targetPoint, {mode: 0xFF0});
    await moveToken(token, [
        {
            x: targetPoint.x,
            y: targetPoint.y,
            action
        }
    ],
    {
        constrainOptions: {
            ignoreWalls: false
        }
    });
}
export default {
    getSavedCastData,
    getDistance,
    checkCover,
    isEnemy,
    getCombatData,
    findNearby,
    teleportToken,
    displaceToken,
    slideToken,
    moveToken
};