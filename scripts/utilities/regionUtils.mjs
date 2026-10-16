import {documentUtils, effectUtils, summonUtils, tokenUtils} from './_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import regionShapes from '../lib/regionShapes.mjs';
const wallPresets = {
    opaque: {move: CONST.WALL_MOVEMENT_TYPES.NONE, sight: CONST.EDGE_SENSE_TYPES.NORMAL, light: CONST.EDGE_SENSE_TYPES.NORMAL, sound: CONST.EDGE_SENSE_TYPES.NONE},
    solid: {move: CONST.WALL_MOVEMENT_TYPES.NORMAL, sight: CONST.EDGE_SENSE_TYPES.NORMAL, light: CONST.EDGE_SENSE_TYPES.NORMAL, sound: CONST.EDGE_SENSE_TYPES.NORMAL},
    clear: {move: CONST.WALL_MOVEMENT_TYPES.NORMAL, sight: CONST.EDGE_SENSE_TYPES.NONE, light: CONST.EDGE_SENSE_TYPES.NONE, sound: CONST.EDGE_SENSE_TYPES.NONE}
};
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
 * Regions on the scene placed by this item or activity, oldest first.
 * @param {Scene} scene Scene to search.
 * @param {Item5e|dnd5e.dataModels.activity.BaseActivityData} document Item or activity that placed the regions.
 * @returns {foundry.documents.RegionDocument[]}
 */
function getPlacedRegions(scene, document) {
    return scene.regions.filter(region => region.flags.dnd5e?.activity?.startsWith(document.uuid));
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
 * @param {{x: number, y: number, radius: number}} [options.area] Circle to spread from instead of the region's own shape, such as when the area moves.
 * @returns {Promise<void>}
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
 * Tokens on a scene whose footprint a path crosses or touches.
 * @param {foundry.documents.Scene} scene Scene to search.
 * @param {WallPath} path Path to test.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.visibleOnly] Only tokens the current user can see.
 * @returns {foundry.canvas.placeables.Token[]}
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
 * Create a region along a drawn path, an optional region over one side of it, and optional Wall documents along it.
 * The side region depends on the path region; the walls are deleted with the path region.
 * @param {foundry.documents.Scene} scene Scene to create on.
 * @param {WallPath & {side?: 'left'|'right'|'inside'|'outside'}} path Result of `crosshairUtils.drawPath`.
 * @param {object} options Additional options.
 * @param {number} options.thickness Path region thickness in scene units.
 * @param {object} [options.regionData] Region data for the path region, without shapes.
 * @param {number} [options.sideDepth] Side region depth in scene units.
 * @param {object} [options.sideData] Region data for the side region, without shapes. Omit for no side region.
 * @param {'opaque'|'solid'|'clear'|object} [options.walls] Wall data for each wall segment, without coordinates, or a preset: `opaque` blocks sight but not movement, `solid` blocks both, `clear` blocks movement only. Omit for no walls.
 * @param {boolean} [options.push] Push creatures the path cuts through out of its area, to whichever side their centre is on.
 * @param {number} [options.sectionLength] Split the Wall documents into sections no longer than this many scene units, such as walls with hit points per 10-foot section.
 * @returns {Promise<{region?: foundry.documents.RegionDocument, side?: foundry.documents.RegionDocument, flats?: foundry.documents.RegionDocument[]}>} Flat panels of the path each get their own region, a surface at the panel's height that depends on the path region.
 */
async function createPathRegions(scene, path, {thickness, regionData = {}, sideDepth, sideData, walls, push, sectionLength} = {}) {
    const pixels = scene.dimensions.distancePixels;
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
function createPathWalls(region, path) {
    const {pathWalls, pathSectionLength} = region.flags.cat;
    const pixels = region.parent.dimensions.distancePixels;
    return documentUtils.createEmbeddedDocuments(region.parent, 'Wall', splitSegments(regionShapes.pathSegments(path), pathSectionLength && pathSectionLength * pixels).map(([a, b]) => ({
        ...pathWalls,
        c: [a.x, a.y, b.x, b.y],
        flags: {...pathWalls.flags, cat: {...pathWalls.flags?.cat, pathRegion: region.uuid}}
    })));
}
function getPathWalls(region) {
    return region.parent.walls.filter(wall => wall.flags.cat?.pathRegion === region.uuid);
}
function getFlatPanels(region) {
    return region.parent.regions.filter(other => other.flags.cat?.flatPanel && other.flags.cat.pathRegion === region.uuid);
}
function wallSegment(wall) {
    return [{x: wall.c[0], y: wall.c[1]}, {x: wall.c[2], y: wall.c[3]}];
}
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
 * Move every creature a path cuts through out of the path's area, to whichever side of the nearest segment its centre is on.
 * @param {foundry.documents.Scene} scene Scene the path is on.
 * @param {WallPath} path Path to clear.
 * @param {number} thickness Path thickness in scene units.
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
        return tokenUtils.slideToken(token.document, {ray: {angle}, distance: Math.ceil(reach / step) * step});
    }));
}
/**
 * Give each wall segment of a path region a panel token, so the panels can be attacked and destroyed one at a time.
 * Flat panels made by {@link createPathRegions} get one too. When a panel token drops to 0 hit points, its wall segment or flat region is removed, the region shrinks to the remaining panels and the region's `panelBroken` pass runs.
 * @param {foundry.documents.RegionDocument} region Path region made by {@link createPathRegions} with walls.
 * @param {object} options Additional options.
 * @param {Actor5e} options.owner Actor the panels belong to, usually the caster.
 * @param {Actor5e} options.sourceActor Actor each panel token is copied from.
 * @param {object} [options.updates] Merged over each panel actor's data, such as hit points, armor class and damage traits.
 * @param {foundry.abstract.Document} [options.parent] Document the panels depend on, such as a concentration effect.
 * @param {foundry.abstract.Document} [options.sourceDocument] Item or activity that made the wall.
 * @returns {Promise<foundry.documents.TokenDocument[]>}
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
 * Remove a destroyed wall panel: its wall segment or flat region and its token go, the region shrinks to the remaining panels and its `panelBroken` pass runs.
 * @param {Actor5e} actor Panel actor at 0 hit points.
 * @returns {Promise<void>}
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
        return new Events.RegionEvent([region], constants.regionPasses.panelBroken, {options: {flat: flatData}}).run();
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
 * Give a path region made by {@link createPathRegions} a new path: its shapes follow the new path and its Wall documents are rebuilt along it.
 * @param {foundry.documents.RegionDocument} region Path region to reshape.
 * @param {WallPath} path New path.
 * @returns {Promise<void>}
 */
async function reshapePathRegion(region, path) {
    const {pathThickness = 1, pathWalls} = region.flags.cat ?? {};
    await documentUtils.update(region, {shapes: regionShapes.pathBand(path, pathThickness * region.parent.dimensions.distancePixels), 'flags.cat.path': path});
    if (!pathWalls) return;
    await deletePathWalls(region);
    await createPathWalls(region, path);
}
/**
 * Delete the Wall documents {@link createPathRegions} made for a region.
 * @param {foundry.documents.RegionDocument} region Path region being deleted.
 * @returns {Promise<void>}
 */
async function deletePathWalls(region) {
    const ids = getPathWalls(region).map(wall => wall.id);
    if (ids.length) await documentUtils.deleteEmbeddedDocuments(region.parent, 'Wall', ids);
}
/**
 * Remove a region after a number of rounds, by tying it to a timer effect on the activity's actor.
 * @param {dnd5e.documents.activity.Activity} activity Activity that placed the region; names the timer and owns it.
 * @param {foundry.documents.RegionDocument} region Region to remove.
 * @param {number} [rounds] Rounds before removal, ending at the end of the actor's turn. Defaults to the activity's duration.
 * @returns {Promise<ActiveEffect|undefined>} The timer effect.
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
export default {
    getActivity,
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
    addRegionTimer
};