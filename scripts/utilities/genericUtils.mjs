function setProperty(object, key, value) {
    return foundry.utils.setProperty(object, key, value);
}
function getProperty(object, key) {
    return foundry.utils.getProperty(object, key);
}
function duplicate(object) {
    return foundry.utils.duplicate(object);
}
function deepClone(object) {
    return foundry.utils.deepClone(object);
}
function mergeObject(original, other, options = {}) {
    return foundry.utils.mergeObject(original, other, options);
}
export const genericUtils = {
    setProperty,
    getProperty,
    duplicate,
    deepClone,
    mergeObject
};