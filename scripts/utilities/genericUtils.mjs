/** @see foundry.utils.setProperty */
function setProperty(object, key, value) {
    return foundry.utils.setProperty(object, key, value);
}
/** @see foundry.utils.getProperty */
function getProperty(object, key) {
    return foundry.utils.getProperty(object, key);
}
/** @see foundry.utils.duplicate */
function duplicate(object) {
    return foundry.utils.duplicate(object);
}
/** @see foundry.utils.deepClone */
function deepClone(object) {
    return foundry.utils.deepClone(object);
}
/** @see foundry.utils.mergeObject */
function mergeObject(original, other, options = {}) {
    return foundry.utils.mergeObject(original, other, options);
}
/** @see foundry.utils.isEmpty */
function isEmpty(value) {
    return foundry.utils.isEmpty(value);
}
/** @see foundry.utils.expandObject */
function expandObject(obj) {
    return foundry.utils.expandObject(obj);
}
/**
 * Convert a distance in feet to the scene's grid units.
 * @param {foundry.documents.Scene} scene
 * @param {number} distanceFt
 * @returns {number}
 */
function convertDistance(scene, distanceFt) {
    switch(scene.grid.units) {
        case 'm': return Math.floor((distanceFt / 5) * 1.5);
        default: return distanceFt;
    }
}
/**
 * Resolve after a delay.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Render a decimal below one as a unit fraction, for challenge ratings.
 * @param {number|string} decimal
 * @returns {number|string}
 */
function decimalToFraction(decimal) {
    if (!decimal) return 0;
    if (Number(decimal) >= 1) return Number(decimal);
    return '1/' + 1 / Number(decimal);
}
/**
 * Show a UI notification, localizing the message by default.
 * @param {string} message A localization key, unless localize is false.
 * @param {object} [options]
 * @param {'info'|'warn'|'error'} [options.type]
 * @param {boolean} [options.localize]
 * @param {object} [options.format] Interpolation data for the localized string.
 */
function notify(message, {type = 'info', localize = true, format} = {}) {
    ui.notifications[type](message, {localize, format});
}
/** @see foundry.utils.isNewerVersion */
function isNewerVersion(v1, v0) {
    return foundry.utils.isNewerVersion(v1, v0);
}
export default {
    setProperty,
    getProperty,
    duplicate,
    deepClone,
    mergeObject,
    convertDistance,
    sleep,
    decimalToFraction,
    isEmpty,
    expandObject,
    notify,
    isNewerVersion
};