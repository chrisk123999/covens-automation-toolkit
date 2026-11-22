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
    if (shape.clipperPaths) return shape.clipperPaths;
    return toPath(Array.from({length: shape.points.length / 2}, (_, index) => ({x: shape.points[index * 2], y: shape.points[index * 2 + 1]})));
}
function outerPath(points) {
    const path = toPath(points);
    if (!ClipperLib.Clipper.Orientation(path)) path.reverse();
    return path;
}
/**
 * @typedef {object} WallPath
 * @property {Point[]} [points]             Connected points in canvas pixels.
 * @property {boolean} [closed]             Whether the last point joins back to the first.
 * @property {[Point, Point][]} [segments]  Separate segments, used instead of points for panel walls that may branch.
 */
function bandPaths(path, thickness) {
    if (path.segments) return offset(path.segments.map(toPath), thickness / 2, ClipperLib.EndType.etOpenSquare, ClipperLib.JoinType.jtMiter);
    const endType = path.closed ? ClipperLib.EndType.etClosedLine : ClipperLib.EndType.etOpenButt;
    return offset([toPath(path.points)], thickness / 2, endType, ClipperLib.JoinType.jtMiter);
}
/**
 * Thicken a path into region polygon shapes, with `thickness / 2` on each side of the line. Paths given as `points` get
 * flat ends, and paths given as `segments` get square ends that extend past each endpoint.
 * @param {WallPath} path     Path to thicken, in canvas pixels.
 * @param {number} thickness  Total thickness in canvas pixels.
 * @returns {{type: 'polygon', points: number[], hole: boolean}[]}
 *                            Region shape data.
 * @example
 * const shapes = regionUtils.pathBand(path, distanceUtils.toPixels(canvas.scene, 5));
 * await documentUtils.update(region, {shapes});
 */
function pathBand(path, thickness) {
    return toShapes(bandPaths(path, thickness));
}
/**
 * The segments of a path as point pairs, including the closing segment of a closed path with more than two points. A
 * path given as `segments` returns them as they are.
 * @param {WallPath} path       Path to split.
 * @returns {[Point, Point][]}  Segments in canvas pixels.
 * @example
 * const segments = regionUtils.pathSegments({points: [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 100}], closed: true});
 * segments.length; // 3
 */
function pathSegments(path) {
    if (path.segments) return path.segments;
    const points = path.points;
    const pairs = points.slice(1).map((point, index) => [points[index], point]);
    if (path.closed && points.length > 2) pairs.push([points.at(-1), points[0]]);
    return pairs;
}
/**
 * Whether a point lies in polygon shapes. A point on an outer edge counts as inside, and a point strictly inside a hole
 * counts as outside.
 * @param {{type: 'polygon', points: number[], hole: boolean}[]} shapes
 *                       Shapes from {@link regionUtils.pathBand} or `sideBand`, or region shape data.
 * @param {Point} point  Point in canvas pixels.
 * @returns {boolean}
 * @example
 * const inside = regionUtils.containsPoint(region.shapes, token.object.center);
 */
function containsPoint(shapes, point) {
    const target = {X: Math.round(point.x * SCALE), Y: Math.round(point.y * SCALE)};
    const test = shape => ClipperLib.Clipper.PointInPolygon(target, shapeToPath(shape));
    return shapes.some(shape => !shape.hole && test(shape) !== 0) && !shapes.some(shape => shape.hole && test(shape) === 1);
}
/**
 * The segment nearest a point.
 * @param {Point} point                Point in canvas pixels.
 * @param {[Point, Point][]} segments  Segments to search.
 * @returns {{distance: number, closest: Point, a: Point, b: Point}|undefined}
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
 * The band of a given depth on one side of a path. Open paths take `left` or `right`, relative to the drawing
 * direction. Closed paths take `inside` or `outside`.
 * @param {Point[]} points                          Path points in canvas pixels.
 * @param {boolean} closed                          Whether the last point joins back to the first.
 * @param {'left'|'right'|'inside'|'outside'} side  Side the band lies on.
 * @param {number} depth                            Band depth in canvas pixels.
 * @param {object} [options]                        Additional options.
 * @param {number} [options.gap]                    Thickness in canvas pixels of a strip along the path left out of the
 *                                                  band, so the band does not overlap the path's own area.
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
 * Cut one set of polygon shapes out of another. The result can include hole polygons.
 * @param {{type: 'polygon', points: number[], hole: boolean}[]} shapes Shapes to cut from, in canvas pixels.
 * @param {{type: 'polygon', points: number[], hole: boolean}[]} cut Shapes to remove, in canvas pixels.
 * @returns {{type: 'polygon', points: number[], hole: boolean}[]} Region shape data. Empty when nothing is left.
 * @example
 * const shapes = regionUtils.subtractShapes(region.shapes, regionUtils.pathBand(path, 50));
 * await documentUtils.update(region, {shapes});
 */
function subtractShapes(shapes, cut) {
    return toShapes(combine(shapes.map(shapeToPath), cut.map(shapeToPath), ClipperLib.ClipType.ctDifference));
}
/**
 * Shorten a connected path by a length, removing it from the end. The input array is not changed.
 * @param {Point[]} points  Path points in canvas pixels.
 * @param {number} length   Length to remove in canvas pixels.
 * @returns {Point[]}       Remaining points. Empty when less than one segment is left.
 * @example
 * regionUtils.trimPath([{x: 0, y: 0}, {x: 100, y: 0}], 40); // [{x: 0, y: 0}, {x: 60, y: 0}]
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

/**
 * The area where two regions' shapes overlap on the canvas. Elevation and levels are ignored.
 * @param {foundry.documents.RegionDocument} region       Region to check.
 * @param {foundry.documents.RegionDocument} otherRegion  Region to compare against.
 * @returns {{X: number, Y: number}[][]}                  ClipperLib paths, with coordinates in canvas pixels multiplied
 *                                                        by 100. Empty when the regions don't overlap or either has no
 *                                                        shapes.
 * @example
 * const overlap = regionUtils.intersection(region, otherRegion);
 * if (!overlap.length) return;
 */
function intersection(region, otherRegion) {
    const pathA = region.shapes?.flatMap(shapeToPath);
    const pathB = otherRegion.shapes?.flatMap(shapeToPath);
    if (!pathA?.length || !pathB?.length) return [];
    return combine(pathA, pathB, ClipperLib.ClipType.ctIntersection);
}
export default {
    trimPath,
    subtractShapes,
    pathBand,
    pathSegments,
    containsPoint,
    nearestSegment,
    sideBand,
    intersection
};
