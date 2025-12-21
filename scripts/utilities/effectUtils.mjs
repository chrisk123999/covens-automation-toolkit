import {queryUtils} from '../utils.mjs';
function getCastData(effect) {
    return effect.flags.cat?.castData ?? effect.flags['midi-qol']?.castData;
}
async function createEffects(document, effectDatas, effectOptions, {forceGM = false} = {}) {
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    let effects;
    if (hasPermission && !forceGM) {
        effects = await document.createEmbeddedDocuments('ActiveEffect', effectDatas);
    } else {
        const uuids = await queryUtils.query('cat.createEffects', queryUtils.gmUser(), {uuid: document.uuid, effectDatas, effectOptions});
        if (!uuids) return;
        effects = (await Promise.all(uuids.map(async uuid => fromUuid(uuid)))).filter(i => i);
    }
    return effects;
}
export const effectUtils = {
    getCastData,
    createEffects
};