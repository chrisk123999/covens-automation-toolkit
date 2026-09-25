/**
 * Foundry's setProperty, wrapped so macros need not reach into foundry.utils.
 * @see foundry.utils.setProperty
 * @param {object} object Object to write into.
 * @param {string} key Dot path to write at.
 * @param {*} value Value to write.
 * @returns {boolean} Whether the value changed.
 */
function setProperty(object, key, value) {
    return foundry.utils.setProperty(object, key, value);
}
/**
 * Foundry's getProperty, wrapped so macros need not reach into foundry.utils.
 * @see foundry.utils.getProperty
 * @param {object} object Object to read from.
 * @param {string} key Dot path to read.
 * @returns {*}
 */
function getProperty(object, key) {
    return foundry.utils.getProperty(object, key);
}
/**
 * Foundry's duplicate, wrapped so macros need not reach into foundry.utils.
 * @see foundry.utils.duplicate
 * @param {object} object Object to copy through JSON.
 * @returns {object}
 */
function duplicate(object) {
    return foundry.utils.duplicate(object);
}
/**
 * Foundry's deepClone, wrapped so macros need not reach into foundry.utils.
 * @see foundry.utils.deepClone
 * @param {object} object Object to clone, preserving types JSON would lose.
 * @returns {object}
 */
function deepClone(object) {
    return foundry.utils.deepClone(object);
}
/**
 * Foundry's mergeObject, wrapped so macros need not reach into foundry.utils.
 * @see foundry.utils.mergeObject
 * @param {object} original Object merged into, and mutated unless told otherwise.
 * @param {object} other Object merged from.
 * @param {object} [options] Foundry's merge options, such as inplace and applyOperators.
 * @returns {object}
 */
function mergeObject(original, other, options = {}) {
    return foundry.utils.mergeObject(original, other, options);
}
/**
 * Foundry's isEmpty, wrapped so macros need not reach into foundry.utils.
 * @see foundry.utils.isEmpty
 * @param {*} value Value to test for emptiness.
 * @returns {boolean}
 */
function isEmpty(value) {
    return foundry.utils.isEmpty(value);
}
/**
 * Foundry's expandObject, wrapped so macros need not reach into foundry.utils.
 * @see foundry.utils.expandObject
 * @param {object} obj Flattened object whose dot paths become nested objects.
 * @returns {object}
 */
function expandObject(obj) {
    return foundry.utils.expandObject(obj);
}
/**
 * Convert a distance in feet to the scene's grid units.
 * @param {foundry.documents.Scene} scene Scene whose grid units are converted to.
 * @param {number} distanceFt Distance in feet.
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
 * @param {number} ms Milliseconds to wait.
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Render a decimal below one as a unit fraction, for challenge ratings.
 * @param {number|string} decimal Value to render, such as 0.25 for a challenge rating.
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
 * @param {object} [options] Additional options.
 * @param {'info'|'warn'|'error'} [options.type] Notification severity.
 * @param {boolean} [options.localize] Treat the message as a localization key.
 * @param {object} [options.format] Interpolation data for the localized string.
 * @param {boolean} [options.progress] Track progress, updated through the returned handle.
 * @returns {object|undefined} The notification, when tracking progress.
 */
function notify(message, {type = 'info', localize = true, format, progress = false} = {}) {
    return ui.notifications[type](message, {localize, format, progress});
}
/**
 * Foundry's isNewerVersion, wrapped so macros need not reach into foundry.utils.
 * @see foundry.utils.isNewerVersion
 * @param {string} v1 Version to test.
 * @param {string} v0 Version to test against.
 * @returns {boolean} Whether v1 is newer than v0.
 */
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