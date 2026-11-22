/**
 * Distance conversion and measurement. CAT stores and compares every distance in feet; these helpers move between feet,
 * the scene's grid units, grid spaces and canvas pixels.
 * @module
 */
/**
 * Convert feet to the scene's grid units. The result is not snapped to grid spaces. Units the system does not
 * recognize, such as `squares`, are treated as feet, and `0` or a missing value comes back unchanged.
 * @param {foundry.documents.Scene} scene  Scene with the target units.
 * @param {number} distanceFt              Distance in feet.
 * @returns {number}                       Distance in scene units.
 * @example
 * distanceUtils.convertDistance(canvas.scene, 30); // 30 on a feet scene, 9 on a meters scene
 */
function convertDistance(scene, distanceFt) {
    if (!distanceFt) return distanceFt;
    return dnd5e.utils.convertLength(distanceFt, 'ft', {to: scene.grid.units || 'ft', legacy: false}).value;
}
/**
 * Convert a distance in the scene's grid units back to feet. Inverse of {@link convertDistance}.
 * @param {foundry.documents.Scene} scene  Scene with the source units.
 * @param {number} distance                Distance in scene units.
 * @returns {number}                       Distance in feet.
 * @example
 * // A ruler measurement of 9 on a meters scene
 * distanceUtils.toFeet(canvas.scene, 9); // 30
 */
function toFeet(scene, distance) {
    if (!distance) return distance;
    return dnd5e.utils.convertLength(distance, scene.grid.units || 'ft', {to: 'ft', legacy: false}).value;
}
/**
 * Convert a range in feet to scene units, rounded to the nearest whole grid space and never less than one space.
 * Gridless scenes skip the rounding.
 * @param {foundry.documents.Scene} scene  Scene with the grid.
 * @param {number} rangeFt                 Range in feet.
 * @returns {number}                       Range in scene units.
 * @example
 * // On a 5 ft grid
 * distanceUtils.toRangeUnits(canvas.scene, 7); // 5
 * distanceUtils.toRangeUnits(canvas.scene, 2); // 5
 * distanceUtils.toRangeUnits(canvas.scene, 12); // 10
 */
function toRangeUnits(scene, rangeFt) {
    const distance = convertDistance(scene, rangeFt);
    if (!distance || scene.grid.isGridless) return distance;
    return Math.max(1, Math.round(distance / scene.grid.distance)) * scene.grid.distance;
}
/**
 * Whether a measured distance falls within a range. The range is rounded to whole grid spaces first with
 * {@link toRangeUnits}, so a 7 ft range on a 5 ft grid reaches 5 ft. Accepts the range as a string, as stored on items.
 * @param {foundry.documents.Scene} scene  Scene with the grid.
 * @param {number} distanceFt              Measured distance in feet.
 * @param {number|string} rangeFt          Range in feet.
 * @returns {boolean}
 * @example
 * const distance = tokenUtils.getDistance(token, target);
 * if (!distanceUtils.isWithinRange(token.parent, distance, 30)) return;
 */
function isWithinRange(scene, distanceFt, rangeFt) {
    return convertDistance(scene, distanceFt) <= toRangeUnits(scene, Number(rangeFt)) + scene.grid.distance / 100;
}
/**
 * Label a distance in feet with the scene's units, for display. Units the system does not recognize are printed as they
 * are.
 * @param {foundry.documents.Scene} scene  Scene with the units.
 * @param {number} distanceFt              Distance in feet.
 * @returns {string}
 * @example
 * distanceUtils.formatDistance(canvas.scene, 30); // '30 ft' on a feet scene, '9 m' on a meters scene
 */
function formatDistance(scene, distanceFt) {
    const units = scene.grid.units;
    const distance = convertDistance(scene, distanceFt);
    if (!(units in CONFIG.DND5E.movementUnits)) return dnd5e.utils.formatNumber(distance, {maximumFractionDigits: 2}) + ' ' + units;
    return dnd5e.utils.formatLength(distance, units);
}
/**
 * Convert a distance stored on a document, such as an item's range or an activity's template size, to feet. Returns
 * undefined for `0`, empty values and units that aren't lengths, such as `touch` or `self`.
 * @param {number|string} value  Stored distance.
 * @param {string} units         Stored units.
 * @returns {number|undefined}   Distance in feet.
 * @example
 * const {value, units} = item.system.range;
 * distanceUtils.lengthToFeet(value, units); // 30 for '9' and 'm', undefined for 'touch'
 */
function lengthToFeet(value, units) {
    if (!value || !(units in CONFIG.DND5E.movementUnits)) return;
    return dnd5e.utils.convertLength(Number(value), units, {to: 'ft', legacy: false}).value;
}
/**
 * Convert feet to canvas pixels, without snapping to the grid. Useful for drawing shapes or measuring against token
 * centers.
 * @param {foundry.documents.Scene} scene  Scene with the grid.
 * @param {number} distanceFt              Distance in feet.
 * @returns {number}                       Distance in pixels.
 * @example
 * // 5 ft grid at 115 px per space
 * distanceUtils.toPixels(canvas.scene, 30); // 690
 */
function toPixels(scene, distanceFt) {
    return convertDistance(scene, distanceFt) * scene.dimensions.distancePixels;
}
/**
 * Convert feet to grid spaces. The result is not rounded, so it can be fractional.
 * @param {foundry.documents.Scene} scene  Scene with the grid.
 * @param {number} distanceFt              Distance in feet.
 * @returns {number}                       Number of grid spaces.
 * @example
 * // On a 5 ft grid
 * distanceUtils.toGridSpaces(canvas.scene, 30); // 6
 * distanceUtils.toGridSpaces(canvas.scene, 7); // 1.4
 */
function toGridSpaces(scene, distanceFt) {
    return convertDistance(scene, distanceFt) / scene.grid.distance;
}
/**
 * Convert grid spaces to feet. Inverse of {@link toGridSpaces}.
 * @param {foundry.documents.Scene} scene  Scene with the grid.
 * @param {number} spaces                  Number of grid spaces.
 * @returns {number}                       Distance in feet.
 * @example
 * // On a 5 ft grid
 * distanceUtils.fromGridSpaces(canvas.scene, 6); // 30
 */
function fromGridSpaces(scene, spaces) {
    return toFeet(scene, spaces * scene.grid.distance);
}
/**
 * Measure a path through canvas points in feet, following the scene's diagonal rule from the core Grid Diagonals
 * setting.
 * @param {foundry.documents.Scene} scene  Scene with the grid.
 * @param {Point[]} waypoints              Points along the path, in canvas pixels.
 * @returns {number}                       Path length in feet.
 * @example
 * // Three spaces diagonally on a 5 ft grid with equidistant diagonals
 * const size = canvas.scene.dimensions.size;
 * distanceUtils.measureDistance(canvas.scene, [{x: 0, y: 0}, {x: size * 3, y: size * 3}]); // 15
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
