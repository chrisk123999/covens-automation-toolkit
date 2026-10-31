import {grapple as grappleHandler} from '../handlers/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {actorUtils, crosshairUtils, dialogUtils, queryUtils} from './_module.mjs';
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
 * @param {boolean} [options.convertToFt] Convert the scene's distance units to feet.
 * @returns {number}
 */
function getDistance(token, target, {wallsBlock, checkCover, convertToFt = true} = {}) {
    const distance = MidiQOL.getDistance(token.object, target.object, {wallsBlock, includeCover: checkCover});
    const units = token.parent.grid.units;
    if (!convertToFt || distance < 0 || units === 'ft') return distance;
    return dnd5e.utils.convertLength(distance, units, 'ft', {strict: false}).toNearest(0.01);
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
function checkCover(sourceToken, targetToken, {activity, displayName} = {}) {
    // TODO replace the following with MidiQOL.getCoverBonus when that becomes available
    const statusCover = targetToken.actor.statuses.has('coverTotal') ? 999 : (targetToken.actor.system.attributes.ac.cover ?? 0);
    const moduleCover = Math.min(MidiQOL.computeCoverBonus(sourceToken.object, targetToken.object, activity), 999);
    const cover = Math.max(moduleCover, statusCover);
    if (!displayName) return cover;
    const names = {
        0: 'COMMON.No',
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
 * @returns {{inCombat: boolean, combatId: string|null, currentRound: number|null, currentTurn: number|null, currentCombatantId: string|null}}
 */
function getCombatData(token) {
    const combat = token.combatant?.combat;
    return {
        inCombat: !!combat,
        combatId: combat ? combat.id : null,
        currentRound: combat ? combat.round : null,
        currentTurn: combat ? combat.turn : null,
        currentCombatantId: combat?.combatant?.id ?? null
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
        const moved = waypoint => waypoint.x !== token.x || waypoint.y !== token.y || (waypoint.elevation ?? token.elevation) !== token.elevation || (waypoint.level ?? token.level) !== token.level;
        if (!path.some(waypoint => !waypoint.intermediate && moved(waypoint))) return;
    }
    const startLevel = token.level;
    const hasPermission = queryUtils.hasPermission(token, game.user.id);
    const result = hasPermission ? await token.move(waypoints, options) : await queryUtils.query('moveToken', queryUtils.gmUser(), {uuid: token.uuid, waypoints, options});
    const level = waypoints.at(-1)?.level;
    if (level && level !== startLevel && token.object?.controlled) await token.parent.view({level});
    return result;
}
/**
 * Waypoint fields for a destination elevation and level.
 * @param {foundry.documents.TokenDocument} token Token being moved.
 * @param {object} [options] Additional options.
 * @param {number} [options.elevation] Destination elevation.
 * @param {string} [options.level] Destination Level id.
 * @returns {{elevation?: number, level?: string}}
 */
function heightAndLevel(token, {elevation, level} = {}) {
    const fields = {};
    if (level && level !== token.level) {
        fields.level = level;
        elevation ??= token.parent.levels.get(level)?.elevation.bottom;
    }
    if (elevation !== undefined) fields.elevation = elevation;
    return fields;
}
/**
 * A token's vision source, built temporarily if core has none.
 * @param {foundry.documents.TokenDocument} token Token looking.
 * @param {{x: number, y: number}} [origin] Point to build the source at.
 * @returns {{source?: PointVisionSource, release: Function}} Call `release` when done.
 */
function getVisionSource(token, origin) {
    const placeable = token.object;
    if (!origin && placeable?.vision?.active) return {source: placeable.vision, release: () => {}};
    if (!placeable?.hasSight) return {release: () => {}};
    const source = new CONFIG.Canvas.visionSourceClass({sourceId: placeable.sourceId + '.cat', object: placeable});
    Object.assign(source.blinded, placeable._getVisionBlindedStates());
    source.initialize({...placeable._getVisionSourceData(), ...origin});
    return {source, release: () => source.destroy()};
}
/**
 * Whether a token can see a point.
 * @param {foundry.documents.TokenDocument} token Token looking.
 * @param {{x: number, y: number, elevation?: number}} point Point being looked at.
 * @param {object} [options] Additional options.
 * @param {string} [options.level] Level id of the point.
 * @param {PointVisionSource} [options.source] Vision source to test with.
 * @returns {boolean}
 */
function canSeePoint(token, point, {level, source} = {}) {
    if (!token.parent?.tokenVision) return true;
    const vision = source ? undefined : getVisionSource(token);
    source ??= vision.source;
    if (!source) return true;
    try {
        const config = canvas.visibility._createVisibilityTestConfig([point], {tolerance: 0});
        const pointLevel = token.parent.levels.get(level);
        if (pointLevel) {
            config.level = pointLevel;
            config.tests.forEach(test => test.level = pointLevel);
        }
        const modes = CONFIG.Canvas.detectionModes;
        return ['basicSight', 'lightPerception'].some(id => {
            const mode = token.detectionModes[id];
            return !!mode && modes[id].testVisibility(source, mode, config);
        });
    } finally {
        vision?.release();
    }
}
/**
 * The level with the lowest bottom elevation in a scene.
 * @param {foundry.documents.Scene} scene Scene to search.
 * @returns {Level|undefined}
 */
function lowestLevel(scene) {
    return scene.levels.contents.reduce((low, level) => !low || (level.elevation.bottom ?? -Infinity) < (low.elevation.bottom ?? -Infinity) ? level : low, undefined);
}
/**
 * Elevation of the highest surface containing a point.
 * @param {object[]} surfaces Region surfaces to test.
 * @param {{x: number, y: number}} point Point to test.
 * @returns {number|undefined} Undefined if no surface contains the point.
 */
function highestSurfaceAt(surfaces, point) {
    const under = surfaces.filter(surface => surface.region.polygonTree.testPoint(point));
    return under.length ? Math.max(...under.map(surface => surface.elevation)) : undefined;
}
/**
 * Floors on other levels within a token's range.
 * @param {foundry.documents.TokenDocument} token Token moving.
 * @param {number} range Range in scene units.
 * @returns {Map<string, {level: Level, surfaces: object[], ground?: number}>} Keyed by level id.
 */
function reachableSurfaces(token, range) {
    const origin = token.getCenterPoint();
    const pixels = canvas.grid.size / canvas.grid.distance;
    const halfToken = token.width * canvas.grid.size / 2;
    const reachable = new Map();
    const lowest = lowestLevel(token.parent);
    for (const level of token.parent.levels) {
        if (level.id === token.level) continue;
        const ground = level === lowest ? level.elevation.bottom ?? 0 : undefined;
        if (ground !== undefined && crosshairUtils.horizontalReach(origin, range, ground) >= 0) reachable.set(level.id, {level, surfaces: [], ground});
        for (const surface of token.parent.getSurfaces({type: 'move', level})) {
            const reach = crosshairUtils.horizontalReach(origin, range, surface.elevation);
            if (reach < 0 || !surface.region.polygonTree.testPoint(origin, (reach * pixels) + halfToken)) continue;
            if (!reachable.has(level.id)) reachable.set(level.id, {level, surfaces: []});
            reachable.get(level.id).surfaces.push(surface);
        }
    }
    return reachable;
}
/**
 * The floor a token would land on if it fell straight down from its center.
 * @param {foundry.documents.TokenDocument} token Token falling.
 * @returns {{elevation: number, level: string}}
 */
function floorBelow(token) {
    const scene = token.parent;
    const center = token.getCenterPoint();
    const lowest = lowestLevel(scene);
    const ground = lowest?.elevation.bottom ?? 0;
    const origin = {x: center.x, y: center.y, elevation: token.elevation};
    const destination = {x: center.x, y: center.y, elevation: Math.min(ground, token.elevation) - 1};
    let floor;
    for (const level of scene.levels) {
        if (level.id !== token.level && (level.elevation.bottom ?? -Infinity) > token.elevation) continue;
        const hit = scene.testSurfaceCollision(origin, destination, {mode: 'closest', level});
        if (hit && (!floor || hit.elevation > floor.elevation)) floor = {elevation: hit.elevation, level: level.id};
    }
    return floor ?? {elevation: ground, level: lowest?.id ?? token.level};
}
/**
 * Aim a destination, offering other levels with a floor in range.
 * @param {foundry.documents.TokenDocument} token Token the range is measured from.
 * @param {object} [options] Additional options.
 * @param {number} [options.range] Maximum distance in scene units.
 * @param {object} [options.centerpoint] Measure from here instead of the token's centre.
 * @param {object} [options.crosshairsConfig] Crosshair config.
 * @param {boolean} [options.requireSight] Only allow spaces the token can see.
 * @param {boolean} [options.ignoreWalls] Allow spaces that walls block from the token.
 * @returns {Promise<object|undefined>} Crosshair result with `level` and `elevation`; undefined if cancelled.
 */
async function aimDestination(token, {range, centerpoint, crosshairsConfig, requireSight = true, ignoreWalls = false} = {}) {
    const startView = canvas.level?.id;
    const reachable = reachableSurfaces(token, range);
    let targetLevel = token.level;
    if (reachable.size) {
        const ownLevel = token.parent.levels.get(token.level);
        const choices = [ownLevel, ...Array.from(reachable.values(), entry => entry.level)].filter(Boolean).sort((a, b) => b.elevation.bottom - a.elevation.bottom);
        const buttons = choices.map(choice => [choice.id === token.level ? _loc('CAT.Teleport.Current', {name: choice.name}) : choice.name, choice.id]);
        targetLevel = await dialogUtils.buttonDialog('CAT.Teleport.Title', 'CAT.Teleport.WhichLevel', buttons);
        if (!targetLevel) return;
    }
    const onOwnLevel = targetLevel === token.level;
    const {surfaces = [], ground} = reachable.get(targetLevel) ?? {};
    const floorAt = crosshairs => {
        if (onOwnLevel) return token.elevation;
        return highestSurfaceAt(surfaces, crosshairs.position) ?? ground;
    };
    const vision = requireSight ? getVisionSource(token) : undefined;
    const standable = (_crosshairs, {x, y, elevation}) => elevation !== undefined
        && (!vision?.source || canSeePoint(token, {x, y, elevation: elevation + 0.01}, {level: targetLevel, source: vision.source}));
    try {
        if (canvas.level?.id !== targetLevel) await token.parent.view({level: targetLevel});
        const result = await crosshairUtils.aimCrosshair({
            centerpoint,
            token,
            crosshairsConfig,
            maxRange: range,
            validityFunctions: [standable],
            ignoreWalls,
            getElevation: floorAt,
            ringElevation: onOwnLevel ? undefined : Math.min(...surfaces.map(surface => surface.elevation), ground ?? Infinity)
        });
        if (!result || result.cancelled) return;
        return {...result, level: targetLevel};
    } finally {
        vision?.release();
        if (startView && canvas.level?.id !== startView) await token.parent.view({level: startView});
    }
}
/**
 * Teleport a token to a chosen position. Always uses {@link MovementAction} displace.
 * @param {foundry.documents.TokenDocument} token The token document to teleport.
 * @param {object} [options] Additional options.
 * @param {Crosshairs} [options.destination] Data for crosshair result (see {@link Crosshairs.prototype.toObject}). A new crosshair is prompted if {@link destination} is undefined.
 * @param {object} [options.centerpoint] If {@link destination} is not provided, the crosshair range will be measured from this point rather than from {@link token}.
 * @param {Animations['Animation']} [options.animation] Animation data (see {@link Animations.Animation}).
 * @param {number} [options.range] Maximum distance in scene units.
 * @param {number} [options.elevation] Destination elevation.
 * @param {string} [options.level] Destination Level id.
 * @param {boolean} [options.requireSight] Only allow spaces the token can see.
 * @param {foundry.documents.TokenDocument[]} [options.followers] Tokens teleported along with this one.
 * @param {number} [options.followerRange] Crosshair range for a follower that can't keep its position.
 * @param {string} [options.userId] User who aims the destination crosshair. Defaults to the current user.
 * @param {boolean} [options.ignoreWalls] Allow destinations that walls block from the token.
 * @returns {Promise<undefined>}
 */
async function teleportToken(token, {destination, centerpoint, animation, options = {}, range = 30, elevation, level, requireSight = true, followers = [], followerRange = 10, userId, ignoreWalls = false} = {}) {
    if (!destination) {
        const result = await new Events.MovementEvent(token, constants.movementPasses.aimTeleport, {range, animation, teleport: true}).run();
        if (result) return;
        if (userId && userId !== game.user.id) destination = await queryUtils.query('aimDestination', game.users.get(userId), {uuid: token.uuid, range, centerpoint, requireSight, ignoreWalls}, 300000);
        else destination = await aimDestination(token, {range, centerpoint, requireSight, ignoreWalls});
    }
    if (!destination || destination.cancelled) return;
    const result = await new Events.MovementEvent(token, constants.movementPasses.preTeleport, {destination, animation, range, teleport: true}).run();
    if (result) return;
    const dx = destination.x - token.x;
    const dy = destination.y - token.y;
    const leaderCenter = token.getCenterPoint({x: destination.x, y: destination.y});
    const destinationLevel = level ?? destination.level ?? token.level;
    const placed = [];
    const blocked = [];
    if (dx || dy) {
        const vision = requireSight && token.parent.tokenVision ? getVisionSource(token, leaderCenter) : undefined;
        for (const follower of followers) {
            const followerDestination = {x: follower.x + dx, y: follower.y + dy, elevation: follower.elevation};
            const center = {...follower.getCenterPoint(followerDestination), elevation: follower.elevation};
            const wallBlocked = !ignoreWalls && CONFIG.Canvas.polygonBackends.move.testCollision(leaderCenter, center, {type: 'move', mode: 'any', level: token.parent.levels.get(destinationLevel)});
            const unseen = vision?.source && !canSeePoint(token, {...center, elevation: center.elevation + 0.01}, {level: destinationLevel, source: vision.source});
            if (wallBlocked || unseen) blocked.push(follower);
            else placed.push([follower, followerDestination]);
        }
        vision?.release();
    }
    const teleportLeader = async () => {
        const preAnimation = animation?.macros?.preAnimation;
        if (preAnimation) await preAnimation(token, {destination, ...options});
        await moveToken(token, [
            {
                x: destination.x,
                y: destination.y,
                ...heightAndLevel(token, {elevation: elevation ?? destination.elevation, level: destinationLevel}),
                action: 'displace'
            }
        ]);
        const postAnimation = animation?.macros?.postAnimation;
        if (postAnimation) await postAnimation(token, {destination, ...options});
        await new Events.MovementEvent(token, constants.movementPasses.postTeleport, {destination, animation, teleport: true, action: 'displace'}).run();
    };
    await Promise.all([teleportLeader(), ...placed.map(([follower, destination]) => teleportToken(follower, {animation, options, destination}))]);
    for (const follower of blocked) await teleportToken(follower, {animation, options, centerpoint: leaderCenter, range: followerRange, requireSight, ignoreWalls, userId});
}
/**
 * Move a token to a chosen position.
 * @param {foundry.documents.TokenDocument} token The token document to move.
 * @param {object} [options] Additional options.
 * @param {Crosshairs} [options.destination] Data for crosshair result (see {@link Crosshairs.prototype.toObject}). A new crosshair is prompted if {@link destination} is undefined.
 * @param {object} [options.centerpoint] If {@link destination} is not provided, the crosshair range will be measured from this point rather than from {@link token}.
 * @param {Animations['Animation']} [options.animation] Animation data (see {@link Animations.Animation}).
 * @param {foundry.documents.TokenDocument} [options.sourceToken] Origin of the movement.
 * @param {MovementAction} [options.action] See {@link MovementAction}.
 * @param {number} [options.range] Maximum distance in scene units.
 * @param {number} [options.elevation] Destination elevation.
 * @param {string} [options.level] Destination Level id.
 * @param {boolean} [options.requireSight] Only allow spaces the token can see.
 * @returns {Promise<undefined>}
 */
async function displaceToken(token, {sourceToken, destination, centerpoint, animation, range = 5, action = 'catForce', elevation, level, requireSight = false} = {}) {
    destination ??= await aimDestination(token, {range, centerpoint, requireSight});
    if (!destination || destination.cancelled) return;
    const result = await new Events.MovementEvent(token, constants.movementPasses.displace, {sourceToken, animation, action, destination, range}).run();
    if (result) return;
    const preAnimation = animation?.macros?.preAnimation;
    if (preAnimation) await preAnimation(token, {sourceToken, destination});
    await moveToken(token, [
        {
            x: destination.x,
            y: destination.y,
            ...heightAndLevel(token, {elevation: elevation ?? destination.elevation, level: level ?? destination.level}),
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
 * Swap the positions of two tokens, centring each where the other stood. Always uses {@link MovementAction} displace.
 * With an animation, both tokens run the teleport events and the animation's pre and post macros.
 * @param {foundry.documents.TokenDocument} tokenA Token moved to {@link tokenB}'s position.
 * @param {foundry.documents.TokenDocument} tokenB Token moved to {@link tokenA}'s position.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.animate] False moves both tokens without animating.
 * @param {Animations['Animation']} [options.animation] Teleport animation data (see {@link Animations.Animation}).
 * @param {object} [options.options] Options passed to the animation macros.
 * @returns {Promise<void>}
 */
async function swapTokens(tokenA, tokenB, {animate = true, animation, options = {}} = {}) {
    const spaceAt = (token, other) => {
        const center = other.getCenterPoint();
        const size = token.parent.grid.size;
        return {x: center.x - token.width * size / 2, y: center.y - token.height * size / 2, elevation: other.elevation, level: other.level};
    };
    const moves = [[tokenA, spaceAt(tokenA, tokenB)], [tokenB, spaceAt(tokenB, tokenA)]];
    if (!animation) {
        await Promise.all(moves.map(([token, destination]) => moveToken(token, [{...destination, action: 'displace'}], {animate})));
        return;
    }
    for (const [token, destination] of moves) {
        if (await new Events.MovementEvent(token, constants.movementPasses.preTeleport, {destination, animation, teleport: true}).run()) return;
    }
    await Promise.all(moves.map(([token, destination]) => animation.macros?.preAnimation?.(token, {destination, ...options})));
    await Promise.all(moves.map(([token, destination]) => moveToken(token, [{...destination, action: 'displace'}], {animate})));
    await Promise.all(moves.map(([token, destination]) => animation.macros?.postAnimation?.(token, {destination, ...options})));
    await Promise.all(moves.map(([token, destination]) => new Events.MovementEvent(token, constants.movementPasses.postTeleport, {destination, animation, teleport: true, action: 'displace'}).run()));
}
/**
 * Whether another visible token overlaps the space a token would take at a position.
 * @param {foundry.documents.TokenDocument} token The token that would move.
 * @param {{x: number, y: number}} position Top-left position to test.
 * @returns {boolean}
 */
function isOccupied(token, {x, y}) {
    const size = token.parent.grid.size;
    const rect = new PIXI.Rectangle(x, y, token.width * size, token.height * size).pad(-1);
    return token.parent.tokens.some(other => other !== token && !other.hidden && rect.intersects(new PIXI.Rectangle(other.x, other.y, other.width * size, other.height * size)));
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
        const center = token.getCenterPoint();
        const sourceCenter = sourceToken.getCenterPoint();
        angle = Math.atan2(center.y - sourceCenter.y, center.x - sourceCenter.x);
    } else {
        return;
    }
    const step = token.parent.grid.distance * Math.sign(distance);
    let targetPoint;
    for (let travel = distance; Math.abs(travel) > 0; travel -= step) {
        const point = token.getSnappedPosition(token.parent.grid.getTranslatedPoint({x: token.x, y: token.y}, Math.toDegrees(angle), travel));
        if (!isOccupied(token, point)) {
            targetPoint = point;
            break;
        }
    }
    if (!targetPoint) return;
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
 * Ids of every detection mode that does not rely on sight.
 * @returns {string[]}
 */
function getNonSightModes() {
    const detectionModes = CONFIG.Canvas.detectionModes;
    const sightType = foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT;
    return Object.keys(detectionModes).filter(id => detectionModes[id].type !== sightType);
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
 * @param {string[]} [options.conditions] Extra conditions applied with the grapple.
 */
async function grapple(sourceToken, targetToken, {activity, flatDC, rules, contest = true, checkSize = true, conditions = []} = {}) {
    return await grappleHandler.grapple(sourceToken, targetToken, {activity, flatDC, rules, contest, checkSize, conditions});
}
/**
 * Get the tokens this token is currently grappling.
 * @param {foundry.documents.TokenDocument} token Grappling token.
 * @returns {foundry.documents.TokenDocument[]}
 */
function getGrappled(token) {
    if (!token.actor) return [];
    return actorUtils.getEffectByIdentifier(token.actor, 'grappleSource', {multiple: true}).map(effect => token.parent.tokens.get(effect.flags.cat?.grapple?.tokenId)).filter(Boolean);
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
    const point = token.getMovementOrigin();
    if (canvas.effects.testInsideDarkness(point)) return 'dark';
    const globalLight = canvas.environment.globalLightSource;
    if (globalLight.active) {
        const {min, max} = globalLight.data.darkness;
        const darknessLevel = canvas.effects.getDarknessLevel(point);
        if (darknessLevel >= min && darknessLevel <= max) return 'bright';
    }
    const lights = canvas.effects.lightSources.filter(source => source.active && !(source instanceof foundry.canvas.sources.GlobalLightSource) && source.testPoint(point));
    if (!lights.length) return 'dark';
    const inBright = lights.some(light => Math.hypot(point.x - light.data.x, point.y - light.data.y) <= light.ratio * light.shape.config.radius);
    return inBright ? 'bright' : 'dim';
}
/**
 * Get the movement spent by this token since the start of the current turn in combat. Core clears every combatant's movement history at each turn start, and does not store it outside of combat.
 * @param {foundry.documents.TokenDocument} token
 * @param {boolean} [getRemaining] Return spent movement subtracted from max speed.
 * @returns {number}
 */
function movementSpent(token, getRemaining = false) {
    const max = token.actor.system.attributes.movement.max;
    const spent = token.measureMovementPath(token.movementHistory).cost;
    return getRemaining ? Math.max(max - spent, 0) : spent;
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
    swapTokens,
    slideToken,
    canSee,
    canSeePoint,
    reachableSurfaces,
    floorBelow,
    aimDestination,
    canSense,
    getNonSightModes,
    grapple,
    getGrappled,
    grappleShoveSizeCheck,
    movementSpent
};
