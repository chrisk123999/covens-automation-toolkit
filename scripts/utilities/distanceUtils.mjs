/**
 * Convert feet to scene units without rounding to the grid. Unrecognized values are passed through as feet.
 * @param {foundry.documents.Scene} scene Scene with the target units.
 * @param {number} distanceFt Distance in feet.
 * @returns {number}
 */
function convertDistance(scene, distanceFt) {
    if (!distanceFt) return distanceFt;
    return dnd5e.utils.convertLength(distanceFt, 'ft', scene.grid.units, {strict: false});
}
/**
 * Inverse of {@link convertDistance}.
 * @param {foundry.documents.Scene} scene Scene with the source units.
 * @param {number} distance Distance in scene units.
 * @returns {number}
 */
function toFeet(scene, distance) {
    if (!distance) return distance;
    return dnd5e.utils.convertLength(distance, scene.grid.units, 'ft', {strict: false});
}
/**
 * Convert a range to scene units, snapped to whole grid spaces with a minimum of one.
 * @param {foundry.documents.Scene} scene Scene with the grid.
 * @param {number} rangeFt Range in feet.
 * @returns {number} Range in scene units.
 */
function toRangeUnits(scene, rangeFt) {
    const distance = convertDistance(scene, rangeFt);
    if (!distance || scene.grid.isGridless) return distance;
    return Math.max(1, Math.round(distance / scene.grid.distance)) * scene.grid.distance;
}
/**
 * Whether a distance is within a range snapped by {@link toRangeUnits}.
 * @param {foundry.documents.Scene} scene Scene with the grid.
 * @param {number} distanceFt Measured distance in feet.
 * @param {number|string} rangeFt Range in feet.
 * @returns {boolean}
 */
function isWithinRange(scene, distanceFt, rangeFt) {
    return convertDistance(scene, distanceFt) <= toRangeUnits(scene, Number(rangeFt)) + scene.grid.distance / 100;
}
/**
 * Label feet in scene units.
 * @param {foundry.documents.Scene} scene Scene with the units.
 * @param {number} distanceFt Distance in feet.
 * @returns {string}
 */
function formatDistance(scene, distanceFt) {
    const units = scene.grid.units;
    const distance = convertDistance(scene, distanceFt);
    if (!(units in CONFIG.DND5E.movementUnits)) return dnd5e.utils.formatNumber(distance, {maximumFractionDigits: 2}) + ' ' + units;
    return dnd5e.utils.formatLength(distance, units);
}
/**
 * Convert a document's distance to feet.
 * @param {number|string} value Stored distance.
 * @param {string} units Stored units.
 * @returns {number|undefined} Undefined for zero, empty values and non-length units.
 */
function lengthToFeet(value, units) {
    if (!value || !(units in CONFIG.DND5E.movementUnits)) return;
    return dnd5e.utils.convertLength(Number(value), units, 'ft');
}
/**
 * Convert feet to canvas pixels without snapping to the grid.
 * @param {foundry.documents.Scene} scene Scene with the grid.
 * @param {number} distanceFt Distance in feet.
 * @returns {number}
 */
function toPixels(scene, distanceFt) {
    return convertDistance(scene, distanceFt) * scene.dimensions.distancePixels;
}
/**
 * Convert feet to grid spaces, which can be fractional.
 * @param {foundry.documents.Scene} scene Scene with the grid.
 * @param {number} distanceFt Distance in feet.
 * @returns {number}
 */
function toGridSpaces(scene, distanceFt) {
    return convertDistance(scene, distanceFt) / scene.grid.distance;
}
/**
 * Inverse of {@link toGridSpaces}.
 * @param {foundry.documents.Scene} scene Scene with the grid.
 * @param {number} spaces Number of grid spaces.
 * @returns {number}
 */
function fromGridSpaces(scene, spaces) {
    return toFeet(scene, spaces * scene.grid.distance);
}
/**
 * Measure a path in feet using the grid's diagonal rule.
 * @param {foundry.documents.Scene} scene Scene with the grid.
 * @param {object[]} waypoints Canvas points in pixels.
 * @returns {number}
 */
function measureDistance(scene, waypoints) {
    return toFeet(scene, scene.grid.measurePath(waypoints).distance);
}
export default {
    convertDistance,
    toFeet,
    toRangeUnits,
    isWithinRange,
    formatDistance,
    lengthToFeet,
    toPixels,
    toGridSpaces,
    fromGridSpaces,
    measureDistance
};
