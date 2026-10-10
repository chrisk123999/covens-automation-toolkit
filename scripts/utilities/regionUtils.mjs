import {documentUtils} from './_module.mjs';
/**
 * The activity that placed this region.
 * @param {foundry.documents.RegionDocument} region Region to resolve the origin of.
 * @returns {dnd5e.documents.activity.Activity|undefined} Undefined when the region was not placed by an activity.
 */
function getActivity(region) {
    const activityUuid = region.flags.dnd5e?.activity;
    if (activityUuid) return fromUuidSync(activityUuid, {strict: false});
}
/**
 * Cast data stamped on this region when it was placed.
 * @param {foundry.documents.RegionDocument} region Region to read the flag from.
 * @returns {{castLevel: number, baseLevel: number, saveDC: number}|undefined} Undefined when nothing was stamped.
 */
function getCastData(region) {
    return region.flags.cat?.castData;
}
/**
 * Whether a ray crosses this region's boundary.
 * @param {foundry.documents.RegionDocument} region Region to test against.
 * @param {{A: {x: number, y: number}, B: {x: number, y: number}}} ray Ray with start and end points.
 * @returns {boolean}
 */
function rayIntersectsRegion(region, ray) {
    return getIntersections(region, ray.A, ray.B, true);
}
/**
 * Whether the line between two tokens crosses this region.
 * @param {foundry.documents.RegionDocument} region Region to test against.
 * @param {foundry.documents.TokenDocument} sourceToken Token the line starts from.
 * @param {foundry.documents.TokenDocument} targetToken Token the line ends at.
 * @returns {boolean}
 */
function isBetweenTokens(region, sourceToken, targetToken) {
    if (!region.includedInLevel(sourceToken._source.level) && !region.includedInLevel(targetToken._source.level)) return false;
    const origin = sourceToken.getMovementOrigin(sourceToken._source);
    const destination = targetToken.getMovementOrigin(targetToken._source);
    return region.segmentizeMovementPath([origin, destination], [{x: 0, y: 0}]).length > 0;
}
/**
 * Every point where the segment AB crosses this region's boundary.
 * @param {foundry.documents.RegionDocument} region Region to test against.
 * @param {{x: number, y: number}} A Start of the segment, in canvas pixels.
 * @param {{x: number, y: number}} B End of the segment, in canvas pixels.
 * @param {boolean} [boolOnly] Stop at the first crossing and return a boolean instead.
 * @returns {{x: number, y: number}[]|boolean} Intersection points, or whether any exists.
 */
function getIntersections(region, A, B, boolOnly = false) {
    const totalIntersections = [];
    region.polygons.forEach(shape => {
        if (boolOnly && totalIntersections.length) return;
        if (shape.segmentIntersections) {
            const intersections = shape.segmentIntersections(A, B);
            totalIntersections.push(... intersections);
        } else {
            const points = shape.points;
            for (let i = 0; i < points.length; i += 2) {
                const currCoord = {
                    x: points[i],
                    y: points[i + 1]
                };
                const nextCoord = {
                    x: points[(i + 2) % points.length],
                    y: points[(i + 3) % points.length]
                };
                if (foundry.utils.lineSegmentIntersects(A, B, currCoord, nextCoord)) {
                    totalIntersections.push(foundry.utils.lineLineIntersection(A, B, currCoord, nextCoord));
                    if (boolOnly) return true;
                }
            }
        }
    });
    if (boolOnly) return totalIntersections.length ? true : false;
    return totalIntersections;
}
/**
 * Whether this region blocks sight of the creatures inside it.
 * @param {foundry.documents.RegionDocument} region Region to read the flag from.
 * @returns {boolean|undefined} Undefined when the region carries no visibility flag.
 */
function isObscured(region) {
    return region.flags.cat?.visibility?.obscured;
}
/**
 * Whether this region counts as magical darkness.
 * @param {foundry.documents.RegionDocument} region Region to read the flag from.
 * @returns {boolean|undefined} Undefined when the region carries no visibility flag.
 */
function isMagicalDarkness(region) {
    return region.flags.cat?.visibility?.magicalDarkness;
}
/**
 * The point a region shape is positioned from, used to measure how far it has moved.
 * @param {object} shape Region shape data. An emanation resolves to its base shape.
 * @returns {{x: number, y: number}} Canvas pixels, defaulting to the origin.
 */
function getShapeAnchor(shape) {
    if (!shape) return {x: 0, y: 0};
    if (shape.type === 'emanation') return getShapeAnchor(shape.base);
    if (shape.type === 'polygon' || shape.points) {
        return {x: shape.points[0] ?? 0, y: shape.points[1] ?? 0};
    }
    return {x: shape.x ?? 0, y: shape.y ?? 0};
}
/**
 * Sort every token on the scene by how this region's movement affected it, sampling along the path so a region swept over a token still counts.
 * @param {foundry.documents.RegionDocument} region Region in its new position.
 * @param {{oldX: number, oldY: number, oldBottom: number, oldTop: number}} locationData Where the region was before it moved.
 * @returns {{entered: Set, exited: Set, through: Set, stayed: Set}} Token documents grouped by what happened to them.
 */
function getRegionMovementTokens(region, locationData) {
    const results = { 
        entered: new Set(), 
        exited: new Set(), 
        through: new Set(), 
        stayed: new Set() 
    };
    const scene = region.parent;
    const tokens = scene.tokens;
    if (!tokens.size) return results;
    const gridSize = scene.grid.size;
    const gridDistance = scene.grid.distance;
    const newBottom = region.elevation.bottom;
    const newAnchor = getShapeAnchor(region.shapes[0]);
    const dx = newAnchor.x - locationData.oldX;
    const dy = newAnchor.y - locationData.oldY;
    const dz = (isFinite(newBottom) && isFinite(locationData.oldBottom)) ? (newBottom - locationData.oldBottom) : 0;
    const checkHit = (token, fraction) => {
        const offsetX = dx * (1 - fraction);
        const offsetY = dy * (1 - fraction);
        const offsetZ = dz * (1 - fraction);
        return token.document.testInsideRegion(region, {
            x: token.document.x + offsetX,
            y: token.document.y + offsetY,
            elevation: token.document.elevation + offsetZ
        });
    };
    const distance2D = Math.hypot(dx, dy);
    const dzGridUnits = Math.abs(dz);
    const dzPixels = dzGridUnits * (gridSize / gridDistance);
    const totalEffectiveDistance = Math.max(distance2D, dzPixels);
    tokens.forEach(token => {
        if (!token.object) return;
        const wasInside = checkHit(token.object, 0);
        const isInside = checkHit(token.object, 1);
        if (wasInside && isInside) results.stayed.add(token);
        else if (!wasInside && isInside) results.entered.add(token);
        else if (wasInside && !isInside) results.exited.add(token);
        else if (!wasInside && !isInside && totalEffectiveDistance > 0) {
            let through = false;
            const stepSize = gridSize / 4;
            const steps = Math.max(1, Math.ceil(totalEffectiveDistance / stepSize));
            for (let i = 1; i < steps; i++) {
                if (checkHit(token.object, i / steps)) {
                    through = true;
                    break;
                }
            }
            if (through) results.through.add(token);
        }
    });
    return results;
}
/**
 * The circle this region covers.
 * @param {foundry.documents.RegionDocument} region Region to read.
 * @returns {{x: number, y: number, radius: number}} Pixel values.
 */
function getArea(region) {
    const spread = region.flags.cat?.spreadAroundCorners;
    if (spread) return spread;
    const {center, width, height} = region.bounds;
    return {x: center.x, y: center.y, radius: Math.max(width, height) / 2};
}
/**
 * Reshape a circular region so it spreads around wall corners. Token-attached regions are skipped.
 * @param {foundry.documents.RegionDocument} region Region to reshape.
 * @param {object} [options] Additional options.
 * @param {number} [options.depth] How many corners the area may turn.
 * @returns {Promise<void>}
 */
async function spreadAroundCorners(region, {depth = 2} = {}) {
    const shape = region.shapes[0];
    if (region.attachment?.token || shape?.type !== 'circle' || region.parent !== canvas.scene) return;
    const level = region.parent.levels.get(region._source.levels?.[0]);
    const elevation = Number.isFinite(region.elevation.bottom) ? region.elevation.bottom : 0;
    const corners = new Map();
    for (const wall of region.parent.walls) {
        if (wall.move === CONST.WALL_MOVEMENT_TYPES.NONE) continue;
        for (const [x, y] of [[wall.c[0], wall.c[1]], [wall.c[2], wall.c[3]]]) {
            if (Math.hypot(x - shape.x, y - shape.y) < shape.radius) corners.set(x + ',' + y, {x, y});
        }
    }
    const visited = new Set();
    const polygons = [];
    const queue = [{x: shape.x, y: shape.y, radius: shape.radius, remaining: depth}];
    while (queue.length) {
        const {x, y, radius, remaining} = queue.shift();
        const polygon = CONFIG.Canvas.polygonBackends.move.create({x, y, elevation}, {type: 'move', radius, level});
        polygons.push(polygon.points);
        if (!remaining) continue;
        const vertices = new Set();
        for (let i = 0; i < polygon.points.length; i += 2) vertices.add(Math.round(polygon.points[i]) + ',' + Math.round(polygon.points[i + 1]));
        for (const [key, corner] of corners) {
            if (visited.has(key) || !vertices.has(key)) continue;
            const distance = Math.hypot(corner.x - x, corner.y - y);
            if (!distance || distance >= radius) continue;
            visited.add(key);
            queue.push({
                x: corner.x + ((corner.x - x) / distance * 2),
                y: corner.y + ((corner.y - y) / distance * 2),
                radius: radius - distance,
                remaining: remaining - 1
            });
        }
    }
    await documentUtils.update(region, {
        shapes: polygons.map(points => ({type: 'polygon', points})),
        restriction: {enabled: false},
        'flags.cat.spreadAroundCorners': {x: shape.x, y: shape.y, radius: shape.radius}
    });
}
export default {
    getActivity,
    getCastData,
    rayIntersectsRegion,
    isBetweenTokens,
    getIntersections,
    isObscured,
    isMagicalDarkness,
    getShapeAnchor,
    getRegionMovementTokens,
    getArea,
    spreadAroundCorners
};