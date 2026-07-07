import {dataUtils, queryUtils} from './_module.mjs';
function getCastData(effect) {
    return effect.flags.cat?.castData ?? effect.flags['midi-qol']?.castData;
}
async function createEffects(document, effectDatas, {forceGM = false, macros, effectOptions, createAnimation, deleteAnimation, createAnimationOptions = {}, deleteAnimationOptions = {}, vae, unhideActivities} = {}) {
    const data = effectDatas.map(e => {
        const targetIdentifier = e.flags?.cat?.identifier ?? e.name?.slugify();
        let thisMacros = [];
        if (targetIdentifier && macros?.length) {
            macros.forEach(macroGroup => {
                const applicableMacros = macroGroup.macros.filter(m => !m.effectIdentifier || m.effectIdentifier === targetIdentifier).map(({effectIdentifier, ...rest}) => rest);
                if (!applicableMacros.length) return;
                thisMacros.push({type: macroGroup.type, macros: applicableMacros});
            });
        }
        return dataUtils.buildEffectData(e, {macros: thisMacros, createAnimation, deleteAnimation, createAnimationOptions, deleteAnimationOptions, vae, unhideActivities});
    });
    const hasPermission = queryUtils.hasPermission(document, game.user.id);
    let effects;
    if (hasPermission && !forceGM) {
        effects = await document.createEmbeddedDocuments('ActiveEffect', data);
    } else {
        const uuids = await queryUtils.query('createEffects', queryUtils.gmUser(), {uuid: document.uuid, effectDatas: data, effectOptions});
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
    effect.system.changes.forEach(element => {
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
function getOriginActivitySync(effect) {
    const activityUuid = effect.flags.dae?.activity ?? effect.flags.cat?.activityUuid;
    if (activityUuid) return fromUuidSync(activityUuid, {strict: false});
    if (!effect.origin) return;
    const origin = fromUuidSync(effect.origin, {strict: false});
    if (origin.documentName !== 'ActiveEffect') return;
    const originActivityUuid = origin.flags.dnd5e?.activity?.uuid;
    if (originActivityUuid) return fromUuidSync(originActivityUuid, {strict: false});
    if (origin.parent?.documentName === 'Item') {
        return origin.parent.system.activities?.find(activity => 
            activity.effects.some(aEffect => aEffect.id === effect.id)
        );
    }
}
function getConcentrationEffect(actor, item) {
    return MidiQOL.getConcentrationEffect(actor, item);
}
function getActor(effect) {
    if (!effect.parent) return;
    if (effect.parent instanceof Actor) return effect.parent;
    if (effect.parent instanceof Item) return effect.parent.actor;
}
export default {
    getCastData,
    createEffects,
    getConditions,
    getOriginActivity,
    getOriginActivitySync,
    getConcentrationEffect,
    getActor
};
