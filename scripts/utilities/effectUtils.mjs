import {queryUtils} from './_module.mjs';
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
function getConditions(effect) {
    let conditions = new Set();
    const validKeys = [
        'macro.CE',
        'macro.CUB',
        'macro.StatusEffect',
        'StatusEffect'
    ];
    effect.changes.forEach(element => {
        if (validKeys.includes(element.key)) conditions.add(element.value.toLowerCase());
    });
    const effectConditions = effect.flags.cat?.conditions;
    if (effectConditions) effectConditions.forEach(c => conditions.add(c.toLowerCase()));
    conditions = conditions.union(effect.statuses ?? new Set());
    return conditions;
}
async function getOriginActivity(effect) {
    const activityUuid = effect.flags.dae?.activity ?? effect.flags.cat?.activityUuid;
    if (activityUuid) return await fromUuid(activityUuid);
    if (!effect.origin) return;
    const origin = await fromUuid(effect.origin);
    if (origin.documentName !== 'ActiveEffect') return;
    const originActivityUuid = origin.flags.dnd5e?.activity?.uuid;
    if (originActivityUuid) return await fromUuid(originActivityUuid);
    if (origin.parent?.documentName === 'Item') {
        return origin.parent.system.activities?.find(activity => 
            activity.effects.some(aEffect => aEffect.id === effect.id)
        );
    }
}
export default {
    getCastData,
    createEffects,
    getConditions,
    getOriginActivity
};