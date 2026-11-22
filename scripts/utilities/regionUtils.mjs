/**
 * Region lookups, geometry and path regions. Covers regions placed by activities, path regions with walls and wall
 * panels, and the region flags CAT reads for visibility and spell wards.
 * @module
 */
import {distanceUtils, documentUtils, effectUtils, summonUtils, tokenUtils} from './_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import regionShapes from '../lib/regionShapes.mjs';
const wallPresets = {
    opaque: {move: CONST.WALL_MOVEMENT_TYPES.NONE, sight: CONST.EDGE_SENSE_TYPES.NORMAL, light: CONST.EDGE_SENSE_TYPES.NORMAL, sound: CONST.EDGE_SENSE_TYPES.NONE},
    solid: {move: CONST.WALL_MOVEMENT_TYPES.NORMAL, sight: CONST.EDGE_SENSE_TYPES.NORMAL, light: CONST.EDGE_SENSE_TYPES.NORMAL, sound: CONST.EDGE_SENSE_TYPES.NORMAL},
    clear: {move: CONST.WALL_MOVEMENT_TYPES.NORMAL, sight: CONST.EDGE_SENSE_TYPES.NONE, light: CONST.EDGE_SENSE_TYPES.NONE, sound: CONST.EDGE_SENSE_TYPES.NONE}
};
/**
 * The activity that placed this region, read from the system's `activity` flag. The lookup is synchronous, so an
 * activity in an unloaded compendium is not found.
 * @param {foundry.documents.RegionDocument} region        Region to resolve the origin of.
 * @returns {dnd5e.documents.activity.Activity|undefined}  Undefined when the region was not placed by an activity or
 *                                                         the activity no longer exists.
 * @example
 * const activity = regionUtils.getActivity(region);
 * const item = activity?.item;
 */
function getActivity(region) {
    const activityUuid = region.flags.dnd5e?.activity;
    if (activityUuid) return fromUuidSync(activityUuid, {strict: false});
}
/**
 * Regions on a scene placed by this item or activity. Passing an item matches regions placed by any of its activities.
 * @param {Scene} scene                           Scene to search.
 * @param {Item5e|dnd5e.dataModels.activity.BaseActivityData} document
 *                                                Item or activity that placed the regions.
 * @returns {foundry.documents.RegionDocument[]}  Empty when none are found.
 * @example
 * const regions = regionUtils.getPlacedRegions(canvas.scene, item);
 * await documentUtils.deleteEmbeddedDocuments(canvas.scene, 'Region', regions.map(region => region.id));
 */
function getPlacedRegions(scene, document) {
    return scene.regions.filter(region => region.flags.dnd5e?.activity?.startsWith(document.uuid));
}
/**
 * Cast data stamped on this region when it was placed, read from the `cat.castData` flag.
 * @param {foundry.documents.RegionDocument} region  Region to read the flag from.
 * @returns {{castLevel: number, baseLevel: number, saveDC: number}|undefined}
 *                                                   Undefined when nothing was stamped.
 * @example
 * const {castLevel, saveDC} = regionUtils.getCastData(region) ?? {};
 */
function getCastData(region) {
    return region.flags.cat?.castData;
}
/**
 * Whether a ray crosses this region's boundary. A ray that starts and ends inside the region without touching an edge
 * returns false. Elevation and levels are ignored.
 * @param {foundry.documents.RegionDocument} region  Region to test against.
 * @param {object} ray                               Ray with start and end points.
 * @param {Point} ray.A                              Start point in canvas pixels.
 * @param {Point} ray.B                              End point in canvas pixels.
 * @returns {boolean}
 * @example
 * if (regionUtils.rayIntersectsRegion(region, {A: token.object.center, B: target.object.center})) return;
 */
function rayIntersectsRegion(region, ray) {
    return getIntersections(region, ray.A, ray.B, true);
}
/**
 * Whether the line between two tokens passes through this region, including a line that lies wholly inside it. The line
 * runs between the tokens' movement origins and accounts for their elevations. Returns false when the region is on
 * neither token's level.
 * @param {foundry.documents.RegionDocument} region      Region to test against.
 * @param {foundry.documents.TokenDocument} sourceToken  Token the line starts from.
 * @param {foundry.documents.TokenDocument} targetToken  Token the line ends at.
 * @returns {boolean}
 * @example
 * const blocked = canvas.scene.regions.some(region => regionUtils.isObscured(region) && regionUtils.isBetweenTokens(region, token, target));
 */
function isBetweenTokens(region, sourceToken, targetToken) {
    if (!region.includedInLevel(sourceToken._source.level) && !region.includedInLevel(targetToken._source.level)) return false;
    const origin = sourceToken.getMovementOrigin(sourceToken._source);
    const destination = targetToken.getMovementOrigin(targetToken._source);
    return region.segmentizeMovementPath([origin, destination], [{x: 0, y: 0}]).length > 0;
}
/**
 * Every point where the segment AB crosses this region's boundary, tested against each of the region's polygons.
 * Elevation and levels are ignored.
 * @param {foundry.documents.RegionDocument} region  Region to test against.
 * @param {Point} A                                  Start of the segment, in canvas pixels.
 * @param {Point} B                                  End of the segment, in canvas pixels.
 * @param {boolean} [boolOnly]                       Stop at the first crossing and return a boolean instead.
 * @returns {Point[]|boolean}                        Intersection points in canvas pixels, or whether any exists. Empty
 *                                                   when the segment never crosses an edge.
 * @example
 * const points = regionUtils.getIntersections(region, token.object.center, target.object.center);
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
 * Whether the two regions' shapes overlap on the canvas, using {@link intersection}. Elevation and levels are ignored.
 * @param {foundry.documents.RegionDocument} region       Region to check.
 * @param {foundry.documents.RegionDocument} otherRegion  Region to compare against.
 * @returns {boolean}
 * @example
 * const overlapping = canvas.scene.regions.filter(other => other !== region && regionUtils.hasOverlap(region, other));
 */
function hasOverlap(region, otherRegion) {
    return regionShapes.intersection(region, otherRegion)?.length > 0;
}
/**
 * Whether this region is flagged as heavily obscured, read from `cat.visibility.obscured`.
 * @param {foundry.documents.RegionDocument} region  Region to read the flag from.
 * @returns {boolean|undefined}                      Undefined when the region carries no visibility flag.
 * @example
 * const obscured = canvas.scene.regions.filter(region => regionUtils.isObscured(region));
 */
function isObscured(region) {
    return region.flags.cat?.visibility?.obscured;
}
/**
 * Whether this region counts as magical darkness, read from `cat.visibility.magicalDarkness`.
 * @param {foundry.documents.RegionDocument} region  Region to read the flag from.
 * @returns {boolean|undefined}                      Undefined when the region carries no visibility flag.
 * @example
 * if (regionUtils.isMagicalDarkness(region)) return;
 */
function isMagicalDarkness(region) {
    return region.flags.cat?.visibility?.magicalDarkness;
}
/**
 * The point a region shape is positioned from, used to measure how far it has moved. Polygons use their first point,
 * emanations use their base shape and other shapes use their `x` and `y`.
 * @param {object} shape  Region shape data.
 * @returns {Point}       Canvas pixels. `{x: 0, y: 0}` when no shape is given.
 * @example
 * const before = regionUtils.getShapeAnchor(region.shapes[0]);
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
 * Sort the tokens on the region's scene by how this region's movement affected them. Tokens outside both before and
 * after are sampled every quarter grid space along the move, so a region swept over a token lands it in `through`.
 * Tokens without a placeable on the canvas are skipped.
 * @param {foundry.documents.RegionDocument} region  Region in its new position.
 * @param {object} locationData                      Where the region was before it moved.
 * @param {number} locationData.oldX                 Previous anchor x in canvas pixels, from {@link getShapeAnchor}.
 * @param {number} locationData.oldY                 Previous anchor y in canvas pixels, from {@link getShapeAnchor}.
 * @param {number} locationData.oldBottom            Previous bottom elevation in scene units.
 * @param {number} [locationData.oldTop]             Previous top elevation in scene units. Unused: the vertical offset
 *                                                   comes from `oldBottom`.
 * @returns {{entered: Set, exited: Set, through: Set, stayed: Set}}
 *                                                   Token documents grouped by what happened to them. A token the
 *                                                   region never touched is in no set.
 * @example
 * const {entered, exited} = regionUtils.getRegionMovementTokens(region, locationData);
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
 * The circle this region covers. A region reshaped by {@link spreadAroundCorners} returns its original circle. Any
 * other region returns the center of its bounds with half the longer side as the radius.
 * @param {foundry.documents.RegionDocument} region   Region to read.
 * @returns {{x: number, y: number, radius: number}}  Center and radius in canvas pixels.
 * @example
 * const {x, y, radius} = regionUtils.getArea(region);
 * const radiusFt = distanceUtils.toFeet(canvas.scene, radius / canvas.scene.dimensions.distancePixels);
 */
function getArea(region) {
    const spread = region.flags.cat?.spreadAroundCorners;
    if (spread) return spread;
    const {center, width, height} = region.bounds;
    return {x: center.x, y: center.y, radius: Math.max(width, height) / 2};
}
/**
 * Reshape a circular region into polygons that spread around the corners of walls that block movement. Each corner the
 * area reaches starts a new circle with the radius left over. The region's restriction is turned off and the original
 * circle is stored for {@link getArea}. Regions attached to a token, regions that aren't circles and regions off the
 * viewed scene are left alone. When `area` is given for one of those, the region is reset to that circle instead.
 * @param {foundry.documents.RegionDocument} region  Region to reshape.
 * @param {object} [options]                         Additional options.
 * @param {number} [options.depth]                   How many corners the area may turn. Defaults to 2.
 * @param {object} [options.area]                    Circle to spread from instead of the region's own shape, such as
 *                                                   when the area moves.
 * @param {number} options.area.x                    Center x in canvas pixels.
 * @param {number} options.area.y                    Center y in canvas pixels.
 * @param {number} options.area.radius               Radius in canvas pixels.
 * @returns {Promise<void>}
 * @example
 * await regionUtils.spreadAroundCorners(region);
 */
async function spreadAroundCorners(region, {depth = 2, area} = {}) {
    const shape = area ? {type: 'circle', ...area} : region.shapes[0];
    if (region.attachment?.token || shape?.type !== 'circle' || region.parent !== canvas.scene) {
        if (area) await documentUtils.update(region, {shapes: [shape], 'flags.cat.-=spreadAroundCorners': null});
        return;
    }
    const level = region.parent.levels.get(region._source.levels?.[0]);
    const elevation = Number.isFinite(region.elevation.bottom) ? region.elevation.bottom : 0;
    const corners = new Map();
    for (const wall of region.parent.walls) {
        if (wall.move === CONST.WALL_MOVEMENT_TYPES.NONE) continue;
        for (const {x, y} of wallSegment(wall)) {
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
/**
 * Tokens on a scene whose footprint a path's line crosses or lies inside. The footprint is shrunk by 1 px on each side,
 * so a path along a token's edge does not count. Only tokens with an actor and a placeable on the canvas are checked.
 * @param {foundry.documents.Scene} scene        Scene to search.
 * @param {WallPath} path                        Path to test, in canvas pixels.
 * @param {object} [options]                     Additional options.
 * @param {boolean} [options.visibleOnly]        Only tokens the current user can see.
 * @returns {foundry.canvas.placeables.Token[]}  Token placeables, not documents.
 * @example
 * const path = await crosshairUtils.drawPath({token, maxRange: 120});
 * const crossed = regionUtils.tokensOnPath(canvas.scene, path, {visibleOnly: true});
 */
function tokensOnPath(scene, path, {visibleOnly = false} = {}) {
    const pairs = regionShapes.pathSegments(path);
    return (scene.tokens.contents.map(token => token.object).filter(token => token?.actor && (!visibleOnly || token.visible))).filter(token => {
        const {x, y, width, height} = token.bounds;
        const rect = new PIXI.Rectangle(x + 1, y + 1, width - 2, height - 2);
        return pairs.some(([a, b]) => rect.lineSegmentIntersects(a, b, {inside: true}));
    });
}
/**
 * Create a region along a path, with an optional side region, walls and one surface region per flat panel in
 * `path.flats`. The side region and flat panels depend on the path region, and CAT deletes the walls when the path
 * region is deleted. With `height`, both regions span from the path region's bottom elevation up by that height. The
 * path and its settings are stored on the region for {@link reshapePathRegion} and {@link addWallPanels}.
 * @param {foundry.documents.Scene} scene                    Scene to create on.
 * @param {WallPath & {side?: 'left'|'right'|'inside'|'outside'}} path
 *                                                           Result of {@link crosshairUtils.drawPath}.
 * @param {object} options                                   Additional options.
 * @param {number} options.thickness                         Path thickness in feet.
 * @param {number} [options.height]                          Path and side region height in feet.
 * @param {object} [options.regionData]                      Path region data, without shapes.
 * @param {number} [options.sideDepth]                       Side region depth in feet.
 * @param {object} [options.sideData]                        Side region data, without shapes. Omit for no side region.
 *                                                           Also skipped when the path has no `side` or no `points`.
 * @param {'opaque'|'solid'|'clear'|object} [options.walls]  Wall data without coordinates, or a preset. `opaque` blocks
 *                                                           sight, `clear` blocks movement, `solid` blocks both.
 * @param {boolean} [options.push]                           Push creatures out of the path before it is created, with
 *                                                           {@link tokenUtils.slideToken}.
 * @param {number} [options.sectionLength]                   Maximum wall section length in feet.
 * @returns {Promise<{region?: foundry.documents.RegionDocument, side?: foundry.documents.RegionDocument, flats?: foundry.documents.RegionDocument[]}>}
 *                                                           An empty object when the path region could not be created.
 * @example
 * const path = await crosshairUtils.drawPath({token, maxRange: 120, maxLength: 60});
 * if (!path) return;
 * const {region} = await regionUtils.createPathRegions(canvas.scene, path, {thickness: 1, height: 20, regionData: {name: item.name}, walls: 'solid'});
 */
async function createPathRegions(scene, path, {thickness, height, regionData = {}, sideDepth, sideData, walls, push, sectionLength} = {}) {
    const pixels = scene.dimensions.distancePixels;
    if (height) {
        const bottom = regionData.elevation?.bottom ?? 0;
        const elevation = {bottom, top: bottom + distanceUtils.convertDistance(scene, height)};
        regionData = {...regionData, elevation};
        if (sideData) sideData = {...sideData, elevation};
    }
    thickness = distanceUtils.convertDistance(scene, thickness);
    sideDepth = distanceUtils.convertDistance(scene, sideDepth);
    sectionLength = distanceUtils.convertDistance(scene, sectionLength);
    if (push) await pushOffPath(scene, path, thickness);
    if (typeof walls === 'string') walls = wallPresets[walls];
    const flags = foundry.utils.mergeObject(regionData.flags ?? {}, {cat: {path, pathThickness: thickness, pathWalls: walls ?? null, pathSectionLength: sectionLength ?? null}}, {inplace: false});
    const data = [{...regionData, flags, shapes: regionShapes.pathBand(path, thickness * pixels)}];
    if (sideData && path.side && path.points) data.push({...sideData, shapes: regionShapes.sideBand(path.points, path.closed, path.side, sideDepth * pixels, {gap: thickness * pixels})});
    const created = await documentUtils.createEmbeddedDocuments(scene, 'Region', data, {cat: {pathRegion: true}}) ?? [];
    const region = created.find(document => document.flags.cat?.pathThickness !== undefined);
    const side = created.find(document => document !== region);
    if (!region) return {};
    const flats = path.flats?.length ? await documentUtils.createEmbeddedDocuments(scene, 'Region', path.flats.map(flat => ({
        name: regionData.name,
        color: regionData.color,
        elevation: {bottom: flat.elevation, top: flat.elevation},
        shapes: [{type: 'rectangle', x: flat.x, y: flat.y, width: flat.size, height: flat.size}],
        behaviors: [{type: 'defineSurface', name: regionData.name, system: {placement: 'both', move: walls?.move !== CONST.WALL_MOVEMENT_TYPES.NONE, sight: walls?.sight !== CONST.EDGE_SENSE_TYPES.NONE, light: walls?.light !== CONST.EDGE_SENSE_TYPES.NONE, sound: walls?.sound !== CONST.EDGE_SENSE_TYPES.NONE}}],
        flags: {cat: {flatPanel: flat, pathRegion: region.uuid}}
    }))) ?? [] : [];
    await Promise.all([
        side && documentUtils.makeDependent(region, [side]),
        flats.length && documentUtils.makeDependent(region, flats),
        walls && createPathWalls(region, path)
    ]);
    return {region, side, flats};
}
/**
 * Create the walls along a path region, split into its configured section length.
 * @param {foundry.documents.RegionDocument} region  Path region.
 * @param {WallPath} path                            Path to wall.
 * @returns {Promise<foundry.documents.WallDocument[]>}
 */
function createPathWalls(region, path) {
    const {pathWalls, pathSectionLength} = region.flags.cat;
    const pixels = region.parent.dimensions.distancePixels;
    return documentUtils.createEmbeddedDocuments(region.parent, 'Wall', splitSegments(regionShapes.pathSegments(path), pathSectionLength && pathSectionLength * pixels).map(([a, b]) => ({
        ...pathWalls,
        c: [a.x, a.y, b.x, b.y],
        flags: {...pathWalls.flags, cat: {...pathWalls.flags?.cat, pathRegion: region.uuid}}
    })));
}
/**
 * Walls belonging to a path region.
 * @param {foundry.documents.RegionDocument} region  Path region.
 * @returns {foundry.documents.WallDocument[]}
 */
function getPathWalls(region) {
    return region.parent.walls.filter(wall => wall.flags.cat?.pathRegion === region.uuid);
}
/**
 * Flat panel regions belonging to a path region.
 * @param {foundry.documents.RegionDocument} region  Path region.
 * @returns {foundry.documents.RegionDocument[]}
 */
function getFlatPanels(region) {
    return region.parent.regions.filter(other => other.flags.cat?.flatPanel && other.flags.cat.pathRegion === region.uuid);
}
/**
 * A wall's endpoints as points.
 * @param {foundry.documents.WallDocument} wall  Wall to read.
 * @returns {Point[]}
 */
function wallSegment(wall) {
    return [{x: wall.c[0], y: wall.c[1]}, {x: wall.c[2], y: wall.c[3]}];
}
/**
 * Split segments into pieces no longer than the given length.
 * @param {Point[][]} segments  Segments to split.
 * @param {number} [maxLength]  Maximum piece length in pixels; segments are returned unchanged without it.
 * @returns {Point[][]}
 */
function splitSegments(segments, maxLength) {
    if (!maxLength) return segments;
    return segments.flatMap(([a, b]) => {
        const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / maxLength - 0.01));
        return Array.fromRange(count).map(index => [
            {x: a.x + (b.x - a.x) * index / count, y: a.y + (b.y - a.y) * index / count},
            {x: a.x + (b.x - a.x) * (index + 1) / count, y: a.y + (b.y - a.y) * (index + 1) / count}
        ]);
    });
}
/**
 * Move every creature a path cuts through out of the path's area, to whichever side of the nearest segment its center
 * is on.
 * @param {foundry.documents.Scene} scene  Scene the path is on.
 * @param {WallPath} path                  Path to clear.
 * @param {number} thickness               Path thickness in scene units.
 * @returns {Promise<void>}
 */
async function pushOffPath(scene, path, thickness) {
    const pixels = scene.dimensions.distancePixels;
    const segments = regionShapes.pathSegments(path);
    await Promise.all(tokensOnPath(scene, path).map(token => {
        const center = token.center;
        const best = regionShapes.nearestSegment(center, segments);
        const angle = best.distance > 1 ? Math.atan2(center.y - best.closest.y, center.x - best.closest.x) : Math.atan2(best.b.y - best.a.y, best.b.x - best.a.x) - Math.PI / 2;
        const reach = (Math.max(token.w, token.h) / 2 + thickness * pixels / 2 - best.distance) / pixels;
        const step = scene.grid.distance;
        return tokenUtils.slideToken(token.document, {ray: {angle}, distance: distanceUtils.toFeet(scene, Math.ceil(reach / step) * step)});
    }));
}
/**
 * Give each wall segment of a path region a panel token, so the panels can be attacked and destroyed one at a time.
 * Flat panels made by {@link createPathRegions} get one too. Each panel is a summon created with
 * {@link summonUtils.createSummon} and placed at the middle of its segment or flat panel. When a panel actor drops to 0
 * hit points, CAT calls {@link breakWallPanel}.
 * @param {foundry.documents.RegionDocument} region             Path region made by {@link createPathRegions} with
 *                                                              walls.
 * @param {object} options                                      Additional options.
 * @param {Actor5e} options.owner                               Actor the panels belong to, usually the caster.
 * @param {Actor5e} options.sourceActor                         Actor each panel token is copied from.
 * @param {object} [options.updates]                            Merged over each panel actor's data, such as hit points,
 *                                                              armor class and damage traits. A `name` here also
 *                                                              renames the panel tokens.
 * @param {foundry.abstract.Document} [options.parent]          Document the panels depend on, such as a concentration
 *                                                              effect.
 * @param {foundry.abstract.Document} [options.sourceDocument]  Item or activity that made the wall.
 * @returns {Promise<foundry.documents.TokenDocument[]>}        The panel tokens that were placed.
 * @example
 * const panels = await regionUtils.addWallPanels(region, {owner: actor, sourceActor: panelActor, updates: {system: {attributes: {hp: {value: 30, max: 30}}}}, sourceDocument: item});
 */
async function addWallPanels(region, {owner, sourceActor, updates = {}, parent, sourceDocument} = {}) {
    const scene = region.parent;
    const size = sourceActor.prototypeToken.width * scene.grid.size;
    const spawn = async (panel, center, elevation) => {
        const panelUpdates = foundry.utils.mergeObject(updates, {flags: {cat: {wallPanel: {region: region.uuid, ...panel}}}, ...(updates.name ? {prototypeToken: {name: updates.name}} : {})}, {inplace: false});
        const summon = await summonUtils.createSummon(owner, sourceActor, {parent, sourceDocument, updates: panelUpdates});
        return summonUtils.spawnSummon(summon, scene, {x: center.x - size / 2, y: center.y - size / 2}, {elevation});
    };
    const tokens = await Promise.all([
        ...getPathWalls(region).map(wall => {
            const [x1, y1, x2, y2] = wall.c;
            return spawn({wall: wall.id}, {x: (x1 + x2) / 2, y: (y1 + y2) / 2});
        }),
        ...getFlatPanels(region).map(flat => {
            const {x, y, size: flatSize, elevation} = flat.flags.cat.flatPanel;
            return spawn({flat: flat.uuid}, {x: x + flatSize / 2, y: y + flatSize / 2}, elevation);
        })
    ]);
    return tokens.filter(Boolean);
}
/**
 * Remove a destroyed wall panel made by {@link addWallPanels}. The panel summon is deleted along with its wall segment
 * or flat region, and the path region's `panelBroken` pass runs. A broken wall segment also shrinks the path region to
 * the remaining walls. The path region is deleted once no walls or flat panels are left.
 * @param {Actor5e} actor  Panel actor at 0 hit points.
 * @returns {Promise<void>}
 * @example
 * await regionUtils.breakWallPanel(target.actor);
 */
async function breakWallPanel(actor) {
    const panel = actor.flags.cat?.wallPanel;
    const region = fromUuidSync(panel?.region ?? '', {strict: false});
    const summon = summonUtils.getSummonData(actor);
    if (summon) await summonUtils.deleteSummon(summon);
    if (!region) return;
    const scene = region.parent;
    const flat = panel.flat && fromUuidSync(panel.flat, {strict: false});
    if (flat) {
        const flatData = flat.flags.cat.flatPanel;
        await documentUtils.deleteDocument(flat);
        await new Events.RegionEvent([region], constants.regionPasses.panelBroken, {options: {flat: flatData}}).run();
        if (!getPathWalls(region).length && !getFlatPanels(region).length) return documentUtils.deleteDocument(region);
        return;
    }
    const wall = scene.walls.get(panel.wall);
    const segment = wall ? wallSegment(wall) : undefined;
    if (wall) await documentUtils.deleteDocument(wall);
    const remaining = getPathWalls(region).map(wallSegment);
    await new Events.RegionEvent([region], constants.regionPasses.panelBroken, {options: {segment}}).run();
    if (!remaining.length && !getFlatPanels(region).length) return documentUtils.deleteDocument(region);
    const thickness = (region.flags.cat?.pathThickness ?? 1) * scene.dimensions.distancePixels;
    await documentUtils.update(region, {shapes: regionShapes.pathBand({segments: remaining}, thickness)});
}
/**
 * Give a path region made by {@link createPathRegions} a new path. Its shapes follow the new path at the stored
 * thickness, and its walls are deleted and rebuilt along it when it has any. A side region is not reshaped.
 * @param {foundry.documents.RegionDocument} region  Path region to reshape.
 * @param {WallPath} path                            New path, in canvas pixels.
 * @returns {Promise<void>}
 * @example
 * const path = await crosshairUtils.drawPath({token, maxRange: 120});
 * if (path) await regionUtils.reshapePathRegion(region, path);
 */
async function reshapePathRegion(region, path) {
    const {pathThickness = 1, pathWalls} = region.flags.cat ?? {};
    await documentUtils.update(region, {shapes: regionShapes.pathBand(path, pathThickness * region.parent.dimensions.distancePixels), 'flags.cat.path': path});
    if (!pathWalls) return;
    await deletePathWalls(region);
    await createPathWalls(region, path);
}
/**
 * Delete the walls {@link createPathRegions} made for a region. CAT already calls this when a path region is deleted.
 * @param {foundry.documents.RegionDocument} region  Path region.
 * @returns {Promise<void>}
 * @example
 * await regionUtils.deletePathWalls(region);
 */
async function deletePathWalls(region) {
    const ids = getPathWalls(region).map(wall => wall.id);
    if (ids.length) await documentUtils.deleteEmbeddedDocuments(region.parent, 'Wall', ids);
}
/**
 * Remove a region after a number of rounds. A timer effect named after the activity's item is created on the activity's
 * actor, and the region depends on it.
 * @param {dnd5e.documents.activity.Activity} activity  Activity that placed the region.
 * @param {foundry.documents.RegionDocument} region     Region to remove.
 * @param {number} [rounds]                             Rounds before removal, with `targetEnd` expiry. Defaults to the
 *                                                      activity's duration value, or 1 when that isn't a number.
 * @returns {Promise<ActiveEffect|undefined>}           The timer effect. Undefined when it could not be created.
 * @example
 * const [region] = regionUtils.getPlacedRegions(canvas.scene, activity);
 * await regionUtils.addRegionTimer(activity, region, 1);
 */
async function addRegionTimer(activity, region, rounds = Number(activity.duration.value) || 1) {
    const effectData = documentUtils.getBaseEffectData(activity, {
        name: activity.item.name,
        img: activity.item.img,
        origin: activity.uuid,
        duration: {value: rounds, units: 'rounds', expiry: 'targetEnd'}
    });
    const [effect] = await effectUtils.createEffects(activity.actor, [effectData]) ?? [];
    if (effect) await documentUtils.makeDependent(effect, [region]);
    return effect;
}
/**
 * Whether this region is a spell ward, meaning it carries a `cat.spellWard` flag.
 * @param {foundry.documents.RegionDocument} region  Region to check.
 * @returns {boolean}
 * @example
 * const wards = canvas.scene.regions.filter(region => regionUtils.isSpellWard(region));
 */
function isSpellWard(region) {
    return region.flags.cat?.spellWard !== undefined;
}
/**
 * Whether a spell ward region the token stands in blocks a spell. A ward blocks spells of its stored level or lower,
 * and only when the caster's token is outside it. Items that aren't spells return false.
 * @param {TokenDocument} token          Token the spell would affect.
 * @param {Item5e} [item]                Item behind the effect.
 * @param {number} [castLevel]           Level the spell was cast at. Defaults to the spell's own level.
 * @param {TokenDocument} [sourceToken]  The caster's token. Without one the caster counts as outside every ward.
 * @returns {boolean}
 * @example
 * if (regionUtils.isSpellWarded(target, item, castLevel, token)) return;
 */
function isSpellWarded(token, item, castLevel, sourceToken) {
    if (item?.type !== 'spell' || !token?.parent) return false;
    const level = castLevel >= 0 ? castLevel : item.system.level;
    return token.parent.regions.some(region => region.flags.cat?.spellWard >= level && token.testInsideRegion(region) && !sourceToken?.testInsideRegion(region));
}
/**
 * Place a light at the center of the region's area from {@link getArea}. The light depends on the region, so it is
 * deleted with it.
 * @param {foundry.documents.RegionDocument} region  Region the light belongs to.
 * @param {object} [config]                          Light config, with radii in feet. Other keys are passed to the
 *                                                   light's `config` as they are.
 * @param {number} [config.bright]                   Bright radius in feet. Defaults to 0.
 * @param {number} [config.dim]                      Dim radius in feet. Defaults to the region's radius.
 * @returns {Promise<foundry.documents.AmbientLightDocument|undefined>}
 *                                                   Undefined when the light could not be created.
 * @example
 * await regionUtils.createRegionLight(region, {bright: 20, dim: 40, color: '#ffaa00'});
 */
async function createRegionLight(region, {bright, dim, ...config} = {}) {
    const scene = region.parent;
    const {x, y, radius} = getArea(region);
    const [light] = await documentUtils.createEmbeddedDocuments(scene, 'AmbientLight', [{
        x: Math.round(x),
        y: Math.round(y),
        config: {...config, bright: distanceUtils.convertDistance(scene, bright ?? 0), dim: dim === undefined ? Math.max(radius, 0) / scene.dimensions.distancePixels : distanceUtils.convertDistance(scene, dim)}
    }]);
    if (!light) return;
    await documentUtils.makeDependent(region, [light]);
    return light;
}
export default {
    getActivity,
    isSpellWard,
    isSpellWarded,
    getPlacedRegions,
    getCastData,
    rayIntersectsRegion,
    isBetweenTokens,
    getIntersections,
    isObscured,
    isMagicalDarkness,
    getShapeAnchor,
    getRegionMovementTokens,
    getArea,
    spreadAroundCorners,
    pathBand: regionShapes.pathBand,
    pathSegments: regionShapes.pathSegments,
    containsPoint: regionShapes.containsPoint,
    tokensOnPath,
    createPathRegions,
    reshapePathRegion,
    trimPath: regionShapes.trimPath,
    subtractShapes: regionShapes.subtractShapes,
    addWallPanels,
    breakWallPanel,
    deletePathWalls,
    addRegionTimer,
    createRegionLight,
    intersection: regionShapes.intersection,
    hasOverlap
};
