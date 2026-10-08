import {actorUtils, documentUtils, effectUtils, genericUtils, itemUtils, queryUtils, rollUtils, tokenUtils, workflowUtils} from '../utilities/_module.mjs';
import {constants, Events, Logging} from './_module.mjs';
const state = {
    ready: false,
    scenes: new Map(),
    canvasScene: null,
    dirty: new Map(),
    reconcile: false,
    diffs: new Map(),
    stamps: new Map(),
    writes: Promise.resolve(),
    queue: Promise.resolve(),
    loggedErrors: new Set()
};
const scheduleFlush = foundry.utils.debounce(() => enqueueWrite(flush), 50);
function logOnce(key, message) {
    if (state.loggedErrors.has(key)) return;
    state.loggedErrors.add(key);
    Logging.addEntry('ERROR', message, {force: true});
}
function isAuraEffect(effect) {
    return !!effect.flags.cat?.aura;
}
function getRollDocument(document) {
    return document.documentName === 'ActiveEffect' ? document.parent : document;
}
function getDescriptorMacros(document) {
    return (document.flags?.cat?.macros?.aura ?? []).map(entry => constants.macros.getFnMacros(entry.source, entry.rules, entry.identifier, 'aura', 'descriptor')).filter(Boolean);
}
function getDescriptors(document) {
    return getDescriptorMacros(document).flatMap(fnMacro => fnMacro.macros.flatMap(({macro}) => {
        try {
            return macro({document}) ?? [];
        } catch (error) {
            logOnce(document.uuid + '.' + fnMacro.identifier + '.descriptor', 'Aura descriptor ' + fnMacro.identifier + ' on ' + document.uuid + ' threw: ' + error.message);
            return [];
        }
    })).filter(descriptor => descriptor?.id);
}
function getActorDescriptors(actor) {
    const hosts = [];
    actor.items.forEach(item => {
        hosts.push(item);
        item.system.activities?.contents?.forEach(activity => hosts.push(activity));
    });
    for (const effect of actor.allApplicableEffects()) {
        if (isAuraEffect(effect) || !effect.active) continue;
        hosts.push(effect);
    }
    return hosts.flatMap(document => getDescriptors(document).map(descriptor => ({document, descriptor})));
}
function isHost(document) {
    return !!getDescriptorMacros(document).length;
}
function hasAuras(document) {
    if (isHost(document)) return true;
    if (document.documentName !== 'Item') return false;
    if (document.system.activities?.some(isHost)) return true;
    return document.effects.some(isHost);
}
function getHostItem(document) {
    if (document.documentName === 'Item') return document;
    if (document.documentName === 'Activity') return document.item;
    if (document.parent?.documentName === 'Item') return document.parent;
    return effectUtils.getOriginActivitySync(document)?.item;
}
function getTemplate(document, descriptor) {
    if (!descriptor.effect) return;
    const sourceEffect = getHostItem(document)?.effects?.get(descriptor.effect);
    if (!sourceEffect) return;
    const effectData = sourceEffect.toObject();
    delete effectData._id;
    delete effectData._stats;
    delete effectData.duration;
    delete effectData.start;
    delete effectData.flags.cat?.macros?.aura;
    delete effectData.flags.cat?.specialDuration;
    delete effectData.flags.dae?.specialDuration;
    effectData.origin = document.uuid;
    effectData.transfer = false;
    effectData.disabled = false;
    return effectData;
}
function createEntry(token, document, descriptor) {
    const rollDocument = getRollDocument(document);
    const key = token.id + '.' + document.uuid + '.' + descriptor.id;
    try {
        const radius = rollUtils.rollDiceSync(String(descriptor.radius ?? 0), {document: rollDocument, options: {maximize: true}}).total;
        const value = descriptor.value?.formula ? rollUtils.rollDiceSync(String(descriptor.value.formula), {document: rollDocument, options: {maximize: true}}).total : undefined;
        return {
            key,
            auraId: descriptor.id,
            token,
            document,
            descriptor,
            radius,
            value,
            template: getTemplate(document, descriptor),
            dispositions: descriptor.dispositions?.length ? descriptor.dispositions : ['all'],
            sourceDisable: descriptor.sourceDisable ?? [],
            targetDisable: descriptor.targetDisable ?? []
        };
    } catch (error) {
        logOnce(document.uuid + '.' + descriptor.id + '.descriptor', 'Invalid aura descriptor ' + descriptor.id + ' on ' + document.uuid + ': ' + error.message);
    }
}
function unindexToken(index, token) {
    const previousKeys = (index.sources.get(token.id) ?? []).map(entry => entry.key);
    previousKeys.forEach(key => index.entries.delete(key));
    index.sources.delete(token.id);
    return previousKeys;
}
function indexToken(index, token) {
    const previousKeys = unindexToken(index, token);
    if (!token.actor) return previousKeys;
    const entries = getActorDescriptors(token.actor).map(({document, descriptor}) => createEntry(token, document, descriptor)).filter(Boolean);
    if (!entries.length) return previousKeys;
    entries.forEach(entry => index.entries.set(entry.key, entry));
    index.sources.set(token.id, entries);
    return previousKeys;
}
const cellPointCache = new WeakMap();
function getCellPoints(token) {
    const grid = token.parent.grid;
    const {x: tokenX, y: tokenY, elevation, width, height} = token._source;
    const cacheKey = tokenX + '|' + tokenY + '|' + elevation + '|' + width + '|' + height + '|' + grid.type + '|' + grid.size;
    const cached = cellPointCache.get(token);
    if (cached?.key === cacheKey) return cached.points;
    const points = [];
    const startX = width >= 1 ? 0.5 : width / 2;
    const startY = height >= 1 ? 0.5 : height / 2;
    for (let x = startX; x < width; x++) {
        for (let y = startY; y < height; y++) {
            const point = grid.getCenterPoint({x: Math.round(tokenX + grid.size * x), y: Math.round(tokenY + grid.size * y)});
            points.push({x: point.x, y: point.y, elevation});
        }
    }
    cellPointCache.set(token, {key: cacheKey, points});
    return points;
}
function measure(token, target) {
    if (token === target) return 0;
    const grid = token.parent.grid;
    const targetPoints = getCellPoints(target);
    let distance = Infinity;
    for (const origin of getCellPoints(token)) {
        for (const destination of targetPoints) {
            distance = Math.min(distance, grid.measurePath([origin, destination]).distance);
        }
    }
    return distance;
}
function isWallBlocked(token, target) {
    if (token === target || !canvas.ready || token.parent !== canvas.scene || !token.object) return false;
    return !!token.object.checkCollision(target.getCenterPoint(target._source), {origin: token.getCenterPoint(token._source), type: 'move', mode: 'any'});
}
function passesFilter(entry, target, distance) {
    const filter = entry.descriptor.filter;
    if (!filter) return true;
    const scope = {
        source: entry.token.actor,
        target: target.actor,
        sourceToken: entry.token,
        targetToken: target,
        descriptor: entry.descriptor,
        distance
    };
    const errorKey = entry.document.uuid + '.' + entry.auraId + '.filter';
    try {
        if (typeof filter === 'string') {
            const embedded = (entry.document.flags.cat?.embeddedMacros ?? []).find(macro => macro.name === filter && macro.event === 'aura' && macro.pass === 'filter');
            const script = embedded?.macros?.[0]?.macro;
            if (!script) return false;
            if (entry.filterCache?.script !== script) {
                const {fn, argValues} = Events.CalledEvent.prototype.buildSyncScriptFunction(script, scope);
                entry.filterCache = {script, fn, defaults: argValues.slice(0, argValues.length - Object.keys(scope).length)};
            }
            return !!entry.filterCache.fn(...entry.filterCache.defaults, ...Object.values(scope));
        }
        const rules = filter.rules ?? documentUtils.getRules(entry.document) ?? 'all';
        const macro = constants.macros.getFnMacros(filter.source, rules, filter.identifier, 'aura', 'filter')?.macros?.[0]?.macro;
        if (!macro) return false;
        return !!macro(scope);
    } catch (error) {
        logOnce(errorKey, 'Aura filter for ' + entry.auraId + ' on ' + entry.document.uuid + ' threw: ' + error.message);
        return false;
    }
}
function testPair(entry, target) {
    if (!target.actor) return;
    if (entry.token === target && !entry.descriptor.includeSelf) return;
    if (!entry.dispositions.includes('all')) {
        const isEnemy = tokenUtils.isEnemy(entry.token, target);
        if (!(entry.dispositions.includes('enemy') && isEnemy) && !(entry.dispositions.includes('ally') && !isEnemy)) return;
    }
    const distance = measure(entry.token, target);
    if (distance > entry.radius) return;
    const {creatureTypes, sourceStatuses} = entry.descriptor;
    if (creatureTypes?.length && entry.token !== target && !creatureTypes.includes(actorUtils.typeOrRace(target.actor))) return;
    if (sourceStatuses?.length) {
        const active = sourceStatuses.filter(status => target.actor.statuses.has(status));
        if (!active.length || !actorUtils.hasStatusFromActor(target.actor, active, entry.token.actor)) return;
    }
    if (entry.descriptor.walls && isWallBlocked(entry.token, target)) return;
    if (!passesFilter(entry, target, distance)) return;
    return distance;
}
function addDirty(actor) {
    if (!actor || actor.inCompendium) return;
    state.dirty.set(actor.uuid, actor);
    scheduleFlush();
}
function markDirty(token, beforeKeys, members, {silent = false, force = false} = {}) {
    const changed = beforeKeys.size !== members.size || [...members.keys()].some(key => !beforeKeys.has(key));
    if (!changed && !force) return;
    addDirty(token.actor);
    if (silent) return;
    const diff = state.diffs.get(token.uuid) ?? {token, entered: new Set(), exited: new Set()};
    members.forEach((distance, key) => {
        if (beforeKeys.has(key)) return;
        if (diff.exited.has(key)) diff.exited.delete(key);
        else diff.entered.add(key);
    });
    beforeKeys.forEach(key => {
        if (members.has(key)) return;
        if (diff.entered.has(key)) diff.entered.delete(key);
        else diff.exited.add(key);
    });
    state.diffs.set(token.uuid, diff);
}
function computeTarget(index, token, {silent = false} = {}) {
    const before = index.membership.get(token.id) ?? new Map();
    const members = new Map();
    index.sources.forEach(entries => entries.forEach(entry => {
        const distance = testPair(entry, token);
        if (distance !== undefined) members.set(entry.key, distance);
    }));
    if (members.size) index.membership.set(token.id, members);
    else index.membership.delete(token.id);
    markDirty(token, new Set(before.keys()), members, {silent, force: true});
}
function computeSource(index, token, previousKeys = []) {
    const entries = index.sources.get(token.id) ?? [];
    const keys = new Set([...previousKeys, ...entries.map(entry => entry.key)]);
    if (!keys.size) return;
    index.scene.tokens.forEach(target => {
        const members = index.membership.get(target.id) ?? new Map();
        const before = new Set(members.keys());
        let touched = false;
        keys.forEach(key => {
            if (members.delete(key)) touched = true;
        });
        entries.forEach(entry => {
            const distance = testPair(entry, target);
            if (distance === undefined) return;
            members.set(entry.key, distance);
            touched = true;
        });
        if (!touched) return;
        if (members.size) index.membership.set(target.id, members);
        else index.membership.delete(target.id);
        markDirty(target, before, members, {force: previousKeys.length > 0});
    });
}
function buildIndex(scene) {
    const index = {scene, entries: new Map(), sources: new Map(), membership: new Map()};
    state.scenes.set(scene.id, index);
    scene.tokens.forEach(token => indexToken(index, token));
    scene.tokens.forEach(token => computeTarget(index, token, {silent: true}));
    return index;
}
function isWorldScene(scene) {
    return !!scene && !scene.inCompendium && game.scenes.get(scene.id) === scene;
}
function ensureIndex(scene) {
    if (!isWorldScene(scene)) return;
    return state.scenes.get(scene.id) ?? buildIndex(scene);
}
function isPlaced(token) {
    return token.parent?.tokens.get(token.id) === token;
}
function getTokens(actor, {linked = false} = {}) {
    if (actor.inCompendium) return [];
    return actor.getDependentTokens({linked}).filter(token => isPlaced(token) && isWorldScene(token.parent));
}
function isSourceActor(tokens) {
    return tokens.some(token => state.scenes.get(token.parent.id)?.sources.has(token.id));
}
function refreshTokens(tokens, {reindex = false} = {}) {
    tokens.forEach(token => {
        const index = ensureIndex(token.parent);
        if (!index) return;
        if (reindex) computeSource(index, token, indexToken(index, token));
        else if (index.sources.has(token.id)) computeSource(index, token);
        computeTarget(index, token);
    });
}
function isEnabled(entry, actor) {
    if (!entry.token.actor) return false;
    if (entry.sourceDisable.some(status => entry.token.actor.statuses.has(status))) return false;
    return !entry.targetDisable.some(status => actor.statuses.has(status));
}
function isCurrent(entry, current) {
    return !!current && current.source === entry.token.uuid && current.host === entry.document.uuid;
}
function isBetter(candidate, best, currents) {
    if (candidate.entry.descriptor.value?.stacking === 'highest' && candidate.entry.value !== best.entry.value) return candidate.entry.value > best.entry.value;
    const current = currents?.get(candidate.entry.auraId);
    if (isCurrent(candidate.entry, current)) return true;
    if (isCurrent(best.entry, current)) return false;
    if (candidate.distance !== best.distance) return candidate.distance < best.distance;
    return candidate.entry.key < best.entry.key;
}
function pickWinners(candidates, currents) {
    const groups = new Map();
    candidates.forEach(candidate => {
        const best = groups.get(candidate.entry.auraId);
        if (best && !isBetter(candidate, best, currents)) return;
        groups.set(candidate.entry.auraId, candidate);
    });
    return groups;
}
function getWinners(actor) {
    const currents = new Map(actor.effects.filter(isAuraEffect).map(effect => [effect.flags.cat.aura.key, effect.flags.cat.aura]));
    const candidates = [];
    getTokens(actor, {linked: true}).forEach(token => {
        const index = state.scenes.get(token.parent.id);
        index?.membership.get(token.id)?.forEach((distance, key) => {
            const entry = index.entries.get(key);
            if (entry?.template && isEnabled(entry, actor)) candidates.push({entry, distance});
        });
    });
    return pickWinners(candidates, currents);
}
function buildEffectData(entry) {
    const effectData = genericUtils.deepClone(entry.template);
    if (entry.value !== undefined) {
        effectData.system?.changes?.forEach(change => {
            if (typeof change.value === 'string') change.value = change.value.replaceAll('@auraValue', String(entry.value));
        });
    }
    genericUtils.setProperty(effectData, 'flags.cat.aura', {key: entry.auraId, source: entry.token.uuid, host: entry.document.uuid, value: entry.value ?? null});
    return effectData;
}
function isSameEffect(effect, effectData) {
    return foundry.utils.isEmpty(foundry.utils.diffObject(effect.toObject(), effectData));
}
function isWritable(actor) {
    if (actor.inCompendium) return false;
    if (actor.isToken) return !!actor.token && isPlaced(actor.token) && isWorldScene(actor.token.parent);
    return game.actors.get(actor.id) === actor;
}
async function syncActor(actor, {legacy = false} = {}) {
    if (!isWritable(actor)) return;
    const desired = new Map(Array.from(getWinners(actor).entries()).map(([auraId, {entry}]) => [auraId, buildEffectData(entry)]));
    const kept = new Set();
    const deletes = [];
    const updates = [];
    actor.effects.forEach(effect => {
        if (legacy && effect.flags.cat?.auraEffect) {
            deletes.push(effect.id);
            return;
        }
        const aura = effect.flags.cat?.aura;
        if (!aura) return;
        const effectData = desired.get(aura.key);
        if (!effectData || kept.has(aura.key)) {
            deletes.push(effect.id);
            return;
        }
        kept.add(aura.key);
        if (!isSameEffect(effect, effectData)) updates.push({...effectData, _id: effect.id});
    });
    const creates = Array.from(desired.entries()).filter(([auraId]) => !kept.has(auraId)).map(([, effectData]) => effectData);
    if (deletes.length) await actor.deleteEmbeddedDocuments('ActiveEffect', deletes);
    if (updates.length) await actor.updateEmbeddedDocuments('ActiveEffect', updates);
    if (creates.length) await actor.createEmbeddedDocuments('ActiveEffect', creates);
}
function getReconcileActors() {
    const hasOutput = effects => effects?.some(effect => isAuraEffect(effect) || effect.flags.cat?.auraEffect);
    const actors = game.actors.filter(actor => hasOutput(actor.effects));
    game.scenes.forEach(scene => scene.tokens.forEach(token => {
        if (!token.actorLink && token.actor && hasOutput(token.delta?.effects)) actors.push(token.actor);
    }));
    return actors;
}
function emitDiffs() {
    if (!state.diffs.size) return;
    const diffs = Array.from(state.diffs.values()).filter(diff => diff.entered.size || diff.exited.size).map(diff => {
        const entries = state.scenes.get(diff.token.parent?.id)?.entries;
        return {
            token: diff.token,
            entered: Array.from(diff.entered).map(key => entries?.get(key)).filter(Boolean),
            exited: Array.from(diff.exited).map(key => entries?.get(key)).filter(Boolean)
        };
    });
    state.diffs.clear();
    if (!diffs.length) return;
    membershipTriggers(diffs);
}
async function flush() {
    emitDiffs();
    const legacy = state.reconcile;
    state.reconcile = false;
    if (legacy) getReconcileActors().forEach(actor => addDirty(actor));
    const dirty = Array.from(state.dirty.values());
    state.dirty.clear();
    await Promise.all(dirty.map(actor => syncActor(actor, {legacy})));
}
function enqueueWrite(callback) {
    state.writes = state.writes.then(callback).catch(error => Logging.addEntry('ERROR', 'Aura effect sync failed: ' + error.message, {force: true}));
    return state.writes;
}
function reconcile() {
    if (!queryUtils.isTheGM() || !state.ready) return;
    game.scenes.forEach(scene => ensureIndex(scene));
    state.reconcile = true;
    return enqueueWrite(flush);
}
function rebuild() {
    if (!queryUtils.isTheGM()) return;
    state.ready = true;
    state.canvasScene = canvas.ready ? canvas.scene : null;
    game.scenes.forEach(scene => buildIndex(scene));
    return reconcile();
}
function viewScene(scene) {
    const scenes = new Set([state.canvasScene, scene].filter(isWorldScene));
    state.canvasScene = scene;
    scenes.forEach(scene => buildIndex(scene));
    return reconcile();
}
function indexScene(scene) {
    if (isWorldScene(scene)) buildIndex(scene);
}
function forgetScene(scene) {
    if (scene.inCompendium) return;
    const index = state.scenes.get(scene.id);
    if (!index || index.scene !== scene) return;
    state.scenes.delete(scene.id);
    index.membership.forEach((members, tokenId) => {
        const token = scene.tokens.get(tokenId);
        if (token?.actorLink) addDirty(token.actor);
    });
}
function removeToken(token) {
    if (!isWorldScene(token.parent)) return;
    const index = state.scenes.get(token.parent.id);
    if (!index) return;
    computeSource(index, token, unindexToken(index, token));
    const before = index.membership.get(token.id);
    index.membership.delete(token.id);
    if (before) markDirty(token, new Set(before.keys()), new Map());
}
function refreshItemActor(item, {touched = true} = {}) {
    const isHost = touched && hasAuras(item);
    const actor = item.actor;
    if (!actor) return;
    const tokens = getTokens(actor);
    if (!tokens.length) return;
    if (!isHost && !isSourceActor(tokens)) return;
    refreshTokens(tokens, {reindex: true});
}
function refreshEffect(effect) {
    const isOutput = isAuraEffect(effect);
    const actor = effectUtils.getActor(effect);
    if (!actor) return;
    const tokens = getTokens(actor);
    if (isOutput && !effect.statuses.size) {
        addDirty(actor);
        return refreshTokens(tokens);
    }
    if (!tokens.length) return;
    const isHost = !isOutput && (hasAuras(effect) || (effect.parent?.documentName === 'Item' && hasAuras(effect.parent)));
    refreshTokens(tokens, {reindex: isHost || isSourceActor(tokens)});
}
function refreshActor(actor) {
    const tokens = getTokens(actor);
    if (!tokens.length) return;
    refreshTokens(tokens, {reindex: isSourceActor(tokens)});
}
function removeActor(actor) {
    if (actor.inCompendium) return;
    state.scenes.forEach(index => index.scene.tokens.forEach(token => {
        if (token.actorId === actor.id) removeToken(token);
    }));
}
function getTriggerActivity(entry, reference) {
    const document = entry.document;
    if (!reference) return document.documentName === 'Activity' ? document : undefined;
    const item = getHostItem(document);
    if (!item?.system.activities) return;
    return item.system.activities.get(reference) ?? itemUtils.getActivityByIdentifier(item, reference);
}
function getTokenCombat(token) {
    return game.combats.find(combat => combat.started && combat.combatants.some(combatant => combatant.tokenId === token.id && combatant.sceneId === token.parent?.id));
}
function getTurnKey(combat, round = combat?.round, turn = combat?.turn) {
    if (!combat?.started) return;
    return combat.id + '.' + round + '.' + turn;
}
function pickTriggered(target, candidates, event) {
    if (!target.actor) return [];
    const eligible = candidates.filter(({entry}) => entry.descriptor.triggers?.some(trigger => trigger.event === event) && isEnabled(entry, target.actor));
    return Array.from(pickWinners(eligible).values()).map(candidate => candidate.entry);
}
async function runTriggers(target, entries, event, turnKey) {
    for (const entry of entries) {
        for (const trigger of entry.descriptor.triggers.filter(trigger => trigger.event === event)) {
            if (!target.actor || !isPlaced(target)) return;
            if (!entry.token.actor || !isPlaced(entry.token)) continue;
            const activity = getTriggerActivity(entry, trigger.activity);
            if (!activity) {
                logOnce(entry.document.uuid + '.' + entry.auraId + '.trigger.' + trigger.activity, 'Aura trigger activity ' + trigger.activity + ' not found for ' + entry.auraId + ' on ' + entry.document.uuid);
                continue;
            }
            if (!activity.item?.actor?.items.has(activity.item.id)) continue;
            if (trigger.oncePerTurn && turnKey) {
                const stampKey = entry.key + '.' + target.id + '.' + activity.id;
                if (state.stamps.get(stampKey) === turnKey) continue;
                state.stamps.set(stampKey, turnKey);
            }
            await workflowUtils.syntheticActivityRoll(activity, [target]);
        }
    }
}
function enqueue(callback) {
    state.queue = state.queue.then(callback).catch(error => Logging.addEntry('ERROR', 'Aura trigger failed: ' + error.message, {force: true}));
    return state.queue;
}
function membershipTriggers(diffs) {
    if (!queryUtils.isTheGM()) return;
    diffs.forEach(({token, entered, exited}) => {
        const turnKey = getTurnKey(getTokenCombat(token));
        const members = state.scenes.get(token.parent?.id)?.membership.get(token.id);
        const enterEntries = pickTriggered(token, entered.map(entry => ({entry, distance: members?.get(entry.key) ?? Infinity})), constants.auraTriggers.enter);
        const exitEntries = pickTriggered(token, exited.map(entry => ({entry, distance: Infinity})), constants.auraTriggers.exit);
        if (enterEntries.length) enqueue(() => runTriggers(token, enterEntries, constants.auraTriggers.enter, turnKey));
        if (exitEntries.length) enqueue(() => runTriggers(token, exitEntries, constants.auraTriggers.exit, turnKey));
    });
}
async function turnEvent(token, event, {combat, round, turn} = {}) {
    if (!queryUtils.isTheGM() || !state.ready || !token?.parent) return;
    const index = ensureIndex(token.parent);
    const members = index?.membership.get(token.id);
    if (!members) return;
    const candidates = Array.from(members.entries()).map(([key, distance]) => ({entry: index.entries.get(key), distance})).filter(candidate => candidate.entry);
    const entries = pickTriggered(token, candidates, event);
    if (!entries.length) return;
    const turnKey = getTurnKey(combat, round, turn);
    await enqueue(() => runTriggers(token, entries, event, turnKey));
}
function isReady() {
    return state.ready;
}
export default {
    rebuild,
    reconcile,
    isReady,
    isWorldScene,
    viewScene,
    indexScene,
    forgetScene,
    refreshTokens,
    removeToken,
    refreshItemActor,
    refreshEffect,
    refreshActor,
    removeActor,
    turnEvent
};
