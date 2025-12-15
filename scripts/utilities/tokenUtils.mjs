function getSavedCastData(token) {
    return token.flags.cat?.castData;
}
function getDistance(token, target, {wallsBlock, checkCover} = {}) {
    return MidiQOL.computeDistance(token.object, target.object, {wallsBlock, includeCover: checkCover});
}
export const tokenUtils = {
    getSavedCastData,
    getDistance
};