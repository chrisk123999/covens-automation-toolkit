import {genericUtils} from './_module.mjs';
function getSavedCastData(token) {
    return token.flags.cat?.castData;
}
function getDistance(token, target, {wallsBlock, checkCover, convertToFt = true} = {}) {
    const distance =  MidiQOL.computeDistance(token.object, target.object, {wallsBlock, includeCover: checkCover});
    return convertToFt ? genericUtils.convertDistance(token.parent, distance) : distance;
}
function checkCover(sourceToken, targetToken, {activity, displayName}) {
    // TODO replace the following with MidiQOL.getCoverBonus when that becomes available
    const statusCover = targetToken.actor.statuses.has('coverTotal') ? 999 : (targetToken.actor.system.attributes.ac.cover ?? 0);
    const moduleCover = MidiQOL.computeCoverBonus(sourceToken, targetToken.object, activity);
    const cover = Math.max(moduleCover, statusCover);
    if (!displayName) return cover;
    const names = {
        0: 'DND5E.COMMON.No',
        2: 'DND5E.Cover.Half',
        5: 'DND5E.CoverThreeQuarters',
        999: 'DND5E.CoverTotal'
    };
    return _loc('CAT.Common.Cover', {amount: _loc(names[cover]), cover: _loc('DND5E.Cover')});
}
export default {
    getSavedCastData,
    getDistance,
    checkCover
};