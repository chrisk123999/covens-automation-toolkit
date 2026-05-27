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
async function updateRegionEffects(token, currentRegions = []) {
    const groupedRegions = currentRegions.reduce((acc, region) => {
        const identifier = documentUtils.getIdentifier(region);
        const castData = documentUtils.getSavedCastData(region);
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
                    effectData.showIcon = 2;
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
async function processRegionActivities(token, currentRegions, triggerType) {
    if (!currentRegions.length) return;
    const groupedRegions = currentRegions.reduce((acc, region) => {
        const activities = region.flags.cat?.activities;
        if (!activities?.length) return acc;
        const identifier = documentUtils.getIdentifier(region);
        const castData = documentUtils.getSavedCastData(region);
        if (!acc[identifier]) acc[identifier] = [];
        acc[identifier].push({region, castData});
        return acc;
    }, {});
    if (!Object.keys(groupedRegions).length) return;
    const winningRegions = Object.values(groupedRegions).map(group => {
        if (group.length === 1) return group[0].region;
        const maxLevel = Math.max(...group.map(i => i.castData.castLevel));
        const maxDC = Math.max(...group.map(i => i.castData.saveDC));
        const maxDCGroup = group.find(i => i.castData.saveDC === maxDC);
        if (maxDCGroup.castData.castLevel === maxLevel) {
            return maxDCGroup.region;
        } else {
            return group.find(g => g.castData.castLevel === maxLevel).region;
        }
    });
    const combat = token.combatant?.combat;
    const inCombat = !!combat;
    const currentRound = inCombat ? combat.round : null;
    const currentTurn = inCombat ? combat.turn : null;
    const regionsToUpdate = [];
    await Promise.all(winningRegions.map(async region => {
        const activitiesConfig = region.flags.cat.activities;
        const matchedActivities = activitiesConfig.filter(act => act.triggers?.includes(triggerType));
        if (!matchedActivities.length) return;
        const processedTokens = region.flags?.cat?.processedTokens || [];
        let requiresStampUpdate = false;
        for (const actConfig of matchedActivities) {
            const isOncePerTurn = actConfig.oncePerTurn !== false; 
            if (isOncePerTurn && inCombat) {
                const existingRecord = processedTokens.find(pt => pt.id === token.id);
                if (existingRecord && existingRecord.round === currentRound && existingRecord.turn === currentTurn) continue; 
                requiresStampUpdate = true;
            }
            const sourceActivity = await fromUuid(actConfig.uuid);
            if (!sourceActivity) continue;
            //await myRollUtils.executeActivity(sourceActivity, token);
        }
        if (requiresStampUpdate && inCombat) {
            const newProcessedArray = processedTokens.filter(pt => pt.id !== token.id);
            newProcessedArray.push({
                id: token.id,
                round: currentRound,
                turn: currentTurn
            });
            regionsToUpdate.push({
                _id: region.id,
                'flags.cat.processedTokens': newProcessedArray
            });
        }
    }));
    if (regionsToUpdate.length) await documentUtils.updateEmbeddedDocuments(token.parent, 'Region', regionsToUpdate);
}
export default {
    placed,
    updateRegionEffects,
    regionEffects,
    processRegionActivities
};