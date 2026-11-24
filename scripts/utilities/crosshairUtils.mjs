/**
 * Crosshair aiming and path drawing on the viewed canvas. Ranges are given in feet and checked against the scene's grid
 * and diagonal rule.
 * @module
 */
import {Crosshairs, PathCrosshairs} from '../lib/_module.mjs';
import {distanceUtils, genericUtils, uiUtils} from '../utilities/_module.mjs';
const getSizeIndex = (token) => {
    const size = CONFIG.DND5E.actorSizes[token.actor?.system?.traits?.size]?.numerical;
    if (size !== undefined) return size;
    const w = token.width ?? 1;
    if (w < 1) return 0;
    if (w === 1) return 2;
    if (w === 2) return 3;
    if (w === 3) return 4;
    return 5;
};
/**
 * Find how far a range reaches horizontally from a point at an elevation, in scene units.
 * @param {ElevatedPoint} origin             Point measured from.
 * @param {number} range                     Range in scene units.
 * @param {number} elevation                 Elevation measured to.
 * @param {foundry.documents.Scene} [scene]  Scene to measure on. Defaults to the viewed scene.
 * @returns {number}                         -1 when the elevation alone is out of range.
 */
function reachInSceneUnits(origin, range, elevation, scene = canvas.scene) {
    const grid = scene.grid;
    const measure = offset => grid.measurePath([origin, {x: origin.x + (offset * grid.size / grid.distance), y: origin.y, elevation}]).distance;
    if (measure(0) > range) return -1;
    let low = 0;
    let high = range;
    for (let i = 0; i < 12; i++) {
        const middle = (low + high) / 2;
        if (measure(middle) <= range) low = middle;
        else high = middle;
    }
    return low;
}
/**
 * How far a range reaches horizontally from a point once part of it is spent climbing to another elevation. Measured
 * with the scene's diagonal rule, so a higher elevation leaves less horizontal reach.
 * @param {ElevatedPoint} origin             Point measured from, in canvas pixels with elevation in scene units.
 * @param {number} range                     Range in feet.
 * @param {number} elevation                 Elevation to measure at, in scene units.
 * @param {foundry.documents.Scene} [scene]  Scene to measure on. Defaults to the viewed scene.
 * @returns {number}                         Horizontal reach in feet, or -1 when the height difference alone is out of
 *                                           range.
 * @example
 * const origin = {...token.object.center, elevation: token.elevation};
 * const reach = crosshairUtils.horizontalReach(origin, 30, token.elevation + 20);
 */
function horizontalReach(origin, range, elevation, scene = canvas.scene) {
    const reach = reachInSceneUnits(origin, distanceUtils.convertDistance(scene, range), elevation, scene);
    return reach < 0 ? reach : distanceUtils.toFeet(scene, reach);
}
/**
 * Draw a faded copy of a token whose level is not being viewed.
 * @param {foundry.documents.TokenDocument} token  Token to copy.
 * @param {Point} center                           Center of the copy.
 * @returns {Promise<PIXI.Sprite|undefined>}
 */
async function drawGhost(token, center) {
    if (token.level === canvas.level?.id || !token.texture?.src) return;
    const texture = await foundry.canvas.loadTexture(token.texture.src);
    if (!texture) return;
    const ghost = new PIXI.Sprite(texture);
    ghost.anchor.set(0.5);
    ghost.width = token.width * canvas.grid.size * Math.abs(token.texture.scaleX ?? 1);
    ghost.height = token.height * canvas.grid.size * Math.abs(token.texture.scaleY ?? 1);
    ghost.alpha = 0.4;
    ghost.position.set(center.x, center.y);
    canvas.controls.addChild(ghost);
    return ghost;
}
/**
 * Draw the range boundary.
 * @param {Point} center   Center of the boundary.
 * @param {number} radius  Range in scene units.
 * @returns {PIXI.Graphics}
 */
function drawRange(center, radius) {
    const drawing = new PIXI.Graphics();
    drawing.lineStyle(5, 0xffffff);
    drawing.drawPolygon(canvas.grid.getCircle({x: 0, y: 0}, radius).flatMap(point => [point.x, point.y]));
    drawing.position.set(center.x, center.y);
    canvas.controls.addChild(drawing);
    return drawing;
}
/**
 * Prompt the current user to pick a point with a crosshair, measured from a token. Open windows are minimized while
 * aiming, and a faded copy of the token is drawn when it is on a level other than the one being viewed. The click is
 * blocked while the crosshair is out of range, overlaps a token within one size category, is cut off from the token by
 * a wall that blocks movement, or fails a validity function.
 * @param {object} options                                 Additional options.
 * @param {foundry.documents.TokenDocument} options.token  Origin of the range check, and the default icon.
 * @param {number} [options.maxRange]                      Range in feet, rounded to whole grid spaces. Without one, the
 *                                                         crosshair is unbounded.
 * @param {object} [options.crosshairsConfig]              Passed to `Crosshairs.showCrosshairs`, with `size` in feet.
 *                                                         Defaults to the token's image as the icon and its footprint
 *                                                         as the size.
 * @param {Point} [options.centerpoint]                    Measure from here instead of the token's center, skipping the
 *                                                         token's width compensation.
 * @param {boolean} [options.drawBoundries]                Draw the range boundary. Defaults to true.
 * @param {boolean} [options.checkOverlap]                 Block a placement overlapping a token within one size
 *                                                         category of this one. Defaults to true.
 * @param {object} [options.customCallbacks]               Merged over the internal crosshair callbacks. Replacing
 *                                                         `show` drops the range check.
 * @param {boolean} [options.trackDistance]                Show the live distance from the origin. Defaults to true.
 * @param {number} [options.fudgeDistance]                 Extra slack in feet, on top of the token's own width
 *                                                         compensation.
 * @param {Function[]} [options.validityFunctions]         Each receives the crosshair and `{x, y, elevation}`. A falsy
 *                                                         return blocks the click.
 * @param {Function} [options.getElevation]                Receives the crosshair and returns the destination elevation
 *                                                         in scene units.
 * @param {number} [options.ringElevation]                 Elevation in scene units the range is measured at when
 *                                                         `getElevation` is not given. Defaults to the token's
 *                                                         elevation.
 * @param {boolean} [options.ignoreWalls]                  Allow destinations that walls block from the token.
 * @returns {Promise<object>}                              The crosshair result, with `cancelled` set when the user
 *                                                         cancelled. Its `elevation` comes from `getElevation` when
 *                                                         given and is the token's elevation otherwise.
 * @example
 * const result = await crosshairUtils.aimCrosshair({token, maxRange: 30});
 * if (result.cancelled) return;
 * const {x, y} = result;
 */
async function aimCrosshair({token, maxRange, crosshairsConfig, centerpoint, drawBoundries = true, checkOverlap = true, customCallbacks, trackDistance = true, fudgeDistance = 0, validityFunctions = [], getElevation, ringElevation, ignoreWalls = false} = {}) {
    const tokenImg = token?.texture?.src;
    crosshairsConfig = crosshairsConfig || {icon: tokenImg};
    const baseIcon = crosshairsConfig.icon ?? Crosshairs.defaultCrosshairsConfig().icon;
    let widthAdjust = 0;
    if (maxRange) maxRange = distanceUtils.toRangeUnits(canvas.scene, Number(maxRange));
    const rangeLabel = maxRange ? distanceUtils.formatDistance(canvas.scene, distanceUtils.toFeet(canvas.scene, maxRange)) : '';
    fudgeDistance = distanceUtils.convertDistance(canvas.scene, fudgeDistance);
    const squareGrid = canvas.grid.type === CONST.GRID_TYPES.SQUARE;
    const cellEdge = squareGrid ? canvas.grid.distance * (centerpoint ? 1 : token.width) / 2 : 0;
    if (!centerpoint && !squareGrid) {
        const actualHalf = token.width / 2;
        widthAdjust += canvas.grid.distance * Math.floor(actualHalf);
        if (!fudgeDistance && (widthAdjust !== actualHalf * canvas.grid.distance)) fudgeDistance = canvas.grid.distance / 2;
        fudgeDistance += widthAdjust;
    }
    centerpoint = centerpoint ?? token.getCenterPoint();
    const origin = {x: centerpoint.x, y: centerpoint.y, elevation: token.elevation};
    const level = token?.parent.levels.get(token.level);
    const tokenSizeIndex = getSizeIndex(token);
    const footprint = {w: (token.width ?? 1) * canvas.grid.size, h: (token.height ?? 1) * canvas.grid.size};
    let drawing;
    let elevation;
    const isOverlapping = ({x, y}) => {
        const area = new PIXI.Rectangle(x - (footprint.w / 2) + 1, y - (footprint.h / 2) + 1, footprint.w - 2, footprint.h - 2);
        return canvas.tokens.placeables.some(t => t.document !== token && t.bounds.intersects(area) && Math.abs(tokenSizeIndex - getSizeIndex(t.document)) < 2);
    };
    let last;
    const validate = crosshairs => {
        const {x, y} = crosshairs.position;
        if (last?.x === x && last?.y === y) return;
        last = {x, y};
        elevation = getElevation?.(crosshairs);
        const measured = {x, y, elevation: elevation ?? ringElevation ?? origin.elevation};
        const distance = Math.max(0, canvas.grid.measurePath([origin, measured]).distance.toNearest(0.1) - widthAdjust - fudgeDistance);
        const blocked = (maxRange && distance > maxRange)
                || (checkOverlap && isOverlapping(measured))
                || (level && !ignoreWalls && CONFIG.Canvas.polygonBackends.move.testCollision(token.getCenterPoint(), {x, y}, {type: 'move', mode: 'any', level}))
                || validityFunctions.some(i => !i(crosshairs, {x, y, elevation}));
        crosshairs.valid = !blocked;
        crosshairs.icon = blocked ? 'icons/svg/hazard.svg' : baseIcon;
        if (drawing) drawing.tint = blocked ? 0xff0000 : 0x32cd32;
        crosshairs.draw();
        if (maxRange) crosshairs.label = distance + '/' + rangeLabel;
    };
    const checkDistance = async (crosshairs) => {
        if (maxRange && drawBoundries) {
            const reach = Math.max(reachInSceneUnits(origin, maxRange, ringElevation ?? origin.elevation), 0);
            drawing = drawRange(centerpoint, reach + fudgeDistance + widthAdjust + cellEdge);
        }
        while (crosshairs.inFlight) {
            await genericUtils.sleep(100);
            if (!crosshairs.inFlight || crosshairs._destroyed) break;
            validate(crosshairs);
        }
    };
    const callbacks = {
        show: checkDistance,
        validate,
        ...(customCallbacks ?? {})
    };
    const tokenSize = token ? (token.width * canvas.dimensions.distance) / 2 : undefined;
    const tokenResolution = token ? ((token.width % 2) ? 1 : -1) : 1;
    let options = {
        size: tokenSize,
        resolution: tokenResolution,
        ...crosshairsConfig
    };
    if (crosshairsConfig.size) options.size = distanceUtils.convertDistance(canvas.scene, crosshairsConfig.size);
    if (trackDistance) options.label = distanceUtils.formatDistance(canvas.scene, 0);
    if (token?.rotation && options.direction === undefined && !options.lockDirection) options.direction = token.rotation;
    const [restoreWindows, ghost] = await Promise.all([uiUtils.minimizeWindows(), drawGhost(token, centerpoint)]);
    try {
        const result = await Crosshairs.showCrosshairs(options, callbacks);
        result.elevation = getElevation ? elevation : origin.elevation;
        return result;
    } finally {
        ghost?.destroy();
        drawing?.destroy();
        await restoreWindows();
    }
}
/**
 * Prompt the current user to draw a path, or place a ring, on the canvas and pick its active side. Open windows are
 * minimized while drawing. Starting a new drawing cancels one already in progress. Left-click adds a point and Shift
 * skips grid snapping. Right-click removes the last point, or cancels when there is none. Clicking the first point
 * closes the shape, and double-click or Enter finishes an open path. Esc cancels. Rings follow the cursor and the mouse
 * wheel changes their diameter.
 * @param {object} config                                   See `PathCrosshairs.show`. Lengths there are in feet.
 * @param {foundry.documents.TokenDocument} [config.token]  Origin of the range check.
 * @param {number} [config.maxRange]                        Range in feet every point must stay within, measured from
 *                                                          the token's center. Needs `token`. A border shows the range.
 *                                                          Replaces any `isValid` and `onValidity` in `config`.
 * @returns {Promise<object|null>}                          `{points, segments, closed, side, ring}` in canvas pixels,
 *                                                          or null when cancelled.
 * @example
 * const path = await crosshairUtils.drawPath({token, maxRange: 120, maxLength: 60});
 * if (!path) return;
 * await regionUtils.createPathRegions(canvas.scene, path, {thickness: 1, walls: 'solid'});
 */
async function drawPath({token, maxRange, ...config} = {}) {
    let drawing;
    if (token && maxRange) {
        maxRange = distanceUtils.toRangeUnits(canvas.scene, maxRange);
        const origin = {...token.getCenterPoint(), elevation: token.elevation};
        const halfToken = canvas.grid.distance * token.width / 2;
        drawing = drawRange(origin, Math.max(reachInSceneUnits(origin, maxRange, origin.elevation), 0) + (canvas.grid.type === CONST.GRID_TYPES.SQUARE ? halfToken : 0));
        config.isValid = point => canvas.grid.measurePath([origin, {...point, elevation: origin.elevation}]).distance <= maxRange + halfToken;
        config.onValidity = valid => drawing.tint = valid ? 0x32cd32 : 0xff0000;
    }
    const restoreWindows = await uiUtils.minimizeWindows();
    try {
        return await PathCrosshairs.show(config);
    } finally {
        drawing?.destroy();
        await restoreWindows();
    }
}
export default {
    aimCrosshair,
    drawPath,
    horizontalReach
};
