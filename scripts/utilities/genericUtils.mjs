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
function isEmpty(value) {
    return foundry.utils.isEmpty(value);
}
function expandObject(obj) {
    return foundry.utils.expandObject(obj);
}
function convertDistance(scene, distanceFt) {
    switch(scene.grid.units) {
        case 'm': return Math.floor((distanceFt / 5) * 1.5);
        default: return distanceFt;
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function decimalToFraction(decimal) {
    if (!decimal) return 0;
    if (Number(decimal) >= 1) return Number(decimal);
    return '1/' + 1 / Number(decimal);
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
    expandObject
};