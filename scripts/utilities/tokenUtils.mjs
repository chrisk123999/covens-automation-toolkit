import {genericUtils} from './_module.mjs';
function getSavedCastData(token) {
    return token.flags.cat?.castData;
}
function getDistance(token, target, {wallsBlock, checkCover, convertToFt = true} = {}) {
    const distance =  MidiQOL.computeDistance(token.object, target.object, {wallsBlock, includeCover: checkCover});
    return convertToFt ? genericUtils.convertDistance(token.parent, distance) : distance;
}
export default {
    getSavedCastData,
    getDistance
};