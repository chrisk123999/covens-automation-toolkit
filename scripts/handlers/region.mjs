import {activityUtils, actorUtils, documentUtils, genericUtils} from '../utilities/_module.mjs';
import {Logging} from '../lib/_module.mjs';
function placed(region) {
    const originUuid = region.flags.dnd5e?.origin;
    if (!originUuid) return;
    const activity = fromUuidSync(originUuid, {strict: false});
    if (!activity) return;
    const sourceUpdates = {
        flags: {
            cat: {
                castData: {
                    castLevel: region.flags.dnd5e.spellLevel,
                    baseLevel: activity.item.system.level,
                    saveDC: activityUtils.getSaveDC(activity)
                }
            }
        }
    };
    const regionMacros = activity.flags.cat?.placed?.region?.macros;
    if (regionMacros) sourceUpdates.flags.cat.macros = regionMacros;
    const embeddedMacros = activity.flags.cat?.placed?.region?.embeddedMacros;
    if (embeddedMacros) sourceUpdates.flags.cat.embeddedMacros = embeddedMacros;
    const visibility = activity.flags.cat?.placed?.region?.visibility;
    if (visibility) sourceUpdates.flags.cat.visibility = visibility;
    const effects = activity.flags.cat?.placed?.region?.effects;
    if (effects) sourceUpdates.flags.cat.effects = effects;
    region.updateSource(sourceUpdates);
}
async function updateRegionEffects(token, currentRegions) {
    const groupedRegions = (currentRegions || []).reduce((acc, region) => {
        const identifier = documentUtils.getIdentifier(region);
        const castData = documentUtils.getSavedCastData(region) || {castLevel: 0, baseLevel: 0, saveDC: 0};
        if (!acc[identifier]) acc[identifier] = [];
        acc[identifier].push({region, castData});
        return acc;
    }, {});
    const winningRegionsInfo = Object.values(groupedRegions).map(group => {
        if (group.length === 1) return group[0];
        const maxLevel = Math.max(...group.map(i => i.castData.castLevel));
        const maxDC = Math.max(...group.map(i => i.castData.saveDC));
        const maxDCGroup = group.find(i => i.castData.saveDC === maxDC);
        if (maxDCGroup.castData.castLevel === maxLevel) {
            return maxDCGroup;
        } else {
            return group.find(i => i.castData.castLevel === maxLevel);
        }
    });
    const desiredEffects = (await Promise.all(
        winningRegionsInfo.map(async info => {
            const {region, castData} = info;
            const identifier = documentUtils.getIdentifier(region);
            const effectUuids = region.flags.cat?.effects;
            if (!Array.isArray(effectUuids)) return [];
            const resolvedEffects = await Promise.all(
                effectUuids.map(async uuid => {
                    const sourceEffect = await fromUuid(uuid);
                    if (!sourceEffect) return;
                    const effectData = sourceEffect.toObject();
                    delete effectData._id;
                    effectData.origin = uuid;
                    genericUtils.setProperty(effectData, 'flags.cat.regionIdentifier', identifier);
                    genericUtils.setProperty(effectData, 'flags.cat.castData', castData);
                    return effectData;
                })
            );
            return resolvedEffects.filter(Boolean);
        })
    )).flat();
    const existingEffects = actorUtils.getEffects(token.actor).filter(i => i.flags.cat?.regionIdentifier);
    const effectsToCreate = [];
    const effectsToUpdate = [];
    const effectIdsToDelete = [];
    const matchedExistingIds = new Set();
    for (const desired of desiredEffects) {
        const identifier = desired.flags.cat.regionIdentifier;
        const existing = existingEffects.find(i => i.flags.cat?.regionIdentifier === identifier && !matchedExistingIds.has(i.id));
        if (existing) {
            matchedExistingIds.add(existing.id);
            const existingCastData = existing.flags.cat?.castData || {};
            const desiredCastData = desired.flags.cat.castData;
            const needsUpdate = 
                existing.origin !== desired.origin ||
                existingCastData.castLevel !== desiredCastData.castLevel ||
                existingCastData.saveDC !== desiredCastData.saveDC;
            if (needsUpdate) {
                effectsToUpdate.push(Object.assign({}, desired, {_id: existing.id}));
            }
        } else {
            effectsToCreate.push(desired);
        }
    }
    for (const existing of existingEffects) {
        if (!matchedExistingIds.has(existing.id)) effectIdsToDelete.push(existing.id);
    }
    if (effectIdsToDelete.length) {
        await documentUtils.deleteEmbeddedDocuments(token.actor, 'ActiveEffect', effectIdsToDelete);
        Logging.addEntry('DEBUG', 'Deleting region effects for ' + token.name);
    }
    if (effectsToUpdate.length) {
        await documentUtils.updateEmbeddedDocuments(token.actor, 'ActiveEffect', effectsToUpdate);
        Logging.addEntry('DEBUG', 'Updating region effects for ' + token.name);
    }
    if (effectsToCreate.length) {
        await documentUtils.createEmbeddedDocuments(token.actor, 'ActiveEffect', effectsToCreate);
        Logging.addEntry('DEBUG', 'Creating region effects for ' + token.name);
    }
}
async function regionEffects(region, isDelete = false) {
    const identifier = documentUtils.getIdentifier(region);
    const affectedTokens = region.tokens;
    region.parent.tokens.filter(token => {
        const effects = actorUtils.getEffects(token.actor);
        return effects.some(effect => effect.flags.cat?.regionIdentifier === identifier);
    }).forEach(token => affectedTokens.add(token));
    await Promise.all(affectedTokens.map(async token => {
        let currentRegions = token.regions;
        if (isDelete) currentRegions = currentRegions.filter(r => r.id !== region.id);
        return await updateRegionEffects(token, Array.from(currentRegions));
    }));
}
export default {
    placed,
    updateRegionEffects,
    regionEffects
};