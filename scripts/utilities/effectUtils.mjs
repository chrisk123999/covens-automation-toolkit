import {queryUtils} from '../utils.mjs';
function getCastData(effect) {
    return effect.flags.cat?.castData ?? effect.flags['midi-qol']?.castData;
}
async function createEffects(document, effectDatas, effectOptions) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    let effects;
    if (hasPermission) {
        effects = await document.createEmbeddedDocuments('ActiveEffect', effectDatas);
    } else {
        // Do this.
    }
    return effects;
}
export const effectUtils = {
    getCastData,
    createEffects
};