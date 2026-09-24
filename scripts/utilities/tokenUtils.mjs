import {grapple as grappleHandler} from '../handlers/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {crosshairUtils, genericUtils, queryUtils} from './_module.mjs';
/**
 * Movement action for drag ruler. 'catForce' does not consume movement.
 * @typedef {'blink'|'burrow'|'catForce'|'climb'|'crawl'|'displace'|'fly'|'jump'|'swim'|'walk'} MovementAction
 */
/** @import {Animations} from '../lib/_module.mjs' */
/** @import {Crosshairs} from '../lib/_module.mjs' */

/**
 * Get the cast data stashed on this token.
 * @param {foundry.documents.TokenDocument} token Token to read from.
 * @returns {object|undefined}
 */
function getSavedCastData(token) {
    return token.flags.cat?.castData;
}
/**
 * Measure between two tokens, accounting for their size.
 * @param {foundry.documents.TokenDocument} token Token to read from.
 * @param {foundry.documents.TokenDocument} target Token measured to.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.wallsBlock] Return -1 when a wall lies between them.
 * @param {boolean} [options.checkCover] Include cover in the measurement.
 * @param {boolean} [options.convertToFt] Convert from grid units to scene units.
 * @returns {number}
 */
function getDistance(token, target, {wallsBlock, checkCover, convertToFt = true} = {}) {
    const distance =  MidiQOL.computeDistance(token.object, target.object, {wallsBlock, includeCover: checkCover});
    return convertToFt ? genericUtils.convertDistance(token.parent, distance) : distance;
}
/**
 * Get the target's cover from the source, taking the greater of its cover condition and its calculated cover.
 * @param {foundry.documents.TokenDocument} sourceToken Token acting.
 * @param {foundry.documents.TokenDocument} targetToken Token being acted on.
 * @param {object} [options] Additional options.
 * @param {Activity} [options.activity] Used to ignore cover the activity is configured to bypass.
 * @param {boolean} [options.displayName] Return a localized label rather than the numeric bonus.
 * @returns {number|string}
 */
function checkCover(sourceToken, targetToken, {activity, displayName}) {
    // TODO replace the following with MidiQOL.getCoverBonus when that becomes available
    const statusCover = targetToken.actor.statuses.has('coverTotal') ? 999 : (targetToken.actor.system.attributes.ac.cover ?? 0);
    const moduleCover = MidiQOL.computeCoverBonus(sourceToken.object, targetToken.object, activity);
    const cover = Math.max(moduleCover, statusCover);
    if (!displayName) return cover;
    const names = {
        0: 'DND5E.COMMON.No',
        2: 'DND5E.CoverHalf',
        5: 'DND5E.CoverThreeQuarters',
        999: 'DND5E.CoverTotal'
    };
    return _loc('CAT.Common.Cover', {amount: _loc(names[cover]), cover: _loc('DND5E.Cover')});
}
/**
 * Whether two tokens are hostile to one another.
 * @param {foundry.documents.TokenDocument} source Token whose disposition is compared.
 * @param {foundry.documents.TokenDocument} target Token measured to.
 * @param {object} [options] Additional options.
 * @param {number} [options.dispositionA] Override the source's disposition.
 * @param {number} [options.dispositionB] Override the target's disposition.
 * @returns {boolean}
 */
function isEnemy(source, target, {dispositionA, dispositionB} = {}) {
    dispositionA ??= source.disposition;
    dispositionB ??= target.disposition;
    return (dispositionA >= 0 && dispositionB < 0) || (dispositionA < 0 && dispositionB >= 0);
}
/**
 * Snapshot this token's combat position, for stamping an effect to a particular turn.
 * @param {foundry.documents.TokenDocument} token Token to read from.
 * @returns {{inCombat: boolean, combatId: string|null, currentRound: number|null, currentTurn: number|null}}
 */
function getCombatData(token) {
    const combat = token.combatant?.combat;
    return {
        inCombat: !!combat,
        combatId: combat ? combat.id : null,
        currentRound: combat ? combat.round : null,
        currentTurn: combat ? combat.turn : null
    };
}
/**
 * Find tokens within range of this one, excluding hidden tokens.
 * @param {foundry.documents.TokenDocument} token Token to read from.
 * @param {number} range Scene units.
 * @param {object} [options] Additional options.
 * @param {'all'|'ally'|'neutral'|'enemy'} [options.disposition] Dispositions relative to the scene, not to {@link token}.
 * @param {boolean} [options.includeIncapacitated] Include tokens that are incapacitated.
 * @param {boolean} [options.includeToken] Include {@link token} itself.
 * @returns {foundry.documents.TokenDocument[]}
 */
function findNearby(token, range, {disposition = 'all', includeIncapacitated = true, includeToken = false} = {}) {
    const dispositions = {
        all: undefined,
        ally: 1,
        neutral: 0,
        enemy: -1
    };
    return MidiQOL.findNearby(dispositions[disposition], token.object, range, {includeIncapacitated, includeToken}).map(placeable => placeable.document).filter(token => !token.hidden);
}
/**
 * Move a token along a path, delegating to a GM when the user lacks permission.
 * @param {foundry.documents.TokenDocument} token Token to read from.
 * @param {object[]} waypoints Positions to move through, in order.
 * @param {object} [options] Passed to {@link foundry.documents.TokenDocument#move}.
 * @returns {Promise<void>}
 */
async function moveToken(token, waypoints, options = {}) {
    const constrainOptions = {...options.constrainOptions};
    constrainOptions.ignoreTokens ??= waypoints.every(({action = token.movementAction}) => action === 'catForce' || CONFIG.Token.movement.actions[action]?.teleport === true);
    options = {...options, constrainOptions};
    if (token.object && constrainOptions.ignoreWalls !== true) {
        const origin = {x: token.x, y: token.y, elevation: token.elevation};
        const [path] = token.object.constrainMovementPath([origin, ...waypoints], {...constrainOptions, preview: false});
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
 * @param {object} [options] Additional options.
 * @param {Crosshairs} [options.destination] Data for crosshair result (see {@link Crosshairs.prototype.toObject}). A new crosshair is prompted if {@link destination} is undefined.
 * @param {Animations['Animation']} [options.animation] Animation data (see {@link Animations.Animation}).
 * @param {number} [options.range] Maximum distance in scene units.
 * @returns {Promise<undefined>}
 */
async function teleportToken(token, {destination, animation, options = {}, range = 30} = {}) {
    if (!destination) {
        const result = await new Events.MovementEvent(token, constants.movementPasses.aimTeleport, {range, animation, teleport: true}).run();
        if (result) return;
        destination = await crosshairUtils.aimCrosshair({token, maxRange: range});
    }
    if (!destination || destination?.cancelled) return;
    const result = await new Events.MovementEvent(token, constants.movementPasses.preTeleport, {destination, animation, range, teleport: true}).run();
    if (result) return;
    const preAnimation = animation?.macros?.preAnimation;
    if (preAnimation) await preAnimation(token, {destination, ...options});
    await moveToken(token, [
        {
            x: destination.x,
            y: destination.y,
            action: 'displace'
        }
    ]);
    const postAnimation = animation?.macros?.postAnimation;
    if (postAnimation) await postAnimation(token, {destination, ...options});
    await new Events.MovementEvent(token, constants.movementPasses.postTeleport, {destination, animation, teleport: true, action: 'displace'}).run();
}
/**
 * Move a token to a chosen position.
 * @param {foundry.documents.TokenDocument} token The token document to move.
 * @param {object} [options] Additional options.
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
 * @param {object} options Additional options.
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
/**
 * Whether this token can see the target, by any means.
 * @param {foundry.documents.TokenDocument} sourceToken Token acting.
 * @param {foundry.documents.TokenDocument} targetToken Token being acted on.
 * @returns {boolean}
 */
function canSee(sourceToken, targetToken) {
    return MidiQOL.canSee(sourceToken, targetToken);
}
/**
 * Can this token perceive the target through the given detection modes?
 * @param {foundry.documents.TokenDocument} sourceToken Token acting.
 * @param {foundry.documents.TokenDocument} targetToken Token being acted on.
 * @param {string[]} [senseModes] Detection mode ids to test, or `['all']` for any.
 * @returns {boolean}
 */
function canSense(sourceToken, targetToken, senseModes = ['all']) {
    if (!senseModes.length) return false;
    return MidiQOL.canSense(sourceToken, targetToken, senseModes);
}
/**
 * Run a grapple attempt between two tokens, applying the condition on success.
 * @param {foundry.documents.TokenDocument} sourceToken Token acting.
 * @param {foundry.documents.TokenDocument} targetToken Token being acted on.
 * @param {object} [options] Additional options.
 * @param {dnd5e.dataModels.activity.BaseActivityData} [options.activity] The initiating activity. Provides effect icons, name, rules, and roll DC.
 * @param {number} [options.flatDC] Escape DC. If undefined, instead uses the DC from the save on {@link activity}, or prompts {@link sourceToken} for a skill check.
 * @param {'2024'|'2014'} [options.rules] 2014 for skill checks or 2024 for saving throws. If undefined, uses the rules from {@link activity} or defaults to 2014.
 * @param {boolean} [options.contest] Roll dice before applying effects.
 * @param {boolean} [options.checkSize] Enforce size limits.
 */
async function grapple(sourceToken, targetToken, {activity, flatDC, rules, contest = true, checkSize = true} = {}) {
    return await grappleHandler.grapple(sourceToken, targetToken, {activity, flatDC, rules, contest, checkSize});
}
/**
 * Whether the target is small enough to be grappled or shoved by this token.
 * @param {foundry.documents.TokenDocument} sourceToken Token acting.
 * @param {foundry.documents.TokenDocument[]} targetToken Token being acted on.
 * @param {'grapple'|'shove-push'|'shove-prone'} [identifier] Used to check condition immunities and change the warning message.
 * @param {boolean} [warning] False hides warnings from a failed size requirement.
 * @returns {Promise<boolean>}
 */
async function grappleShoveSizeCheck(sourceToken, targetToken, identifier = 'grapple', warning = true) {
    return await grappleHandler.sizeCheck(sourceToken, targetToken, identifier, warning);
}
/**
 * Get the ambient light level at this token's position.
 * @param {foundry.documents.TokenDocument} token Token to read from.
 * @returns {'bright'|'dim'|'dark'}
 */
function getLightLevel(token) {
    if (token.parent.environment.globalLight.enabled) return 'bright';
    const center = Object.values(token.object.center);
    const lights = canvas.effects.lightSources.filter(source => !(source instanceof foundry.canvas.sources.GlobalLightSource) && source.shape.contains(...center));
    if (!lights.length) return 'dark';
    const inBright = lights.some(light => {
        const {data: {x, y}, ratio} = light;
        return Math.hypot(center[0] - x, center[1] - y) <= ratio * light.shape.config.radius;
    });
    return inBright ? 'bright' : 'dim';
}
export default {
    getSavedCastData,
    getDistance,
    checkCover,
    isEnemy,
    getCombatData,
    findNearby,
    getLightLevel,
    teleportToken,
    displaceToken,
    slideToken,
    canSee,
    canSense,
    grapple,
    grappleShoveSizeCheck
};
