function getCastData(region) {
    return region.flags.cat?.castData ?? region.flags['midi-qol']?.castData;
}
function rayIntersectsRegion(region, ray) {
    return getIntersections(region, ray.A, ray.B, true);
}
function getIntersections(region, A, B, boolOnly = false) {
    const totalIntersections = [];
    region.polygons.forEach(shape => {
        if (boolOnly && totalIntersections.length) return;
        if (shape.segmentIntersections) {
            let intersections = shape.segmentIntersections(A, B);
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
export const regionUtils = {
    getCastData,
    rayIntersectsRegion,
    getIntersections
};