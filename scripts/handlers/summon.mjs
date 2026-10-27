import {constants, Logging} from '../lib/_module.mjs';
import {activityUtils, actorUtils, automationUtils, compendiumUtils, dialogUtils, documentUtils, effectUtils, genericUtils, itemUtils, queryUtils, rollUtils, summonUtils, tokenUtils, workflowUtils} from '../utilities/_module.mjs';
const pendingUses = new Map();
function getStored(document) {
    return document?.flags?.cat?.genericConfig?.cat?.summon;
}
function getConfig(document) {
    return automationUtils.getGenericConfigValues(document, 'cat', 'summon', configKeys);
}
function getHost(activity) {
    if (getStored(activity)) return activity;
    const item = activity.item;
    if (!getStored(item)) return;
    const {activityId} = getConfig(item);
    if (activityId ? activityId === activity.id : activity.type === 'summon') return item;
}
function getItem(host) {
    return host.documentName === 'Activity' ? host.item : host;
}
function getCommandHost(activity) {
    const item = activity.item;
    return [item, ...item.system.activities].find(document => {
        if (!getStored(document)) return false;
        const config = getConfig(document);
        return [config.placeActivityId, config.recallActivityId, config.moveActivityId].includes(activity.id);
    });
}
function resolveFormula(formula, rollData) {
    return new Roll(String(formula), rollData).evaluateSync({strict: false}).total;
}
function getEntries(activity, config, profileId) {
    if (activity.type !== 'summon') return config.summons;
    const profile = activity.profiles.find(profile => profile._id === profileId) ?? activity.availableProfiles[0];
    if (!profile) return [];
    const entry = config.summons.find(entry => entry.profile === profile._id) ?? {};
    return [{...entry, sourceActorUuid: entry.sourceActorUuid || profile.uuid, count: entry.count || profile.count || '1', profile}];
}
function getTypedUpdates(entry, rollData) {
    const updates = {};
    (entry.updates ?? []).forEach(({path, value, mode}) => {
        if (path) genericUtils.setProperty(updates, path, mode === 'literal' ? value : resolveFormula(value, rollData));
    });
    return updates;
}
function getItems(entry, rollData) {
    return (entry.items ?? []).filter(itemInfo => itemInfo.uuid).map(itemInfo => {
        const scaling = itemInfo.scaling ?? {};
        const attacks = scaling.attacks ? resolveFormula(scaling.attacks, rollData) : undefined;
        return {
            ...itemInfo,
            name: itemInfo.name ? _loc(itemInfo.name, {attacks}) : undefined,
            scaling: {
                damageNumber: scaling.damageNumber ? resolveFormula(scaling.damageNumber, rollData) : undefined,
                damageBonus: scaling.damageBonus ? Roll.replaceFormulaData(String(scaling.damageBonus), rollData) : undefined,
                damageTypes: scaling.damageTypes?.length ? scaling.damageTypes : undefined,
                damageDenomination: scaling.damageDenomination ? resolveFormula(scaling.damageDenomination, rollData) : undefined,
                healingNumber: scaling.healingNumber ? resolveFormula(scaling.healingNumber, rollData) : undefined,
                healingBonus: scaling.healingBonus ? Roll.replaceFormulaData(String(scaling.healingBonus), rollData) : undefined,
                usesMax: scaling.usesMax ? resolveFormula(scaling.usesMax, rollData) : undefined
            }
        };
    });
}
const bonusKeys = {acBonus: 'ac', hpBonus: 'hp', hdBonus: 'hd', attackDamageBonus: 'attackDamage', saveDamageBonus: 'saveDamage', healingBonus: 'healing'};
const matchKeys = {matchAttacks: 'attacks', matchSaves: 'saves', matchProficiency: 'proficiency'};
function getSummonActivity(activity, config) {
    const bonuses = Object.fromEntries(Object.entries(bonusKeys).filter(([key]) => config[key]).map(([key, bonus]) => [bonus, config[key]]));
    const match = Object.fromEntries(Object.entries(matchKeys).filter(([key]) => config[key]).map(([key, field]) => [field, true]));
    const changes = {bonuses, match};
    if (config.tempHP) changes.tempHP = config.tempHP;
    if (activity.type === 'summon') return activity.clone(changes);
    const data = genericUtils.mergeObject(activity.toObject(), {type: 'summon', profiles: [], effects: [], ...changes}, {inplace: false});
    return new CONFIG.DND5E.activityTypes.summon.documentClass(data, {parent: activity.parent});
}
async function getNativeChanges(activity, entry, sourceActor, typedUpdates, options) {
    const actorData = genericUtils.mergeObject(sourceActor.toObject(), typedUpdates, {inplace: false});
    const tempActor = new Actor.implementation(actorData);
    const {actorUpdates, tokenUpdates} = await activity.getChanges(tempActor, entry.profile ?? {_id: ''}, options);
    const {effects, items, ...rest} = actorUpdates;
    const updates = genericUtils.deepClone(typedUpdates);
    Object.entries(rest).forEach(([path, value]) => genericUtils.setProperty(updates, path, value));
    updates.effects = [...actorData.effects, ...effects];
    updates.items = actorData.items.map(itemData => {
        const change = items.find(change => change._id === itemData._id);
        if (!change) return itemData;
        const {_id, ...itemChanges} = change;
        return genericUtils.mergeObject(itemData, genericUtils.expandObject(itemChanges), {inplace: false});
    });
    return {updates, tokenUpdates};
}
function resolveCount(formula, rollData) {
    return Math.max(0, Math.floor(resolveFormula(formula || '1', rollData)));
}
function toPicks(selection) {
    return (Array.isArray(selection) ? selection : [{document: selection, amount: 1}]).filter(pick => pick.amount);
}
function splitList(value) {
    return (Array.isArray(value) ? value : String(value ?? '').split(',')).map(part => part.trim()).filter(Boolean);
}
function usesCompendium(compendium) {
    return !!compendium && ['types', 'subtypes', 'names', 'tiers', 'maxCR'].some(key => splitList(compendium[key]).length);
}
async function pickCompendiumActors(item, entry, rollData) {
    const compendium = entry.compendium;
    const tiers = String(compendium.tiers ?? '').split(';').map(tier => tier.split('|').map(part => part.trim())).filter(([cr, count]) => cr && count).map(([cr, count]) => ({cr: Number(cr), count: resolveCount(count, rollData)}));
    let maxCR = compendium.maxCR ? resolveFormula(compendium.maxCR, rollData) : undefined;
    let count = resolveCount(entry.count, rollData);
    if (tiers.length) {
        const buttons = tiers.map((tier, index) => [_loc('CAT.Macros.Summon.Tier', {count: tier.count, cr: dnd5e.utils.formatCR(tier.cr)}), index + 1]);
        let choice = 1;
        if (compendium.randomTier) choice = (await rollUtils.rollDice('1d' + tiers.length, {message: true, flavor: item.name, speaker: ChatMessage.implementation.getSpeaker({actor: item.actor})})).roll.total;
        else if (tiers.length > 1) choice = await dialogUtils.buttonDialog(item.name, 'CAT.Macros.Summon.TierPrompt', buttons, {userId: queryUtils.firstOwner(item.actor, true)});
        if (!choice) return [];
        ({cr: maxCR, count} = tiers[choice - 1]);
    }
    if (!count) return [];
    const documents = await compendiumUtils.getFilteredActors({maxCR, creatureTypes: splitList(compendium.types), creatureSubtypes: splitList(compendium.subtypes), names: splitList(compendium.names)});
    if (!documents.length) {
        genericUtils.notify('CAT.Macros.Summon.NoMatching', {type: 'warn'});
        return [];
    }
    const selection = await dialogUtils.selectDocumentDialog(item.name, _loc('CAT.Macros.Summon.Pick', {count}), documents, {max: count, showCR: true, sort: 'cr', userId: queryUtils.gmID()});
    if (!selection) return [];
    return (await Promise.all(toPicks(selection).map(async pick => ({actor: await fromUuid(pick.document.uuid), count: pick.amount})))).filter(pick => pick.actor);
}
async function getSources(item, entry, rollData) {
    if (usesCompendium(entry.compendium)) return await pickCompendiumActors(item, entry, rollData);
    const actor = await fromUuid(entry.sourceActorUuid);
    if (!actor) {
        Logging.addMacroWarning('CAT', documentUtils.getIdentifier(item), 'CAT.Macros.Summon.MissingActor', {notify: 'warn'});
        return [];
    }
    return [{actor, count: resolveCount(entry.count, rollData)}];
}
async function createFromEntry(host, activity, entry, {rollData, castData, options, summonActivity, hostileOnParentEnd, workflowOptions}) {
    const item = getItem(host);
    const duration = activityUtils.getDuration(activity);
    const concentration = effectUtils.getConcentrationEffect(item.actor, item);
    const parent = hostileOnParentEnd ? undefined : concentration;
    const summons = [];
    for (const {actor: sourceActor, count} of await getSources(item, entry, rollData)) {
        for (let i = 0; i < count; i++) {
            const typedUpdates = getTypedUpdates(entry, rollData);
            const {updates, tokenUpdates} = await getNativeChanges(summonActivity, entry, sourceActor, typedUpdates, options);
            genericUtils.setProperty(updates, 'flags.cat.castData', castData);
            if (entry.followUpActivityId) genericUtils.setProperty(updates, 'flags.cat.followUpActivityId', entry.followUpActivityId);
            if (hostileOnParentEnd && concentration) genericUtils.setProperty(updates, 'flags.cat.summonHostileParent', concentration.uuid);
            const disposition = entry.disposition !== undefined && entry.disposition !== '' ? Number(entry.disposition) : tokenUpdates.disposition;
            summons.push(await summonUtils.createSummon(item.actor, sourceActor, {
                duration,
                parent,
                sourceDocument: host,
                name: entry.name ? _loc(entry.name) : undefined,
                avatarImg: entry.avatarImg || undefined,
                tokenImg: entry.tokenImg || undefined,
                animation: entry.animation?.source ? entry.animation : undefined,
                sounds: entry.sounds,
                items: getItems(entry, rollData),
                initiative: entry.initiative || 'follows',
                disposition,
                size: entry.size || genericUtils.getProperty(updates, 'system.traits.size'),
                dismissAtZero: entry.dismissAtZero,
                identifier: entry.identifier || undefined,
                workflowOptions,
                updates
            }));
        }
    }
    return summons.filter(Boolean);
}
async function pickBudget(item, entries, config, rollData) {
    const budget = resolveCount(config.budget, rollData);
    if (!budget) return [];
    const documents = await Promise.all(entries.map(async (entry, index) => {
        const actor = entry.sourceActorUuid ? await fromUuid(entry.sourceActorUuid) : undefined;
        return {id: 'entry' + index, name: entry.name ? _loc(entry.name) : actor?.name ?? String(index + 1), img: entry.tokenImg || entry.avatarImg || actor?.img || 'icons/svg/mystery-man.svg'};
    }));
    const weights = Object.fromEntries(entries.map((entry, index) => ['entry' + index, Number(entry.weight) || 1]));
    const selection = await dialogUtils.selectDocumentDialog(item.name, _loc('CAT.Macros.Summon.Pick', {count: budget}), documents, {max: budget, weights, userId: queryUtils.firstOwner(item.actor, true)});
    if (!selection) return [];
    return toPicks(selection).map(pick => ({...entries[Number(pick.document.id.slice(5))], count: String(pick.amount)}));
}
async function create(host, activity, {profileId, options = {}, workflowOptions} = {}) {
    const item = getItem(host);
    const config = getConfig(host);
    const entries = getEntries(activity, config, profileId);
    if (!entries.length) return Logging.addMacroWarning('CAT', documentUtils.getIdentifier(item), 'CAT.Macros.Summon.NoSummons', {notify: 'warn'});
    const oldSummons = config.replaceExisting ? summonUtils.getSummonsBySource(host) : [];
    const castLevel = activity.relevantLevel;
    const rollData = {...activity.getRollData(), castLevel, ownerCR: actorUtils.getCR(item.actor)};
    const castData = {castLevel, baseLevel: item.system.level ?? 0, saveDC: itemUtils.getSaveDC(item), mod: rollData.mod};
    const summons = [];
    const summonActivity = getSummonActivity(activity, config);
    const picked = config.pick === 'budget' ? await pickBudget(item, entries, config, rollData) : entries;
    for (const entry of picked) summons.push(...await createFromEntry(host, activity, entry, {rollData, castData, options, summonActivity, hostileOnParentEnd: config.hostileOnParentEnd, workflowOptions}));
    if (!summons.length) return;
    const commandIds = getCommandIds(config);
    if (commandIds.length) await itemUtils.unhideActivities(item, commandIds, {ids: true, favorite: config.favorite});
    await Promise.all(oldSummons.map(summon => summonUtils.deleteSummon(summon)));
    const token = activity.getUsageToken?.()?.document ?? actorUtils.getFirstToken(item.actor);
    if (!token) return;
    await summonUtils.placeSummons(summons, getRange(activity, config), {token});
    await followUp(host, config, 'create');
}
function getRange(activity, config) {
    return config.range || activity.range?.value || 5;
}
function getCommandIds(config) {
    return [config.placeActivityId, config.recallActivityId, config.moveActivityId, config.followUpActivityId, ...(config.commandActivityIds ?? [])].filter(Boolean);
}
function getCommandIdentifiers(item, config) {
    return getCommandIds(config).map(id => item.system.activities.get(id)).filter(Boolean).map(activity => activity.identifier);
}
function getFollowUpTargets(activity, summon, nearby) {
    const owner = actorUtils.getFirstToken(summon.owner);
    switch (activity.target?.affects?.type) {
        case 'ally': return [owner, ...nearby].filter(token => token && token.disposition === owner?.disposition && token !== summon.token).filter((token, index, list) => list.indexOf(token) === index);
        case 'enemy': return nearby.filter(token => tokenUtils.isEnemy(token, summon.token));
        default: return nearby.filter(token => token.actor !== summon.owner);
    }
}
async function followUp(host, config, timing) {
    if (!['both', timing].includes(config.followUpTiming)) return;
    const item = getItem(host);
    const userId = queryUtils.firstOwner(item.actor, true);
    const baseLevel = item.system.level ?? 0;
    for (const summon of summonUtils.getSummonsBySource(host).filter(summon => summon.token)) {
        const activity = item.system.activities.get(summon.actor.flags.cat?.followUpActivityId || config.followUpActivityId);
        if (!activity) continue;
        const nearby = tokenUtils.findNearby(summon.token, config.followUpRange);
        const scaling = Math.max(0, (actorUtils.getSavedCastData(summon.actor)?.castLevel ?? baseLevel) - baseLevel);
        let targets = [];
        if (config.followUpTargets === 'all') targets = getFollowUpTargets(activity, summon, nearby);
        else if (nearby.length) {
            const selection = await dialogUtils.selectTargetDialog(activity.name, 'CAT.Macros.Summon.FollowUpTarget', nearby, {skipDeadAndUnconscious: false, userId});
            if (selection?.result) targets = [selection.result];
        }
        if (targets.length) await workflowUtils.completeActivityUse(activity, targets, {config: {scaling}, consumeUsage: config.followUpConsume, consumeResources: config.followUpConsume, spellSlot: false, userId});
    }
}
async function command(host, activity) {
    const config = getConfig(host);
    const token = activity.getUsageToken?.()?.document ?? actorUtils.getFirstToken(activity.actor);
    const range = activity.range?.value || getRange(activity, config);
    if (activity.id === config.placeActivityId) await summonUtils.placeAllSourceSummons(host, range, {token});
    if (activity.id === config.recallActivityId) await summonUtils.recallAllSourceSummons(host);
    if (activity.id !== config.moveActivityId) return;
    for (const summon of summonUtils.getSummonsBySource(host).filter(summon => summon.token)) await summon.move(range, {token});
    await leash({document: host});
    await followUp(host, config, 'move');
}
function preUseActivity(activity) {
    if (getHost(activity) || getCommandHost(activity)) pendingUses.set(activity.uuid, null);
}
function preSummon(activity, profile, options) {
    const host = getHost(activity);
    if (!host) return;
    if (pendingUses.has(activity.uuid)) pendingUses.set(activity.uuid, {profileId: profile._id, options});
    else create(host, activity, {profileId: profile._id, options});
    return false;
}
async function rollFinished(workflow) {
    const activity = workflow.activity;
    if (!activity || !pendingUses.has(activity.uuid)) return;
    const request = pendingUses.get(activity.uuid);
    pendingUses.delete(activity.uuid);
    const host = getHost(activity);
    if (host) {
        if (activity.type !== 'summon' || request) await create(host, activity, {...request, workflowOptions: workflow.workflowOptions});
        return;
    }
    const commandHost = getCommandHost(activity);
    if (commandHost) await command(commandHost, activity);
}
async function leash({document}) {
    const maxDistance = getConfig(document).maxDistance;
    const token = actorUtils.getFirstToken(getItem(document).actor);
    if (!maxDistance || !token) return;
    const summons = summonUtils.getSummonsBySource(document).filter(summon => summon.token && tokenUtils.getDistance(token, summon.token) > maxDistance);
    await Promise.all(summons.map(summon => summonUtils.deleteSummon(summon)));
}
async function deleted({document, summon}) {
    if (summonUtils.getSummonsBySource(document).some(other => other !== summon)) return;
    const item = getItem(document);
    await effectUtils.endConcentration(summon.owner, item);
    const config = getConfig(document);
    const identifiers = getCommandIdentifiers(item, config);
    if (identifiers.length) await itemUtils.rehideActivities(item, identifiers, {favorite: config.favorite});
}
async function deleteActiveEffect(effect) {
    if (!queryUtils.isTheGM()) return;
    const summons = summonUtils.getSummons(effect.parent).filter(summon => summon.actor?.flags.cat?.summonHostileParent === effect.uuid);
    for (const summon of summons) {
        await Promise.all(actorUtils.getTokens(summon.actor).map(token => documentUtils.update(token, {disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE})));
        await documentUtils.update(summon.actor, {'prototypeToken.disposition': CONST.TOKEN_DISPOSITIONS.HOSTILE, 'flags.cat.-=summonHostileParent': null});
    }
}
function selectOptions(values, prefix) {
    return values.map(value => ({value, label: prefix + value}));
}
const summon = {
    source: 'cat',
    identifier: 'summon',
    rules: 'all',
    generic: true,
    documents: ['item', 'activity'],
    move: [
        {
            pass: 'nearbyMoved',
            macro: leash,
            priority: 50
        }
    ],
    summon: [
        {
            pass: 'delete',
            macro: deleted,
            priority: 50
        }
    ],
    genericConfig: {
        activityId: {
            default: '',
            type: 'selectActivity',
            category: 'behavior',
            label: 'CAT.Macros.Summon.Activity',
            hint: 'CAT.Macros.Summon.ActivityHint'
        },
        summons: {
            default: [],
            type: 'selectSummons',
            category: 'behavior',
            label: 'CAT.Macros.Summon.Summons',
            hint: 'CAT.Macros.Summon.SummonsHint'
        },
        range: {
            default: 0,
            type: 'number',
            category: 'behavior',
            label: 'CAT.Macros.Summon.Range',
            hint: 'CAT.Macros.Summon.RangeHint'
        },
        acBonus: {
            default: '',
            type: 'text',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.AcBonus',
            hint: 'CAT.Macros.Summon.NativeHint'
        },
        hpBonus: {
            default: '',
            type: 'text',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.HpBonus',
            hint: 'CAT.Macros.Summon.NativeHint'
        },
        hdBonus: {
            default: '',
            type: 'text',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.HdBonus',
            hint: 'CAT.Macros.Summon.NativeHint'
        },
        tempHP: {
            default: '',
            type: 'text',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.TempHP',
            hint: 'CAT.Macros.Summon.NativeHint'
        },
        attackDamageBonus: {
            default: '',
            type: 'text',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.AttackDamageBonus',
            hint: 'CAT.Macros.Summon.NativeHint'
        },
        saveDamageBonus: {
            default: '',
            type: 'text',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.SaveDamageBonus',
            hint: 'CAT.Macros.Summon.NativeHint'
        },
        healingBonus: {
            default: '',
            type: 'text',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.HealingBonus',
            hint: 'CAT.Macros.Summon.NativeHint'
        },
        matchAttacks: {
            default: false,
            type: 'checkbox',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.MatchAttacks',
            hint: 'CAT.Macros.Summon.MatchAttacksHint'
        },
        matchSaves: {
            default: false,
            type: 'checkbox',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.MatchSaves',
            hint: 'CAT.Macros.Summon.MatchSavesHint'
        },
        matchProficiency: {
            default: false,
            type: 'checkbox',
            category: 'homebrew',
            label: 'CAT.Macros.Summon.MatchProficiency',
            hint: 'CAT.Macros.Summon.MatchProficiencyHint'
        },
        pick: {
            default: 'all',
            type: 'select',
            category: 'behavior',
            label: 'CAT.Macros.Summon.PickMode',
            hint: 'CAT.Macros.Summon.PickModeHint',
            get options() { return selectOptions(['all', 'budget'], 'CAT.Macros.Summon.PickOptions.'); }
        },
        budget: {
            default: '',
            type: 'text',
            category: 'behavior',
            label: 'CAT.Macros.Summon.Budget',
            hint: 'CAT.Macros.Summon.BudgetHint'
        },
        hostileOnParentEnd: {
            default: false,
            type: 'checkbox',
            category: 'behavior',
            label: 'CAT.Macros.Summon.HostileOnParentEnd',
            hint: 'CAT.Macros.Summon.HostileOnParentEndHint'
        },
        replaceExisting: {
            default: false,
            type: 'checkbox',
            category: 'behavior',
            label: 'CAT.Macros.Summon.ReplaceExisting',
            hint: 'CAT.Macros.Summon.ReplaceExistingHint'
        },
        maxDistance: {
            default: 0,
            type: 'number',
            category: 'behavior',
            label: 'CAT.Macros.Summon.MaxDistance',
            hint: 'CAT.Macros.Summon.MaxDistanceHint'
        },
        placeActivityId: {
            default: '',
            type: 'selectActivity',
            category: 'behavior',
            label: 'CAT.Macros.Summon.PlaceActivity',
            hint: 'CAT.Macros.Summon.PlaceActivityHint'
        },
        recallActivityId: {
            default: '',
            type: 'selectActivity',
            category: 'behavior',
            label: 'CAT.Macros.Summon.RecallActivity',
            hint: 'CAT.Macros.Summon.RecallActivityHint'
        },
        moveActivityId: {
            default: '',
            type: 'selectActivity',
            category: 'behavior',
            label: 'CAT.Macros.Summon.MoveActivity',
            hint: 'CAT.Macros.Summon.MoveActivityHint'
        },
        commandActivityIds: {
            default: [],
            type: 'selectActivities',
            category: 'behavior',
            label: 'CAT.Macros.Summon.CommandActivities',
            hint: 'CAT.Macros.Summon.CommandActivitiesHint'
        },
        favorite: {
            default: false,
            type: 'checkbox',
            category: 'behavior',
            label: 'CAT.Macros.Summon.Favorite',
            hint: 'CAT.Macros.Summon.FavoriteHint'
        },
        followUpActivityId: {
            default: '',
            type: 'selectActivity',
            category: 'behavior',
            label: 'CAT.Macros.Summon.FollowUpActivity',
            hint: 'CAT.Macros.Summon.FollowUpActivityHint'
        },
        followUpTiming: {
            default: 'both',
            type: 'select',
            category: 'behavior',
            label: 'CAT.Macros.Summon.FollowUpTiming',
            hint: 'CAT.Macros.Summon.FollowUpTimingHint',
            get options() { return selectOptions(['both', 'create', 'move'], 'CAT.Macros.Summon.FollowUpTimingOptions.'); }
        },
        followUpTargets: {
            default: 'one',
            type: 'select',
            category: 'behavior',
            label: 'CAT.Macros.Summon.FollowUpTargets',
            hint: 'CAT.Macros.Summon.FollowUpTargetsHint',
            get options() { return selectOptions(['one', 'all'], 'CAT.Macros.Summon.FollowUpTargetsOptions.'); }
        },
        followUpRange: {
            default: 5,
            type: 'number',
            category: 'behavior',
            label: 'CAT.Macros.Summon.FollowUpRange',
            hint: 'CAT.Macros.Summon.FollowUpRangeHint'
        },
        followUpConsume: {
            default: false,
            type: 'checkbox',
            category: 'behavior',
            label: 'CAT.Macros.Summon.FollowUpConsume',
            hint: 'CAT.Macros.Summon.FollowUpConsumeHint'
        }
    }
};
const configKeys = Object.keys(summon.genericConfig);
function register() {
    constants.macros.registerFnMacro(summon);
}
export default {
    register,
    preUseActivity,
    preSummon,
    rollFinished,
    deleteActiveEffect
};
