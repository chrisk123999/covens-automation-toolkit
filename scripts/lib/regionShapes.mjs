/* global ClipperLib */
const SCALE = 100;
function toPath(points) {
    return points.map(point => ({X: Math.round(point.x * SCALE), Y: Math.round(point.y * SCALE)}));
}
function toShapes(paths) {
    return paths.filter(path => path.length > 2).map(path => ({
        type: 'polygon',
        points: path.flatMap(point => [point.X / SCALE, point.Y / SCALE]),
        hole: !ClipperLib.Clipper.Orientation(path)
    }));
}
function offset(paths, delta, endType, joinType = ClipperLib.JoinType.jtRound) {
    const offsetter = new ClipperLib.ClipperOffset(2, 0.25 * SCALE);
    offsetter.AddPaths(paths, joinType, endType);
    const solution = new ClipperLib.Paths();
    offsetter.Execute(solution, delta * SCALE);
    return solution;
}
function combine(subject, clip, clipType) {
    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
    if (clip.length) clipper.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
    const solution = new ClipperLib.Paths();
    clipper.Execute(clipType, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    return solution;
}
function shapeToPath(shape) {
    return toPath(Array.from({length: shape.points.length / 2}, (_, index) => ({x: shape.points[index * 2], y: shape.points[index * 2 + 1]})));
}
function outerPath(points) {
    const path = toPath(points);
    if (!ClipperLib.Clipper.Orientation(path)) path.reverse();
    return path;
}
/**
 * @typedef {object} WallPath
 * @property {{x: number, y: number}[]} [points] Connected points in canvas pixels.
 * @property {boolean} [closed] Whether the last point joins back to the first.
 * @property {[{x: number, y: number}, {x: number, y: number}][]} [segments] Separate segments, used instead of points for panel walls that may branch.
 */
function bandPaths(path, thickness) {
    if (path.segments) return offset(path.segments.map(toPath), thickness / 2, ClipperLib.EndType.etOpenSquare, ClipperLib.JoinType.jtMiter);
    const endType = path.closed ? ClipperLib.EndType.etClosedLine : ClipperLib.EndType.etOpenButt;
    return offset([toPath(path.points)], thickness / 2, endType, ClipperLib.JoinType.jtMiter);
}
/**
 * Thicken a path into region polygon shapes.
 * @param {WallPath} path Path to thicken.
 * @param {number} thickness Total thickness in canvas pixels.
 * @returns {{type: 'polygon', points: number[], hole: boolean}[]}
 */
function pathBand(path, thickness) {
    return toShapes(bandPaths(path, thickness));
}
/**
 * The segments of a path as point pairs, including the closing segment of a closed path.
 * @param {WallPath} path Path to split.
 * @returns {[{x: number, y: number}, {x: number, y: number}][]}
 */
function pathSegments(path) {
    if (path.segments) return path.segments;
    const points = path.points;
    const pairs = points.slice(1).map((point, index) => [points[index], point]);
    if (path.closed && points.length > 2) pairs.push([points.at(-1), points[0]]);
    return pairs;
}
/**
 * Whether a point lies in polygon shapes, counting points on an edge as inside and honouring holes.
 * @param {{type: 'polygon', points: number[], hole: boolean}[]} shapes Shapes from {@link pathBand} or {@link sideBand}, or region polygon shape data.
 * @param {{x: number, y: number}} point Point in canvas pixels.
 * @returns {boolean}
 */
function containsPoint(shapes, point) {
    const target = {X: Math.round(point.x * SCALE), Y: Math.round(point.y * SCALE)};
    const test = shape => ClipperLib.Clipper.PointInPolygon(target, shapeToPath(shape));
    return shapes.some(shape => !shape.hole && test(shape) !== 0) && !shapes.some(shape => shape.hole && test(shape) === 1);
}
/**
 * The segment nearest a point.
 * @param {{x: number, y: number}} point Point in canvas pixels.
 * @param {[{x: number, y: number}, {x: number, y: number}][]} segments Segments to search.
 * @returns {{distance: number, closest: {x: number, y: number}, a: {x: number, y: number}, b: {x: number, y: number}}|undefined}
 */
function nearestSegment(point, segments) {
    let best;
    for (const [a, b] of segments) {
        const closest = foundry.utils.closestPointToSegment(point, a, b);
        const distance = Math.hypot(point.x - closest.x, point.y - closest.y);
        if (!best || distance < best.distance) best = {distance, closest, a, b};
    }
    return best;
}
function wedge(center, from, to, radius) {
    let sweep = to - from;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    while (sweep < -Math.PI) sweep += Math.PI * 2;
    const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)));
    const points = [center];
    for (let step = 0; step <= steps; step++) {
        const angle = from + sweep * step / steps;
        points.push({x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius});
    }
    return points;
}
/**
 * The band of a given depth on one side of a path.
 * Open paths take `left` or `right`, relative to the drawing direction. Closed paths take `inside` or `outside`.
 * @param {{x: number, y: number}[]} points Path points in canvas pixels.
 * @param {boolean} closed Whether the last point joins back to the first.
 * @param {'left'|'right'|'inside'|'outside'} side Side the band lies on.
 * @param {number} depth Band depth in canvas pixels.
 * @param {object} [options] Additional options.
 * @param {number} [options.gap] Thickness in canvas pixels of a strip along the path left out of the band, so the band does not overlap the path's own area.
 * @returns {{type: 'polygon', points: number[], hole: boolean}[]}
 */
function sideBand(points, closed, side, depth, {gap = 0} = {}) {
    if (points.length < 2 || !side) return [];
    let paths;
    if (closed) {
        const polygon = [outerPath(points)];
        const endType = ClipperLib.EndType.etClosedPolygon;
        if (side === 'outside') paths = combine(offset(polygon, depth, endType), polygon, ClipperLib.ClipType.ctDifference);
        else paths = combine(polygon, offset(polygon, -depth, endType), ClipperLib.ClipType.ctDifference);
    } else {
        const sign = side === 'left' ? 1 : -1;
        const pieces = [];
        let previous;
        for (const [a, b] of pathSegments({points})) {
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            if (!length) continue;
            const normal = {x: (b.y - a.y) / length * sign * depth, y: -(b.x - a.x) / length * sign * depth};
            pieces.push([a, b, {x: b.x + normal.x, y: b.y + normal.y}, {x: a.x + normal.x, y: a.y + normal.y}]);
            if (previous) pieces.push(wedge(a, Math.atan2(previous.y, previous.x), Math.atan2(normal.y, normal.x), depth));
            previous = normal;
        }
        paths = combine(pieces.map(outerPath), [], ClipperLib.ClipType.ctUnion);
    }
    if (gap) paths = combine(paths, bandPaths({points, closed}, gap), ClipperLib.ClipType.ctDifference);
    return toShapes(paths);
}
/**
 * Cut one set of polygon shapes out of another.
 * @param {{type: 'polygon', points: number[], hole: boolean}[]} shapes Shapes to cut from.
 * @param {{type: 'polygon', points: number[], hole: boolean}[]} cut Shapes to remove.
 * @returns {{type: 'polygon', points: number[], hole: boolean}[]}
 */
function subtractShapes(shapes, cut) {
    return toShapes(combine(shapes.map(shapeToPath), cut.map(shapeToPath), ClipperLib.ClipType.ctDifference));
}
/**
 * Shorten a connected path by a length, removing it from the end.
 * @param {{x: number, y: number}[]} points Path points in canvas pixels.
 * @param {number} length Length to remove in canvas pixels.
 * @returns {{x: number, y: number}[]} Remaining points; fewer than two when nothing is left.
 */
function trimPath(points, length) {
    const result = points.map(point => ({...point}));
    while (length > 0 && result.length > 1) {
        const end = result.at(-1);
        const previous = result.at(-2);
        const segment = Math.hypot(end.x - previous.x, end.y - previous.y);
        if (segment > length) {
            result[result.length - 1] = {x: end.x - (end.x - previous.x) / segment * length, y: end.y - (end.y - previous.y) / segment * length};
            return result;
        }
        length -= segment;
        result.pop();
    }
    return result.length > 1 ? result : [];
}
export default {
    trimPath,
    subtractShapes,
    pathBand,
    pathSegments,
    containsPoint,
    nearestSegment,
    sideBand
};
