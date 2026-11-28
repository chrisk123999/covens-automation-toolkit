import {constants} from '../lib/_module.mjs';
const playingSounds = new Map();
function started(data) {
    if (data.name === constants.soundName && !game.settings.get('cat', 'soundEffects')) data.volume = 0;
    playingSounds.set(data.file, (playingSounds.get(data.file) ?? 0) + 1);
}
function ended(data) {
    const count = (playingSounds.get(data.file) ?? 1) - 1;
    if (count > 0) playingSounds.set(data.file, count);
    else playingSounds.delete(data.file);
}
function preCreate(data) {
    if (playingSounds.has(data.file)) return false;
}
export default {
    started,
    ended,
    preCreate
};
