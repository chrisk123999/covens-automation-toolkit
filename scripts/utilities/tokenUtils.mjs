/**
 * Token measurement, vision, light, forced movement and grapples. Distances in and out of these functions are in feet.
 * @module
 */
import {grapple as grappleHandler} from '../handlers/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {actorUtils, crosshairUtils, dialogUtils, distanceUtils, queryUtils} from './_module.mjs';
/**
 * Movement action for drag ruler. 'catForce' does not consume movement.
 * @typedef {'blink'|'burrow'|'catForce'|'climb'|'crawl'|'displace'|'fly'|'jump'|'swim'|'walk'} MovementAction
 */
/** @import {Animations} from '../lib/_module.mjs' */
/** @import {Crosshairs} from '../lib/_module.mjs' */

/**
 * Read the cast data CAT stored in the token's `flags.cat.castData`.
 * @param {foundry.documents.TokenDocument} token  Token to read from.
 * @returns {object|undefined}                     Undefined when nothing is stored.
 * @example
 * const castData = tokenUtils.getSavedCastData(token);
 * const castLevel = castData?.castLevel ?? 1;
 */
function getSavedCastData(token) {
    return token.flags.cat?.castData;
}
/**
 * Measure the distance between two tokens in feet through midi-qol, accounting for their size. The result is rounded to
 * two decimals.
 * @param {foundry.documents.TokenDocument} token   Token measured from.
 * @param {foundry.documents.TokenDocument} target  Token measured to.
 * @param {object} [options]                        Additional options.
 * @param {boolean} [options.wallsBlock]            Return `-1` when a wall lies between them.
 * @param {boolean} [options.checkCover]            Pass cover to midi-qol's measurement.
 * @returns {number}                                Distance in feet, `-1` when walls block, or `Infinity` when the
 *                                                  tokens can't be measured, such as on different scenes or levels.
 * @example
 * const distance = tokenUtils.getDistance(token, target, {wallsBlock: true});
 * if (distance < 0 || distance > 30) return;
 */
function getDistance(token, target, {wallsBlock, checkCover} = {}) {
    const measure = MidiQOL.measureTokens(token, target, {wallsBlock, includeCover: checkCover});
    if (!measure.ok) return measure.reason === 'blocked' ? -1 : Infinity;
    return distanceUtils.toFeet(token.parent, measure.distance).toNearest(0.01);
}
/**
 * Whether a target is within a range of a token. Measures with {@link getDistance} and compares with
 * {@link distanceUtils.isWithinRange}, so the range is rounded to whole grid spaces on gridded scenes. Tokens that
 * can't be measured are out of range.
 * @param {foundry.documents.TokenDocument} token   Token measured from.
 * @param {foundry.documents.TokenDocument} target  Token measured to.
 * @param {number} range                            Range in feet.
 * @param {object} [options]                        Passed to {@link getDistance}.
 * @param {boolean} [options.wallsBlock]            Out of range when a wall lies between them.
 * @param {boolean} [options.checkCover]            Pass cover to midi-qol's measurement.
 * @returns {boolean}
 * @example
 * if (!tokenUtils.isWithinDistance(token, target, 5)) return;
 */
function isWithinDistance(token, target, range, {wallsBlock, checkCover} = {}) {
    const distance = getDistance(token, target, {wallsBlock, checkCover});
    return distance >= 0 && distanceUtils.isWithinRange(token.parent, distance, range);
}
/**
 * Get the target's cover against the source as an AC bonus. Takes the greater of the target's cover status and
 * midi-qol's calculated cover. Total cover is `999`.
 * @param {foundry.documents.TokenDocument} sourceToken  Token acting.
 * @param {foundry.documents.TokenDocument} targetToken  Token being acted on.
 * @param {object} [options]                             Additional options.
 * @param {Activity} [options.activity]                  Passed to midi-qol so cover the activity ignores is skipped.
 * @param {boolean} [options.displayName]                Return a localized label rather than the bonus.
 * @returns {number|string}                              The bonus, such as `2`, `5` or `999`, or the localized label.
 * @example
 * const cover = tokenUtils.checkCover(token, target, {activity});
 * if (cover >= 999) return;
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
    return _loc('CAT.Common.Cover', {amount: names[cover] ? _loc(names[cover]) : '+' + cover, cover: _loc('DND5E.Cover')});
}
/**
 * Whether two tokens are on opposite sides. Neutral tokens count as friendly, and secret tokens count as hostile.
 * @param {foundry.documents.TokenDocument} source  First token.
 * @param {foundry.documents.TokenDocument} target  Second token.
 * @param {object} [options]                        Additional options.
 * @param {number} [options.dispositionA]           Use this disposition for `source`.
 * @param {number} [options.dispositionB]           Use this disposition for `target`.
 * @returns {boolean}
 * @example
 * const enemies = tokenUtils.findNearby(token, 10).filter(nearby => tokenUtils.isEnemy(token, nearby));
 */
function isEnemy(source, target, {dispositionA, dispositionB} = {}) {
    dispositionA ??= source.disposition;
    dispositionB ??= target.disposition;
    return (dispositionA >= 0 && dispositionB < 0) || (dispositionA < 0 && dispositionB >= 0);
}
/**
 * Snapshot the round and turn of the combat the token is in. Every field but `inCombat` is null when the token has no
 * combatant.
 * @param {foundry.documents.TokenDocument} token  Token to read from.
 * @returns {{inCombat: boolean, combatId: string|null, currentRound: number|null, currentTurn: number|null, currentCombatantId: string|null}}
 *                                                 `currentCombatantId` is the combatant whose turn it is, not
 *                                                 necessarily the token's.
 * @example
 * genericUtils.setProperty(effectData, 'flags.cat.combatData', tokenUtils.getCombatData(token));
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
 * Find tokens with actors within range of a token through midi-qol. Searches the tokens on the viewed canvas, skips
 * tokens behind walls and drops hidden tokens. The range is rounded to whole grid spaces on gridded scenes.
 * @param {foundry.documents.TokenDocument} token   Token measured from.
 * @param {number} range                            Range in feet.
 * @param {object} [options]                        Additional options.
 * @param {'all'|'ally'|'neutral'|'enemy'} [options.disposition]
 *                                                  Disposition relative to `token`, so `enemy` finds hostile tokens for
 *                                                  a friendly `token`. Defaults to `all`.
 * @param {boolean} [options.includeIncapacitated]  Include incapacitated tokens. Defaults to true.
 * @param {boolean} [options.includeToken]          Include `token` itself. Defaults to false.
 * @returns {foundry.documents.TokenDocument[]}
 * @example
 * const enemies = tokenUtils.findNearby(token, 30, {disposition: 'enemy', includeIncapacitated: false});
 */
function findNearby(token, range, {disposition = 'all', includeIncapacitated = true, includeToken = false} = {}) {
    const dispositions = {
        all: undefined,
        ally: 1,
        neutral: 0,
        enemy: -1
    };
    return MidiQOL.findNearby(dispositions[disposition], token.object, distanceUtils.toRangeUnits(token.parent, range) + token.parent.grid.distance / 100, {includeIncapacitated, includeToken}).map(placeable => placeable.document).filter(token => !token.hidden);
}
/**
 * Move a token along a path, delegating to a GM when the user lacks permission.
 * @param {foundry.documents.TokenDocument} token  Token to read from.
 * @param {object[]} waypoints                     Positions to move through, in order.
 * @param {object} [options]                       Passed to {@link foundry.documents.TokenDocument#move}.
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
 * @param {foundry.documents.TokenDocument} token  Token being moved.
 * @param {object} [options]                       Additional options.
 * @param {number} [options.elevation]             Destination elevation.
 * @param {string} [options.level]                 Destination Level id.
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
 * @param {foundry.documents.TokenDocument} token              Token looking.
 * @param {Point} [origin]                                     Point to build the source at.
 * @returns {{source?: PointVisionSource, release: Function}}  Call `release` when done.
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
 * Whether a token can see a point through basic sight or light perception. Returns true when the scene has token vision
 * off or the token has no sight.
 * @param {foundry.documents.TokenDocument} token  Token looking.
 * @param {Point|ElevatedPoint} point              Point being looked at, in canvas pixels. Elevation is optional.
 * @param {object} [options]                       Additional options.
 * @param {string} [options.level]                 Level id of the point.
 * @param {PointVisionSource} [options.source]     Vision source to test with. Defaults to the token's own, built
 *                                                 temporarily when core has none.
 * @returns {boolean}
 * @example
 * const center = target.getCenterPoint();
 * if (!tokenUtils.canSeePoint(token, center, {level: target.level})) return;
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
 * @param {foundry.documents.Scene} scene  Scene to search.
 * @returns {Level|undefined}
 */
function lowestLevel(scene) {
    return scene.levels.contents.reduce((low, level) => !low || (level.elevation.bottom ?? -Infinity) < (low.elevation.bottom ?? -Infinity) ? level : low, undefined);
}
/**
 * Elevation of the highest surface containing a point.
 * @param {object[]} surfaces   Region surfaces to test.
 * @param {Point} point         Point to test.
 * @returns {number|undefined}  Undefined if no surface contains the point.
 */
function highestSurfaceAt(surfaces, point) {
    const under = surfaces.filter(surface => surface.region.polygonTree.testPoint(point));
    return under.length ? Math.max(...under.map(surface => surface.elevation)) : undefined;
}
/**
 * Find the floors on other levels that a token could reach within a range of its center. The token's own level is
 * skipped. The lowest level also reports its ground elevation when that is in range. Without a range, every level and
 * floor counts as reachable.
 * @param {foundry.documents.TokenDocument} token  Token moving.
 * @param {number} [range]                         Range in feet.
 * @param {object} [options]                       Additional options.
 * @param {ElevatedPoint} [options.origin]         Measure from here instead of the token's center.
 * @returns {Map<string, {level: Level, surfaces: object[], ground?: number}>}
 *                                                 Keyed by level id. Empty when no other level is in reach.
 * @example
 * const reachable = tokenUtils.reachableSurfaces(token, 30);
 * if (!reachable.size) return;
 */
function reachableSurfaces(token, range, {origin} = {}) {
    const scene = token.parent;
    origin ??= token.getCenterPoint();
    const pixels = scene.grid.size / scene.grid.distance;
    const halfToken = token.width * scene.grid.size / 2;
    const reachAt = elevation => range ? crosshairUtils.horizontalReach(origin, range, elevation, scene) : Infinity;
    const reachable = new Map();
    const lowest = lowestLevel(scene);
    for (const level of scene.levels) {
        if (level.id === token.level) continue;
        const ground = level === lowest ? level.elevation.bottom ?? 0 : undefined;
        if (ground !== undefined && reachAt(ground) >= 0) reachable.set(level.id, {level, surfaces: [], ground});
        for (const surface of scene.getSurfaces({type: 'move', level})) {
            const reach = reachAt(surface.elevation);
            if (reach < 0) continue;
            if (reach !== Infinity && !surface.region.polygonTree.testPoint(origin, (distanceUtils.convertDistance(scene, reach) * pixels) + halfToken)) continue;
            if (!reachable.has(level.id)) reachable.set(level.id, {level, surfaces: []});
            reachable.get(level.id).surfaces.push(surface);
        }
    }
    return reachable;
}
/**
 * Find the floor a token would land on if it fell straight down from its center. Falls back to the bottom of the
 * scene's lowest level, or `0` on a scene with no levels.
 * @param {foundry.documents.TokenDocument} token  Token falling.
 * @returns {{elevation: number, level: string}}   Elevation in scene units and the id of the level the floor belongs
 *                                                 to.
 * @example
 * const {elevation, level} = tokenUtils.floorBelow(token);
 * await token.move([{x: token.x, y: token.y, elevation, level, action: 'displace'}]);
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
 * Get a token's height above the floor below it, found with {@link floorBelow}.
 * @param {foundry.documents.TokenDocument} token  Token to measure.
 * @returns {number}                               Height in feet.
 * @example
 * const fallDistance = tokenUtils.heightAboveFloor(token);
 */
function heightAboveFloor(token) {
    return distanceUtils.toFeet(token.parent, token.elevation - floorBelow(token).elevation);
}
/**
 * Highlight grid spaces on the canvas.
 * @param {Point[]} points   Centers of the spaces.
 * @returns {PIXI.Graphics}  The highlight, for the caller to destroy.
 */
function drawAllowedPoints(points) {
    const graphics = new PIXI.Graphics();
    const shape = canvas.grid.getShape();
    const unique = new Map(points.map(({x, y}) => [x + '.' + y, {x, y}]));
    graphics.beginFill(0x32cd32, 0.3);
    for (const {x, y} of unique.values()) {
        if (shape.length) graphics.drawPolygon(shape.flatMap(vertex => [vertex.x + x, vertex.y + y]));
        else graphics.drawCircle(x, y, canvas.grid.size / 2);
    }
    graphics.endFill();
    canvas.controls.addChild(graphics);
    return graphics;
}
/**
 * Prompt the current user with a crosshair to pick a destination for a token. When floors on other levels are in range,
 * a dialog first asks which level to aim on and the canvas switches to it. The view returns to the starting level
 * afterward.
 * @param {foundry.documents.TokenDocument} token                 Token being moved.
 * @param {object} [options]                                      Additional options.
 * @param {number} [options.range]                                Maximum distance in feet.
 * @param {Point} [options.centerpoint]                           Measure the crosshair range from here instead of the
 *                                                                token's center.
 * @param {object} [options.crosshairsConfig]                     Passed to {@link crosshairUtils.aimCrosshair}.
 * @param {boolean} [options.requireSight]                        Only allow spaces the token can see. Defaults to true.
 * @param {boolean} [options.ignoreWalls]                         Allow spaces that walls block from the token. Defaults
 *                                                                to false. Sight replaces the wall check whenever a
 *                                                                vision source is used.
 * @param {Point[]} [options.allowedPoints]                       Only allow these token centers, highlighted while
 *                                                                aiming.
 * @param {foundry.documents.TokenDocument} [options.sightToken]  Token whose sight decides which spaces are visible.
 *                                                                Defaults to `token`.
 * @returns {Promise<object|undefined>}                           Crosshair result with rounded `x` and `y`, `elevation`
 *                                                                and `level`. Undefined if cancelled.
 * @example
 * const destination = await tokenUtils.aimDestination(token, {range: 30});
 * if (!destination) return;
 */
async function aimDestination(token, {range, centerpoint, crosshairsConfig, requireSight = true, ignoreWalls = false, allowedPoints, sightToken} = {}) {
    const startView = canvas.level?.id;
    const reachable = reachableSurfaces(token, range, {origin: centerpoint ? {elevation: token.elevation, ...centerpoint} : undefined});
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
    const vision = requireSight ? getVisionSource(sightToken ?? token) : undefined;
    const standable = (_crosshairs, {x, y, elevation}) => elevation !== undefined
        && (!vision?.source || canSeePoint(token, {x, y, elevation: elevation + 0.01}, {level: targetLevel, source: vision.source}));
    let highlight;
    try {
        if (canvas.level?.id !== targetLevel) await token.parent.view({level: targetLevel});
        if (allowedPoints) highlight = drawAllowedPoints(allowedPoints);
        const result = await crosshairUtils.aimCrosshair({
            centerpoint,
            token,
            crosshairsConfig,
            maxRange: range,
            validityFunctions: allowedPoints ? [standable, (_crosshairs, {x, y}) => allowedPoints.some(point => Math.hypot(point.x - x, point.y - y) < token.parent.grid.size / 2)] : [standable],
            ignoreWalls: ignoreWalls || !!vision?.source,
            getElevation: floorAt,
            ringElevation: onOwnLevel ? undefined : Math.min(...surfaces.map(surface => surface.elevation), ground ?? Infinity)
        });
        if (!result || result.cancelled) return;
        return {...result, x: Math.round(result.x), y: Math.round(result.y), level: targetLevel};
    } finally {
        highlight?.destroy();
        vision?.release();
        if (startView && canvas.level?.id !== startView) await token.parent.view({level: startView});
    }
}
/**
 * Run {@link aimDestination} on another user's client through a query, or locally when `userId` is empty or the current
 * user. The query waits up to five minutes.
 * @param {string} [userId]                        Id of the user who aims the crosshair.
 * @param {foundry.documents.TokenDocument} token  Token being moved.
 * @param {object} [options]                       Passed to {@link aimDestination}.
 * @returns {Promise<object|undefined>}            Crosshair result, or undefined if cancelled.
 * @example
 * const userId = queryUtils.firstOwner(target, true);
 * const destination = await tokenUtils.aimDestinationAs(userId, target, {range: 10});
 */
async function aimDestinationAs(userId, token, options) {
    if (!userId || userId === game.user.id) return await aimDestination(token, options);
    const {sightToken, ...rest} = options ?? {};
    return await queryUtils.query('aimDestination', game.users.get(userId), {uuid: token.uuid, sightTokenUuid: sightToken?.uuid, ...rest}, 300000);
}
/**
 * Teleport a token with the `displace` movement action, prompting a destination crosshair through
 * {@link aimDestinationAs} when none is given. Runs the `aimTeleport`, `preTeleport` and `postTeleport` movement
 * passes, and a truthy result from the first two cancels the teleport. Each follower keeps its offset from the token
 * unless a wall or the token's sight blocks that space, in which case it gets its own crosshair.
 * @param {foundry.documents.TokenDocument} token                  Token to teleport.
 * @param {object} [options]                                       Additional options.
 * @param {Crosshairs} [options.destination]                       Crosshair result to teleport to (see
 *                                                                 `Crosshairs.prototype.toObject`). Skips the crosshair
 *                                                                 prompt.
 * @param {Point} [options.centerpoint]                            Measure the crosshair range from here instead of from
 *                                                                 `token`.
 * @param {Animations['Animation']} [options.animation]            Animation data (see `Animations.Animation`).
 * @param {object} [options.options]                               Passed to the animation's pre and post macros.
 * @param {number} [options.range]                                 Maximum distance in feet. Defaults to 30.
 * @param {number} [options.elevation]                             Destination elevation. Defaults to the crosshair's.
 * @param {string} [options.level]                                 Destination Level id. Defaults to the crosshair's.
 * @param {boolean} [options.requireSight]                         Only allow spaces the token can see. Defaults to
 *                                                                 true.
 * @param {foundry.documents.TokenDocument[]} [options.followers]  Tokens teleported along with this one.
 * @param {number} [options.followerRange]                         Crosshair range in feet for a follower that can't
 *                                                                 keep its offset. Defaults to 10.
 * @param {string} [options.userId]                                Id of the user who aims the crosshair. Defaults to
 *                                                                 the current user.
 * @param {boolean} [options.ignoreWalls]                          Allow destinations that walls block from the token.
 *                                                                 Defaults to false.
 * @param {Point[]} [options.allowedPoints]                        Only allow these token centers when aiming.
 * @param {foundry.documents.TokenDocument} [options.sightToken]   Token whose sight decides which spaces are visible.
 *                                                                 Defaults to `token`.
 * @returns {Promise<undefined>}
 * @example
 * await tokenUtils.teleportToken(workflow.token.document, {range: 30, requireSight: false, ignoreWalls: true});
 */
async function teleportToken(token, {destination, centerpoint, animation, options = {}, range = 30, elevation, level, requireSight = true, followers = [], followerRange = 10, userId, ignoreWalls = false, allowedPoints, sightToken} = {}) {
    if (!destination) {
        const result = await new Events.MovementEvent(token, constants.movementPasses.aimTeleport, {range, animation, teleport: true}).run();
        if (result) return;
        destination = await aimDestinationAs(userId, token, {range, centerpoint, requireSight, ignoreWalls, allowedPoints, sightToken});
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
    for (const follower of blocked) await teleportToken(follower, {animation, options, centerpoint: leaderCenter, range: followerRange, requireSight, ignoreWalls, userId, sightToken});
}
/**
 * Force a token to a new position, prompting a destination crosshair through {@link aimDestinationAs} when none is
 * given. Runs the `displace` movement pass, and a truthy result cancels the move. Walls still block the movement.
 * @param {foundry.documents.TokenDocument} token                  Token to move.
 * @param {object} [options]                                       Additional options.
 * @param {Crosshairs} [options.destination]                       Crosshair result or top-left point to move to (see
 *                                                                 `Crosshairs.prototype.toObject`). Skips the crosshair
 *                                                                 prompt.
 * @param {Point} [options.centerpoint]                            Measure the crosshair range from here instead of from
 *                                                                 `token`.
 * @param {Animations['Animation']} [options.animation]            Animation data (see `Animations.Animation`).
 * @param {foundry.documents.TokenDocument} [options.sourceToken]  Token causing the movement.
 * @param {MovementAction} [options.action]                        Movement action. Defaults to `catForce`, which does
 *                                                                 not spend movement.
 * @param {number} [options.range]                                 Maximum crosshair distance in feet. Defaults to 5.
 * @param {number} [options.elevation]                             Destination elevation. Defaults to the crosshair's.
 * @param {string} [options.level]                                 Destination Level id. Defaults to the crosshair's.
 * @param {boolean} [options.requireSight]                         Only allow spaces the token can see. Defaults to
 *                                                                 false.
 * @param {string} [options.userId]                                Id of the user who aims the crosshair. Defaults to
 *                                                                 the current user.
 * @returns {Promise<undefined>}
 * @example
 * await tokenUtils.displaceToken(target, {sourceToken: token, range: 5});
 */
async function displaceToken(token, {sourceToken, destination, centerpoint, animation, range = 5, action = 'catForce', elevation, level, requireSight = false, userId} = {}) {
    destination ??= await aimDestinationAs(userId, token, {range, centerpoint, requireSight});
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
 * Swap the positions of two tokens with the `displace` movement action, centering each where the other stood. Each
 * token also takes the other's elevation and level. With an `animation`, both tokens run the `preTeleport` and
 * `postTeleport` movement passes and the animation's pre and post macros, and a truthy `preTeleport` result cancels the
 * swap.
 * @param {foundry.documents.TokenDocument} tokenA       Token moved to `tokenB`'s position.
 * @param {foundry.documents.TokenDocument} tokenB       Token moved to `tokenA`'s position.
 * @param {object} [options]                             Additional options.
 * @param {boolean} [options.animate]                    False moves both tokens without the core movement animation.
 *                                                       Defaults to true.
 * @param {Animations['Animation']} [options.animation]  Teleport animation data (see `Animations.Animation`).
 * @param {object} [options.options]                     Passed to the animation's pre and post macros.
 * @returns {Promise<void>}
 * @example
 * await tokenUtils.swapTokens(token, target);
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
 * @param {foundry.documents.TokenDocument} token  The token that would move.
 * @param {Point} position                         Top-left position to test.
 * @returns {boolean}
 */
function isOccupied(token, {x, y}) {
    const size = token.parent.grid.size;
    const rect = new PIXI.Rectangle(x, y, token.width * size, token.height * size).pad(-1);
    return token.parent.tokens.some(other => other !== token && !other.hidden && rect.intersects(new PIXI.Rectangle(other.x, other.y, other.width * size, other.height * size)));
}
/**
 * Push a token in a straight line, or pull it with a negative distance. Runs the `slide` movement pass first: a `0`
 * result cancels the push and other numeric results are added to the distance in feet. The token stops at the farthest
 * space along the line that no other visible token occupies, and walls still block the movement.
 * @param {foundry.documents.TokenDocument} token      Token to push.
 * @param {object} [options]                           Additional options.
 * @param {foundry.canvas.geometry.Ray} [options.ray]  Direction of the push. Takes priority over `sourceToken`.
 * @param {foundry.documents.TokenDocument} [options.sourceToken]
 *                                                     Token pushing, used to push directly away from its center.
 *                                                     Nothing happens when neither `ray` nor `sourceToken` is given.
 * @param {MovementAction} [options.action]            Movement action. Defaults to `catForce`, which does not spend
 *                                                     movement.
 * @param {number} [options.distance]                  Push distance in feet, rounded to whole grid spaces with at least
 *                                                     one. Defaults to 5.
 * @returns {Promise<undefined>}
 * @example
 * await tokenUtils.slideToken(target, {sourceToken: token, distance: 10});
 * await tokenUtils.slideToken(target, {sourceToken: token, distance: -10}); // pull 10 ft toward token
 */
async function slideToken(token, {sourceToken, distance = 5, ray, action = 'catForce'} = {}) {
    const results = await new Events.MovementEvent(token, constants.movementPasses.slide, {sourceToken, range: distance, ray, action}).run({multiResult: true});
    if (results && results.length) {
        if (results.includes(0)) return;
        distance = results.reduce((acc, curr) => {
            return typeof curr === 'number' ? acc + curr : acc;
        }, distance);
    }
    const gridDistance = token.parent.grid.distance;
    const travelled = Math.sign(distance) * Math.max(1, Math.round(Math.abs(distanceUtils.convertDistance(token.parent, distance)) / gridDistance)) * gridDistance;
    if (!travelled) return;
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
    const step = gridDistance * Math.sign(travelled);
    let targetPoint;
    for (let travel = travelled; Math.abs(travel) > 0; travel -= step) {
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
 * Whether a token can see the target, using midi-qol's `canSee`.
 * @param {foundry.documents.TokenDocument} sourceToken  Token looking.
 * @param {foundry.documents.TokenDocument} targetToken  Token being looked at.
 * @returns {boolean}
 * @example
 * if (!tokenUtils.canSee(token, target)) return;
 */
function canSee(sourceToken, targetToken) {
    return MidiQOL.canSee(sourceToken, targetToken);
}
/**
 * List the ids of every configured detection mode whose type is not sight.
 * @returns {string[]}
 * @example
 * const sensed = tokenUtils.canSense(token, target, tokenUtils.getNonSightModes());
 */
function getNonSightModes() {
    const detectionModes = CONFIG.Canvas.detectionModes;
    const sightType = foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT;
    return Object.keys(detectionModes).filter(id => detectionModes[id].type !== sightType);
}
/**
 * Whether a token can perceive the target through any of the given detection modes, using midi-qol's `canSenseModes`.
 * An empty list returns false.
 * @param {foundry.documents.TokenDocument} sourceToken  Token perceiving.
 * @param {foundry.documents.TokenDocument} targetToken  Token being perceived.
 * @param {string[]} [senseModes]                        Detection mode ids to test, or `['all']` for any mode. Defaults
 *                                                       to `['all']`.
 * @returns {boolean}
 * @example
 * if (!tokenUtils.canSense(token, target, ['blindsight', 'seeInvisibility'])) return;
 */
function canSense(sourceToken, targetToken, senseModes = ['all']) {
    if (!senseModes.length) return false;
    const modes = MidiQOL.canSenseModes(sourceToken, targetToken, senseModes);
    if (senseModes.includes('all')) return modes.length > 0;
    return modes.some(mode => senseModes.includes(mode));
}
/**
 * Attempt to grapple the target. On success, both tokens get linked grappling and grappled effects that are removed
 * together, and the target gets an escape item. Fails with a warning when the target is immune to grappled or, with
 * `checkSize`, too large. Runs the `preGrapple` and `postGrapple` grapple passes.
 * @param {foundry.documents.TokenDocument} sourceToken  Token grappling.
 * @param {foundry.documents.TokenDocument} targetToken  Token being grappled.
 * @param {object} [options]                             Additional options.
 * @param {dnd5e.dataModels.activity.BaseActivityData} [options.activity]
 *                                                       Initiating activity. Provides the effect icon, rules, reach and
 *                                                       default DC.
 * @param {number} [options.flatDC]                      Escape DC. Defaults to the save DC on `activity`. Without
 *                                                       either, `sourceToken` rolls Athletics to set it.
 * @param {'2024'|'2014'} [options.rules]                Rules version for the effects and roll. Defaults to the rules
 *                                                       of `activity`'s item, or `2014` without an activity.
 * @param {boolean} [options.contest]                    Roll the target's save or check before applying effects. False
 *                                                       applies them directly. Defaults to true.
 * @param {boolean} [options.checkSize]                  Enforce the size limit with {@link grappleShoveSizeCheck}.
 *                                                       Defaults to true.
 * @param {string[]} [options.conditions]                Extra conditions applied to the target with the grapple.
 * @param {number} [options.bonus]                       Added to `sourceToken`'s Athletics total when it sets the DC.
 * @returns {Promise<void>}
 * @example
 * await tokenUtils.grapple(workflow.token.document, target, {activity: workflow.activity});
 */
async function grapple(sourceToken, targetToken, {activity, flatDC, rules, contest = true, checkSize = true, conditions = [], bonus = 0} = {}) {
    return await grappleHandler.grapple(sourceToken, targetToken, {activity, flatDC, rules, contest, checkSize, conditions, bonus});
}
/**
 * Get the tokens on the same scene that a token is grappling, read from its `grappleSource` effects.
 * @param {foundry.documents.TokenDocument} token  Grappling token.
 * @returns {foundry.documents.TokenDocument[]}    Empty when the token has no actor or grapples nothing.
 * @example
 * const grappled = tokenUtils.getGrappled(token);
 * if (!grappled.length) return;
 */
function getGrappled(token) {
    if (!token.actor) return [];
    return actorUtils.getEffectByIdentifier(token.actor, 'grappleSource', {multiple: true}).map(effect => token.parent.tokens.get(effect.flags.cat?.grapple?.tokenId)).filter(Boolean);
}
/**
 * Whether a token can grapple or shove the target. The target must be no more than one size larger, after size bonuses
 * from the `sizeCheck` grapple pass and the grappler's `flags.cat.grappleShove.sizeBonus`. A target immune to grappled or prone fails the matching check.
 * @param {foundry.documents.TokenDocument} sourceToken        Token grappling or shoving.
 * @param {foundry.documents.TokenDocument} targetToken        Token being grappled or shoved.
 * @param {'grapple'|'shove-push'|'shove-prone'} [identifier]  Picks the condition immunity to check and the warning
 *                                                             message. Defaults to `grapple`.
 * @param {boolean} [warning]                                  False hides the warning on failure. Defaults to true.
 * @returns {Promise<boolean>}
 * @example
 * if (!await tokenUtils.grappleShoveSizeCheck(token, target, 'shove-prone')) return;
 */
async function grappleShoveSizeCheck(sourceToken, targetToken, identifier = 'grapple', warning = true) {
    return await grappleHandler.sizeCheck(sourceToken, targetToken, identifier, warning);
}
/**
 * Get the light level at a token's center on the viewed canvas. Darkness sources make it dark, global illumination
 * within its darkness range makes it bright, and otherwise active light sources decide.
 * @param {foundry.documents.TokenDocument} token  Token to read from.
 * @returns {'bright'|'dim'|'dark'}
 * @example
 * if (tokenUtils.getLightLevel(token) === 'bright') return;
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
 * Get the movement cost of a token's movement history. Core clears that history at the start of each combat turn.
 * @param {foundry.documents.TokenDocument} token  Token to check.
 * @param {boolean} [getRemaining]                 Return the actor's highest speed minus the movement spent, never
 *                                                 below `0`. Defaults to false.
 * @returns {number}                               Distance in feet.
 * @example
 * const remaining = tokenUtils.movementSpent(token, true);
 */
function movementSpent(token, getRemaining = false) {
    const max = actorUtils.getSpeed(token.actor, 'max');
    const spent = measureMovement(token, token.movementHistory);
    return getRemaining ? Math.max(max - spent, 0) : spent;
}
/**
 * Measure the movement cost of a path for a token with core's `measureMovementPath`.
 * @param {foundry.documents.TokenDocument} token  Token that moves.
 * @param {Point[]} waypoints                      Points along the path, in canvas pixels.
 * @returns {number}                               Cost in feet, or `0` when the path can't be measured.
 * @example
 * const cost = tokenUtils.measureMovement(token, [{x: token.x, y: token.y}, destination]);
 */
function measureMovement(token, waypoints) {
    return distanceUtils.toFeet(token.parent, token.measureMovementPath(waypoints)?.cost ?? 0);
}
export default {
    getSavedCastData,
    getDistance,
    isWithinDistance,
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
    heightAboveFloor,
    aimDestination,
    aimDestinationAs,
    canSense,
    getNonSightModes,
    grapple,
    getGrappled,
    grappleShoveSizeCheck,
    movementSpent,
    measureMovement,
    isOccupied
};
