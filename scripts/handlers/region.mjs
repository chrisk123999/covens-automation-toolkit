import {activityUtils, actorUtils, dataUtils, documentUtils, effectUtils, genericUtils, regionUtils, tokenUtils, workflowUtils, combatUtils} from '../utilities/_module.mjs';
import {Auras, constants, Logging} from '../lib/_module.mjs';
import aura from './aura.mjs';
function placed(region) {
    const activity = regionUtils.getActivity(region);
    if (!activity) return;
    const sourceUpdates = {
        flags: {
            cat: {
                castData: {
                    castLevel: region.flags.dnd5e.spellLevel,
                    baseLevel: activity.item.system.level,
                    saveDC: activityUtils.getSaveDC(activity),
                    school: activity.item.system.school
                }
            }
        }
    };
    const config = activity.flags.cat?.placed?.region ?? {};
    for (const key of ['macros', 'embeddedMacros', 'visibility', 'effects', 'effectDisposition', 'filter']) {
        if (config[key]) sourceUpdates.flags.cat[key] = config[key];
    }
    if (config.coreVisibility !== undefined) sourceUpdates.visibility = config.coreVisibility;
    else if (region.visibility === CONST.REGION_VISIBILITY.ALWAYS && game.settings.get('cat', 'placedRegionVisibility') === 'layer') sourceUpdates.visibility = CONST.REGION_VISIBILITY.LAYER;
    if (config.attachToCaster) {
        const casterToken = activity.actor?.token ?? activity.actor?.getActiveTokens(false, true).find(token => token.parent === region.parent);
        if (casterToken?.parent === region.parent) sourceUpdates.attachment = {token: casterToken.id};
    }
    const activities = config.activities;
    if (activities) {
        const activitiesData = activities.map(data => ({uuid: activity.item.system.activities.get(data.id)?.uuid, triggers: data.triggers, disposition: data.disposition, oncePerTurn: data.oncePerTurn, perDistance: data.perDistance, dependentEffects: data.dependentEffects})).filter(i => i.uuid);
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
            const effectIds = region.flags.cat?.effects;
            if (!effectIds?.length) return [];
            const activity = regionUtils.getActivity(region);
            if (!activity) return [];
            if (!regionTargetTest(region, activity, region.flags.cat?.effectDisposition)(token)) return [];
            const item = activity.item;
            const resolvedEffects = effectIds.map(id => {
                const sourceEffect = item.effects.get(id);
                if (!sourceEffect) return;
                const effectData = sourceEffect.toObject();
                delete effectData._id;
                dataUtils.setOrigin(effectData, activity);
                effectData.showIcon = 2;
                genericUtils.setProperty(effectData, 'flags.cat.regionIdentifier', identifier);
                genericUtils.setProperty(effectData, 'flags.cat.castData', castData);
                return effectData;
            });
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
    const heldDependents = new Set(Array.from(currentRegions).flatMap(region => getDependentActivityUuids(region)));
    actorUtils.getEffects(token.actor).forEach(effect => {
        const dependentUuid = effect.flags.cat?.regionDependent;
        if (dependentUuid && !heldDependents.has(dependentUuid)) effectIdsToDelete.push(effect.id);
    });
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
    const dependentUuids = new Set(getDependentActivityUuids(region));
    const inside = new Set(isDelete ? [] : region.parent.tokens.filter(token => token.testInsideRegion(region)));
    const affectedTokens = region.parent.tokens.filter(token => token.actor && (inside.has(token) || region.tokens.has(token) || actorUtils.getEffects(token.actor).some(effect => effect.flags.cat?.regionIdentifier === identifier || dependentUuids.has(effect.flags.cat?.regionDependent))));
    await Promise.all(affectedTokens.map(async token => {
        const currentRegions = Array.from(token.regions).filter(r => r.id !== region.id);
        if (inside.has(token)) currentRegions.push(region);
        return await updateRegionEffects(token, currentRegions);
    }));
}
function getDependentActivityUuids(region) {
    return (region.flags.cat?.activities ?? []).filter(i => i.dependentEffects).map(i => i.uuid);
}
function hasDependentEffect(token, activityUuid) {
    return !!token.actor && actorUtils.getEffects(token.actor).some(effect => effect.flags.cat?.regionDependent === activityUuid);
}
async function runRegionActivity(sourceActivity, targets, castLevel, {times = 1, dependentEffects = false} = {}) {
    const existingIds = new Map(dependentEffects ? targets.filter(token => token.actor).map(token => [token, new Set(actorUtils.getEffects(token.actor).map(effect => effect.id))]) : []);
    for (let i = 0; i < times; i++) await workflowUtils.completeActivityUse(sourceActivity, targets, {atLevel: castLevel});
    if (!dependentEffects) return;
    const itemUuid = sourceActivity.item.uuid;
    await Promise.all(Array.from(existingIds.entries()).map(async ([token, ids]) => {
        const updates = actorUtils.getEffects(token.actor).filter(effect => !ids.has(effect.id) && (effectUtils.getOriginActivitySync(effect)?.item?.uuid === itemUuid || effect.origin?.startsWith(itemUuid))).map(effect => ({_id: effect.id, 'flags.cat.regionDependent': sourceActivity.uuid}));
        if (updates.length) await documentUtils.updateEmbeddedDocuments(token.actor, 'ActiveEffect', updates);
    }));
}
function getMovedDistance(token, region, waypoints = []) {
    const grid = token.parent.grid;
    if (grid.isGridless) return token.segmentizeRegionMovementPath(region, waypoints).filter(segment => segment.type === CONST.REGION_MOVEMENT_SEGMENTS.MOVE).reduce((total, segment) => total + grid.measurePath([segment.from, segment.to]).distance, 0);
    let cells = 0;
    for (let i = 1; i < waypoints.length; i++) {
        const from = waypoints[i - 1];
        const to = waypoints[i];
        const path = grid.getDirectPath([token.getMovementOrigin(from), token.getMovementOrigin(to)]);
        const start = grid.getCenterPoint(path[0]);
        cells += path.slice(1).filter(offset => {
            const center = grid.getCenterPoint(offset);
            return token.testInsideRegion(region, {...to, x: from.x + center.x - start.x, y: from.y + center.y - start.y});
        }).length;
    }
    return cells * grid.distance;
}
function getPlacedRegions(workflow) {
    return (workflow.templateUuids ?? []).map(uuid => fromUuidSync(uuid, {strict: false})).filter(region => region?.flags.cat);
}
async function finishPlacedRegions(placedRegions) {
    for (const region of placedRegions) {
        await regionEffects(region);
        await processMovedRegionActivities(region, new Set(region.parent.tokens.filter(token => token.testInsideRegion(region))), constants.regionPasses.created);
    }
}
async function stampCastTargets(workflow, placedRegions) {
    placedRegions = placedRegions.filter(region => region.flags.cat.activities?.some(i => i.oncePerTurn));
    if (!placedRegions.length || !workflow.hitTargets?.size) return;
    const tokens = Array.from(workflow.hitTargets).map(token => token.document ?? token);
    await Promise.all(placedRegions.map(async region => {
        const currentStamps = region.flags.cat.processedTokens ?? [];
        const processedTokens = tokens.reduce((stamps, token) => combatUtils.addTurnStamp(stamps, token.id, tokenUtils.getCombatData(token)), currentStamps);
        if (processedTokens === currentStamps) return;
        await documentUtils.updateEmbeddedDocuments(region.parent, 'Region', [{_id: region.id, 'flags.cat.processedTokens': processedTokens}]);
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
const filterCaches = new WeakMap();
function regionTargetTest(region, sourceActivity, disposition) {
    const filter = aura.getFilter(region.flags.cat?.filter);
    if (!filter) return token => isValidDispositionTarget(sourceActivity, token, disposition);
    const source = sourceActivity?.actor;
    if (!filterCaches.has(region)) filterCaches.set(region, {});
    const scope = {source, sourceToken: source ? actorUtils.getFirstToken(source) : undefined, region, descriptor: {id: documentUtils.getIdentifier(sourceActivity?.item ?? region)}};
    return token => !!source && !!token.actor && isValidDispositionTarget(sourceActivity, token, disposition)
        && Auras.runFilter(filter, region, {...scope, target: token.actor, targetToken: token}, filterCaches.get(region), 'Region ' + region.name);
}
async function processRegionActivities(token, currentRegions, triggerType, {combatData, waypoints} = {}) {
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
        let movedDistance;
        for (const actConfig of matchedActivities) {
            const sourceActivity = await fromUuid(actConfig.uuid);
            if (!regionTargetTest(region, sourceActivity, actConfig.disposition)(token)) continue;
            let times = 1;
            if (triggerType === constants.movementPasses.moved) {
                movedDistance ??= getMovedDistance(token, region, waypoints);
                times = actConfig.perDistance ? Math.floor(movedDistance / actConfig.perDistance) : Number(movedDistance > 0);
                if (!times) continue;
            }
            if (actConfig.dependentEffects && hasDependentEffect(token, actConfig.uuid)) continue;
            const isOncePerTurn = actConfig.oncePerTurn;
            if (isOncePerTurn && combatData.inCombat) {
                if (combatUtils.isStampedThisTurn(processedTokens, token.id, combatData)) continue;
                requiresStampUpdate = true;
            }
            await runRegionActivity(sourceActivity, [token], regionUtils.getCastData(region).castLevel, {times, dependentEffects: actConfig.dependentEffects});
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
    const entries = await Promise.all(matchedActivities.map(async config => {
        const activity = await fromUuid(config.uuid);
        return {config, activity, test: regionTargetTest(region, activity, config.disposition), tokens: []};
    }));
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
        for (const {config, test, tokens: batch} of entries) {
            if (!test(token)) continue;
            if (config.dependentEffects && hasDependentEffect(token, config.uuid)) continue;
            if (config.oncePerTurn && combatData.inCombat) tokenGotStamped = true;
            batch.push(token);
        }
        if (tokenGotStamped) {
            processedTokens = combatUtils.addTurnStamp(processedTokens, token.id, combatData);
            requiresStampUpdate = true;
        }
    }
    if (requiresStampUpdate) await region.update({'flags.cat.processedTokens': processedTokens});
    for (const {config, activity, tokens: batch} of entries) {
        if (batch.length) await runRegionActivity(activity, batch, movingCastData.castLevel, {dependentEffects: config.dependentEffects});
    }
}
export default {
    placed,
    updateRegionEffects,
    regionEffects,
    processRegionActivities,
    processMovedRegionActivities,
    stampCastTargets,
    finishPlacedRegions,
    getPlacedRegions
};