import {Crosshairs, PathCrosshairs} from '../lib/_module.mjs';
import {genericUtils, uiUtils} from '../utilities/_module.mjs';
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
 * Horizontal reach left at an elevation.
 * @param {{x: number, y: number, elevation: number}} origin Origin point.
 * @param {number} range Range in scene units.
 * @param {number} elevation Elevation to measure at.
 * @returns {number} Scene units, or -1 if out of range.
 */
function horizontalReach(origin, range, elevation) {
    const measure = offset => canvas.grid.measurePath([origin, {x: origin.x + (offset * canvas.grid.size / canvas.grid.distance), y: origin.y, elevation}]).distance;
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
 * Draw a faded copy of a token whose level is not being viewed.
 * @param {foundry.documents.TokenDocument} token Token to copy.
 * @param {{x: number, y: number}} center Centre of the copy.
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
 * @param {{x: number, y: number}} center Centre of the boundary.
 * @param {number} radius Range in scene units.
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
 * Show a crosshair, optionally bounded to a range from a token.
 * @param {object} [options] Additional options.
 * @param {foundry.documents.TokenDocument} [options.token] Origin of the range check, and the default icon.
 * @param {number} [options.maxRange] Scene units. Without one, the crosshair is unbounded and placed freely.
 * @param {object} [options.crosshairsConfig] Passed to {@link Crosshairs.showCrosshairs}.
 * @param {object} [options.centerpoint] Measure from here instead of the token's centre, skipping width compensation.
 * @param {boolean} [options.drawBoundries] Draw the range boundary.
 * @param {boolean} [options.checkOverlap] Reject a placement overlapping another token.
 * @param {object} [options.customCallbacks] Merged over the internal crosshair callbacks.
 * @param {boolean} [options.trackDistance] Show the live distance from the origin.
 * @param {number} [options.fudgeDistance] Extra slack in scene units, on top of the token's own width compensation.
 * @param {Function[]} [options.validityFunctions] Receive the crosshair and `{x, y, elevation}`; a falsy return blocks the click.
 * @param {Function} [options.getElevation] Returns the destination elevation for the crosshair.
 * @param {number} [options.ringElevation] Elevation the range boundary is drawn at.
 * @param {boolean} [options.ignoreWalls] Allow destinations that walls block from the token.
 * @returns {Promise<object>} The crosshair result, plus `elevation` when `getElevation` is given.
 */
async function aimCrosshair({token, maxRange, crosshairsConfig, centerpoint, drawBoundries = true, checkOverlap = true, customCallbacks, trackDistance = true, fudgeDistance = 0, validityFunctions = [], getElevation, ringElevation, ignoreWalls = false} = {}) {
    const tokenImg = token?.texture?.src;
    crosshairsConfig = crosshairsConfig || {icon: tokenImg};
    const baseIcon = crosshairsConfig.icon ?? Crosshairs.defaultCrosshairsConfig().icon;
    let widthAdjust = 0;
    if (maxRange) maxRange = Number(maxRange);
    const squareGrid = canvas.grid.type === CONST.GRID_TYPES.SQUARE;
    const cellEdge = squareGrid ? canvas.grid.distance * (centerpoint ? 1 : token.width) / 2 : 0;
    if (!centerpoint && !squareGrid) {
        const actualHalf = token.width / 2;
        widthAdjust += canvas.grid.distance * Math.floor(actualHalf);
        if (!fudgeDistance && (widthAdjust !== actualHalf * canvas.grid.distance)) fudgeDistance = 2.5;
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
    const checkDistance = async (crosshairs) => {
        if (maxRange && drawBoundries) {
            const reach = Math.max(horizontalReach(origin, maxRange, ringElevation ?? origin.elevation), 0);
            drawing = drawRange(centerpoint, reach + fudgeDistance + widthAdjust + cellEdge);
        }
        let last;
        while (crosshairs.inFlight) {
            await genericUtils.sleep(100);
            if (!crosshairs.inFlight || crosshairs._destroyed) break;
            const {x, y} = crosshairs.position;
            if (last?.x === x && last?.y === y) continue;
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
            if (maxRange) crosshairs.label = distance + '/' + maxRange + 'ft.';
        }
    };
    const callbacks = {
        show: checkDistance,
        ...(customCallbacks ?? {})
    };
    const tokenSize = token ? (token.width * canvas.dimensions.distance) / 2 : undefined;
    const tokenResolution = token ? ((token.width % 2) ? 1 : -1) : 1;
    let options = {
        size: tokenSize,
        resolution: tokenResolution,
        ...crosshairsConfig
    };
    if (trackDistance) options.label = '0ft';
    if (token?.rotation && options.direction === undefined && !options.lockDirection) options.direction = token.rotation;
    const [restoreWindows, ghost] = await Promise.all([uiUtils.minimizeWindows(), drawGhost(token, centerpoint)]);
    try {
        const result = await Crosshairs.showCrosshairs(options, callbacks);
        if (getElevation) result.elevation = elevation;
        return result;
    } finally {
        ghost?.destroy();
        drawing?.destroy();
        await restoreWindows();
    }
}
/**
 * Draw a path, or place a ring, on the canvas and pick its active side. Open windows are minimized while drawing.
 * Left-click adds a point, Shift skips grid snapping, right-click removes the last point (or cancels), clicking the first point closes the shape, double-click or Enter finishes an open path, Esc cancels. Rings follow the cursor and the mouse wheel changes their diameter.
 * @param {object} config See {@link PathCrosshairs.show}.
 * @param {foundry.documents.TokenDocument} [config.token] Origin of the range check.
 * @param {number} [config.maxRange] Scene units every point must stay within, measured from the token. A border shows the range.
 * @returns {Promise<object|null>} Points, closed state, side and ring data, or null when cancelled.
 */
async function drawPath({token, maxRange, ...config} = {}) {
    let drawing;
    if (token && maxRange) {
        const origin = {...token.getCenterPoint(), elevation: token.elevation};
        const halfToken = canvas.grid.distance * token.width / 2;
        drawing = drawRange(origin, Math.max(horizontalReach(origin, maxRange, origin.elevation), 0) + (canvas.grid.type === CONST.GRID_TYPES.SQUARE ? halfToken : 0));
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
