import {activityUtils, actorUtils, documentUtils, genericUtils, regionUtils, tokenUtils, workflowUtils, combatUtils} from '../utilities/_module.mjs';
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
    const activities = activity.flags.cat?.placed?.region?.activities;
    if (activities) {
        const activitiesData = activities.map(data => ({uuid: activity.item.system.activities.get(data.id)?.uuid, triggers: data.triggers, disposition: data.disposition, oncePerTurn: data.oncePerTurn})).filter(i => i.uuid);
        if (activitiesData.length) sourceUpdates.flags.cat.activities = activitiesData;
    }
    region.updateSource(sourceUpdates);
}
async function updateRegionEffects(token, currentRegions = []) {
    const groupedRegions = getGroupedRegions(currentRegions);
    const winningRegionsInfo = Object.values(groupedRegions).map(getWinningRegionData);
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
function getGroupedRegions(regions) {
    const regionArray = Array.isArray(regions) ? regions : Array.from(regions);
    return regionArray.reduce((acc, region) => {
        const identifier = documentUtils.getIdentifier(region);
        const castData = documentUtils.getSavedCastData(region);
        if (!acc[identifier]) acc[identifier] = [];
        acc[identifier].push({region, castData});
        return acc;
    }, {});
}
function getWinningRegionData(group) {
    if (!group?.length) return;
    if (group.length === 1) return group[0];
    const maxLevel = Math.max(...group.map(i => i.castData.castLevel));
    const maxDC = Math.max(...group.map(i => i.castData.saveDC));
    const maxDCGroup = group.filter(i => i.castData.saveDC === maxDC);
    return maxDCGroup.find(i => i.castData.castLevel === maxLevel) || group.find(i => i.castData.castLevel === maxLevel);
}
function isValidDispositionTarget(sourceActivity, token, targetDisposition) {
    if (!targetDisposition || targetDisposition === 'all') return true;
    if (!sourceActivity?.actor) return false;
    const actor = sourceActivity.actor;
    const creatorToken = actorUtils.getFirstToken(actor);
    const creatorDisposition = creatorToken?.disposition ?? actor.prototypeToken?.disposition;
    const isEnemy = tokenUtils.isEnemy(creatorToken, token, {dispositionA: creatorDisposition});
    if (targetDisposition === 'ally' && isEnemy) return false;
    if (targetDisposition === 'enemy' && !isEnemy) return false;
    return true;
}
async function processRegionActivities(token, currentRegions, triggerType, {combatData} = {}) {
    Logging.addEntry('DEBUG', 'Processing region activities for pass ' + triggerType + ' for ' + token.name);
    if (!currentRegions.length) return;
    const groupedRegions = getGroupedRegions(currentRegions);
    if (!Object.keys(groupedRegions).length) return;
    const winningRegions = Object.values(groupedRegions).map(group => getWinningRegionData(group).region);
    combatData ??= tokenUtils.getCombatData(token);
    const regionsToUpdate = [];
    for (const region of winningRegions) {
        const activitiesConfig = region.flags.cat?.activities;
        if (!activitiesConfig?.length) continue;
        const matchedActivities = activitiesConfig.filter(act => act.triggers?.includes(triggerType));
        if (!matchedActivities.length) continue;
        const processedTokens = region.flags.cat?.processedTokens || [];
        let requiresStampUpdate = false;
        for (const actConfig of matchedActivities) {
            const sourceActivity = await fromUuid(actConfig.uuid);
            if (!isValidDispositionTarget(sourceActivity, token, actConfig.disposition)) continue;
            const isOncePerTurn = actConfig.oncePerTurn; 
            if (isOncePerTurn && combatData.inCombat) {
                if (combatUtils.isStampedThisTurn(processedTokens, token.id, combatData)) continue;
                requiresStampUpdate = true;
            }
            await workflowUtils.completeActivityUse(sourceActivity, [token], {atLevel: regionUtils.getCastData(region).castLevel});
        }
        if (requiresStampUpdate && combatData.inCombat) {
            const newProcessedArray = combatUtils.addTurnStamp(processedTokens, token.id, combatData);
            regionsToUpdate.push({
                _id: region.id,
                'flags.cat.processedTokens': newProcessedArray
            });
        }
    }
    if (regionsToUpdate.length) await documentUtils.updateEmbeddedDocuments(token.parent, 'Region', regionsToUpdate);
}
async function processMovedRegionActivities(region, tokens, triggerType) {
    Logging.addEntry('DEBUG', 'Processing region activities for pass ' + triggerType + ' for ' + region.name);
    if (!tokens.size) return;
    const activitiesConfig = region.flags.cat?.activities;
    if (!activitiesConfig?.length) return;
    const matchedActivities = activitiesConfig.filter(act => act.triggers?.includes(triggerType));
    if (!matchedActivities.length) return;
    const identifier = documentUtils.getIdentifier(region);
    const movingCastData = documentUtils.getSavedCastData(region);
    let processedTokens = region.flags.cat?.processedTokens ?? [];
    let requiresStampUpdate = false;
    for (const token of tokens) {
        const combatData = tokenUtils.getCombatData(token);
        const overlappingRegions = new Set(token.regions);
        overlappingRegions.add(region);
        const groupedOverlap = getGroupedRegions(overlappingRegions);
        const identicalGroup = groupedOverlap[identifier] ?? [];
        const winningRegionData = getWinningRegionData(identicalGroup);
        if (winningRegionData?.region.id !== region.id) continue;
        let alreadyProcessed = false;
        if (combatData.inCombat) {
            identicalGroup.forEach(info => {
                const identicalRegion = info.region;
                const stamps = identicalRegion.id === region.id ? processedTokens : (identicalRegion.flags.cat?.processedTokens || []);
                if (combatUtils.isStampedThisTurn(stamps, token.id, combatData)) alreadyProcessed = true;
            });
        }
        if (alreadyProcessed) continue;
        let tokenGotStamped = false;
        for (const actConfig of matchedActivities) {
            const sourceActivity = await fromUuid(actConfig.uuid);
            if (!isValidDispositionTarget(sourceActivity, token, actConfig.disposition)) continue;
            const isOncePerTurn = actConfig.oncePerTurn;
            if (isOncePerTurn && combatData.inCombat) tokenGotStamped = true;
            await workflowUtils.completeActivityUse(sourceActivity, [token], {atLevel: movingCastData.castLevel});
        }
        if (tokenGotStamped) {
            processedTokens = combatUtils.addTurnStamp(processedTokens, token.id, combatData);
            requiresStampUpdate = true;
        }
    }
    if (requiresStampUpdate) await region.update({'flags.cat.processedTokens': processedTokens});
}
export default {
    placed,
    updateRegionEffects,
    regionEffects,
    processRegionActivities,
    processMovedRegionActivities
};