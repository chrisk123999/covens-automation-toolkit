function getCastData(region) {
    return region.flags.cat?.castData;
}
function rayIntersectsRegion(region, ray) {
    return getIntersections(region, ray.A, ray.B, true);
}
function getIntersections(region, A, B, boolOnly = false) {
    const totalIntersections = [];
    region.polygons.forEach(shape => {
        if (boolOnly && totalIntersections.length) return;
        if (shape.segmentIntersections) {
            const intersections = shape.segmentIntersections(A, B);
            totalIntersections.push(... intersections);
        } else {
            const intersections = [];
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
            totalIntersections.push(...intersections);
        }
    });
    if (boolOnly) return totalIntersections.length ? true : false;
    return totalIntersections;
}
function isObscured(region) {
    return region.flags.cat?.visibility?.obscured;
}
function isMagicalDarkness(region) {
    return region.flags.cat?.visibility?.magicalDarkness;
}
function getShapeAnchor(shape) {
    if (!shape) return {x: 0, y: 0};
    if (shape.type === 'polygon' || shape.points) {
        return {x: shape.points[0] ?? 0, y: shape.points[1] ?? 0};
    }
    return {x: shape.x ?? 0, y: shape.y ?? 0};
}
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
export default {
    getCastData,
    rayIntersectsRegion,
    getIntersections,
    isObscured,
    isMagicalDarkness,
    getShapeAnchor,
    getRegionMovementTokens
};