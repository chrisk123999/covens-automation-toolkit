import {documentUtils, genericUtils, queryUtils} from '../utilities/_module.mjs';
function getCastData(actor) {
    return actor.flags.cat?.castData;
}
function getEffects(actor, {includeItemEffects = false} = {}) {
    const effects = Array.from(actor.allApplicableEffects());
    if (!includeItemEffects) return effects;
    const enchantmentEffects = actor.items.contents.flatMap(item => item.effects.contents).filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment);
    return [...effects, ...enchantmentEffects];
}
function getGroups(actor) {
    return game.actors.filter(a => a.type === 'group' && a.system.creatures.includes(actor));
}
function getSavedCastData(actor) {
    return actor.flags.cat?.castData;
}
async function getEncounterMembers(actor) {
    return (await Promise.all(actor.system.members.uuids.map(uuid => fromUuid(uuid)))).filter(i => i);
}
function getEncounters(actor) {
    return game.actors.filter(a => a.type === 'encounter' && a.system.members.uuids.has(actor.uuid));
}
function getVehicles(actor, {positions = ['crew', 'passenger', 'draft']} = {}) {
    return game.actors.filter(a => a.type === 'vehicle' && ((positions.includes('crew') && a.system.crew.value.includes(actor.uuid)) || ((positions.includes('passenger') && a.system.passengers.value.includes(actor.uuid)) || ((positions.includes('draft') && a.system.draft.value.includes(actor.uuid))))));
}
function getTokens(actor) {
    return actor.getActiveTokens().map(i => i.document);
}
function getFirstToken(actor) {
    return getTokens(actor)?.[0];
}
function getEffectByIdentifier(actor, identifier) {
    return getEffects(actor).find(i => documentUtils.getIdentifier(i) === identifier);
}
function getBestAbility(actor, abilities) {
    return abilities.reduce((best, key) => {
        if (!actor.system.abilities[key]) return best;
        return actor.system.abilities[key].mod > actor.system.abilities[best].mod ? key : best;
    });
}
function checkTrait(actor, type, trait) {
    return actor.system.traits?.[type]?.value?.has(trait);
}
function getEffectByStatusID(actor, id) {
    return getEffects(actor).find(i => i.id === CONFIG.statusEffects.find(j => j.id === id)?._id);
}
function getItemByIdentifier(actor, identifier, {multiple = false} = {}) {
    const predicate = item => documentUtils.getIdentifier(item) === identifier;
    return multiple ? actor.items.filter(predicate) : actor.items.find(predicate);
}
async function applyConditions(actor, conditions, {overlay = false} = {}) {
    const updates = [];
    await Promise.all(conditions.map(async id => {
        if (checkTrait(actor, 'ci', id)) return;
        const cEffect = getEffectByStatusID(actor, id);
        if (cEffect) return;
        const effectImplementation = await ActiveEffect.implementation.fromStatusEffect(id);
        if (!effectImplementation) return;
        const effectData = effectImplementation.toObject();
        if (overlay) genericUtils.setProperty(effectData, 'flags.core.overlay', true);
        updates.push(effectData);
    }));
    if (updates.length) return await documentUtils.createEmbeddedDocuments(actor, 'ActiveEffect', updates, {keepId: true});
}
function getEquivalentSpellSlotName(actor, level, {canCast = false} = {}) {
    if (!canCast) {
        return Object.entries(actor.system.spells)?.find(i => i[1].level == level)?.[0];
    } else {
        return Object.entries(actor.system.spells)?.find(i => i[1].level >= level && i[1].value)?.[0];
    }
}
function getCastableSpells(actor, {identifiers = []} = {}) {
    const maxSlot = Math.max(...Object.values(actor.system.spells).filter(i => i.value).map(j => j.level), 0);
    let validSpells = actor.items.filter(i => i.type === 'spell');
    if (identifiers.length) validSpells.filter(i => identifiers.includes(documentUtils.getIdentifier(i)));
    validSpells = validSpells.filter(i => i.system.method != 'spell' || i.system.level === 0 || i.system.prepared);
    validSpells = validSpells.filter(i => !i.system.hasLimitedUses || i.system.uses.value);
    validSpells = validSpells.filter(i => ['atwill', 'innate'].includes(i.system.method) || maxSlot >= i.system.level);
    validSpells = validSpells.filter(i => {
        const linkedActivity = i.system.linkedActivity;
        if (!linkedActivity) return true;
        for (const target of linkedActivity.consumption.targets ?? []) {
            if (target.type === 'itemUses') {
                let targetItem;
                if (!target.target?.length) {
                    targetItem = linkedActivity.item;
                } else {
                    targetItem = actor.items.get(target.target);
                }
                if (Number(targetItem?.system.uses.value ?? 0) < Number(target.value ?? 0)) return false;
            } else if (target.type === 'activityUses') {
                if (Number(linkedActivity.uses.value ?? 0) < Number(target.value ?? 0)) return false;
            } else if (target.type === 'material') {
                if (Number(actor.items.get(target.target)?.system.quantity ?? 0) < Number(target.value ?? 0)) return false;
            }
            return true;
        }
    });
    return validSpells;
}
function hasUsedReaction(actor) {
    return MidiQOL.hasUsedReaction(actor);
}
function getEquippedWeapons(actor) {
    return actor.items.filter(item => item.type === 'weapon' && item.system.equipped);
}
async function createActor(actorData) {
    const canCreate = game.user.hasPermission('ACTOR_CREATE');
    if (canCreate) {
        return Actor.create(actorData);
    } else {
        const uuid = await queryUtils.query('createActor', queryUtils.gmUser(), {actorData});
        return await fromUuid(uuid);
    }
}
export default {
    getCastData,
    getEffects,
    getGroups,
    getSavedCastData,
    getEncounterMembers,
    getEncounters,
    getVehicles,
    getTokens,
    getFirstToken,
    getEffectByIdentifier,
    getBestAbility,
    checkTrait,
    getEffectByStatusID,
    applyConditions,
    getItemByIdentifier,
    getEquivalentSpellSlotName,
    getCastableSpells,
    hasUsedReaction,
    getEquippedWeapons,
    createActor
};