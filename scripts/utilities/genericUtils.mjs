/**
 * Wrappers over `foundry.utils` for macros, plus notifications, delays and small formatters.
 * @module
 */
/**
 * Write a value at a dot path, creating missing objects along the way. Wraps `foundry.utils.setProperty`.
 * @see foundry.utils.setProperty
 * @param {object} object  Object to write into, mutated in place.
 * @param {string} key     Dot path to write at.
 * @param {*} value        Value to write.
 * @returns {boolean}      Whether the value changed.
 * @example
 * genericUtils.setProperty(effectData, 'flags.dae.stackable', 'noneName');
 */
function setProperty(object, key, value) {
    return foundry.utils.setProperty(object, key, value);
}
/**
 * Read the value at a dot path. Wraps `foundry.utils.getProperty`.
 * @see foundry.utils.getProperty
 * @param {object} object  Object to read from.
 * @param {string} key     Dot path to read.
 * @returns {*}            Undefined when any part of the path is missing.
 * @example
 * genericUtils.getProperty(actor, 'system.attributes.hp.value');
 */
function getProperty(object, key) {
    return foundry.utils.getProperty(object, key);
}
/**
 * Copy an object through JSON. Functions, Sets, Maps and class instances do not survive. Wraps
 * `foundry.utils.duplicate`.
 * @see foundry.utils.duplicate
 * @param {object} object  Object to copy.
 * @returns {object}       Plain JSON copy.
 */
function duplicate(object) {
    return foundry.utils.duplicate(object);
}
/**
 * Deep copy an object, keeping Dates, Sets and Maps intact. Wraps `foundry.utils.deepClone`.
 * @see foundry.utils.deepClone
 * @param {object} object  Object to clone.
 * @returns {object}       The clone.
 * @example
 * const effectData = genericUtils.deepClone(effect.toObject());
 */
function deepClone(object) {
    return foundry.utils.deepClone(object);
}
/**
 * Merge one object into another. The original is mutated unless `options.inplace` is false. Wraps
 * `foundry.utils.mergeObject`.
 * @see foundry.utils.mergeObject
 * @param {object} original   Object merged into.
 * @param {object} other      Object merged from. Its values win.
 * @param {object} [options]  Foundry's merge options, such as `inplace` and `applyOperators`.
 * @returns {object}          The merged object.
 * @example
 * const itemData = genericUtils.mergeObject(item.toObject(), {name: 'Flame Blade'}, {inplace: false});
 */
function mergeObject(original, other, options = {}) {
    return foundry.utils.mergeObject(original, other, options);
}
/**
 * Whether a value is empty: undefined, null, or an array, Set, Map or object with no entries. Strings and numbers are
 * never empty, so `''` and `0` return false. Wraps `foundry.utils.isEmpty`.
 * @see foundry.utils.isEmpty
 * @param {*} value  Value to test.
 * @returns {boolean}
 * @example
 * if (genericUtils.isEmpty(updates)) return;
 */
function isEmpty(value) {
    return foundry.utils.isEmpty(value);
}
/**
 * Turn an object with dot path keys into nested objects. Wraps `foundry.utils.expandObject`.
 * @see foundry.utils.expandObject
 * @param {object} obj  Flattened object.
 * @returns {object}    Nested object.
 * @example
 * genericUtils.expandObject({'system.uses.spent': 1}); // {system: {uses: {spent: 1}}}
 */
function expandObject(obj) {
    return foundry.utils.expandObject(obj);
}
/**
 * Wait for a number of milliseconds.
 * @param {number} ms  Milliseconds to wait.
 * @returns {Promise<void>}
 * @example
 * await genericUtils.sleep(500);
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Format a challenge rating below 1 as a fraction. Values of 1 or more come back as numbers, and `0` or an empty value
 * returns `0`.
 * @param {number|string} decimal  Challenge rating.
 * @returns {number|string}        A string such as `'1/4'` below 1, otherwise a number.
 * @example
 * genericUtils.decimalToFraction(0.25); // '1/4'
 * genericUtils.decimalToFraction(3); // 3
 */
function decimalToFraction(decimal) {
    if (!decimal) return 0;
    if (Number(decimal) >= 1) return Number(decimal);
    return '1/' + 1 / Number(decimal);
}
/**
 * Show a UI notification. The message is a localization key unless `localize` is false.
 * @param {string} message                        Localization key or plain text.
 * @param {object} [options]                      Additional options.
 * @param {'info'|'warn'|'error'} [options.type]  Notification severity. Defaults to `info`.
 * @param {boolean} [options.localize]            Treat the message as a localization key. Defaults to true.
 * @param {object} [options.format]               Interpolation data for the localized string.
 * @param {boolean} [options.progress]            Show a progress bar, updated through the returned notification.
 * @param {boolean} [options.permanent]           Keep the notification until it is dismissed.
 * @returns {object}                              The notification from `ui.notifications`.
 * @example
 * genericUtils.notify('CAT.Error.MissingCostActivity', {type: 'warn'});
 * genericUtils.notify(item.name + ' has no uses left.', {localize: false});
 */
function notify(message, {type = 'info', localize = true, format, progress = false, permanent = false} = {}) {
    return ui.notifications[type](message, {localize, format, progress, permanent});
}
/**
 * Whether one version string is newer than another. Wraps `foundry.utils.isNewerVersion`.
 * @see foundry.utils.isNewerVersion
 * @param {string} v1  Version to test.
 * @param {string} v0  Version to test against.
 * @returns {boolean}  Whether `v1` is newer than `v0`.
 * @example
 * genericUtils.isNewerVersion(game.system.version, '5.0.0');
 */
function isNewerVersion(v1, v0) {
    return foundry.utils.isNewerVersion(v1, v0);
}
/**
 * Today's local date as `YYYYMMDD`, for export filenames.
 * @returns {string}
 * @example
 * const filename = 'cat-export-' + genericUtils.dateStamp() + '.json';
 */
function dateStamp() {
    return new Date().toDateInputString().replaceAll('-', '');
}
export default {
    dateStamp,
    setProperty,
    getProperty,
    duplicate,
    deepClone,
    mergeObject,
    sleep,
    decimalToFraction,
    isEmpty,
    expandObject,
    notify,
    isNewerVersion
};