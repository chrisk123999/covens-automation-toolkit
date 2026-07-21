/** @import Actor5e from '../../dnd5e/module/documents/actor/actor.mjs'; */
import {documentUtils, genericUtils, itemUtils, queryUtils} from '../utilities/_module.mjs';

/**
 * Get all applicable effects on an actor, optionally including item-applied enchantments (not by default).
 * @param {Actor5e} actor 
 * @param {object} [options]
 * @param {boolean} [options.includeItemEffects] 
 * @returns {ActiveEffect[]}
 */
function getEffects(actor, {includeItemEffects = false} = {}) {
    const effects = Array.from(actor.allApplicableEffects());
    if (!includeItemEffects) return effects;
    const enchantmentEffects = actor.items.contents.flatMap(item => item.effects.contents).filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment);
    return [...effects, ...enchantmentEffects];
}

/**
 * Get all Group actors in the world which contain this actor as a member.
 * @param {Actor5e} actor 
 * @returns {Actor5e[]}
 */
function getGroups(actor) {
    return game.actors.filter(a => a.type === 'group' && a.system.members.ids.has(actor.id));
}

/**
 * Get CAT-flagged cast data on an actor.
 * @param {Actor5e} actor 
 * @returns {{castLevel?: number; baseLevel?: number; saveDC?: number}|undefined}
 */
function getSavedCastData(actor) {
    return actor.flags.cat?.castData;
}

/**
 * Given an Encounter actor, get all unique base actors of the Encounter; quantity is ignored.
 * @param {Actor5e} actor 
 * @returns {Actor5e[]}
 */
async function getEncounterMembers(actor) {
    return (await Promise.all(actor.system.members.uuids.map(uuid => fromUuid(uuid)))).filter(i => i);
}

/**
 * Get all Encounter actors in the world which contain this actor as a member.
 * @param {Actor5e} actor 
 * @returns {Actor5e[]}
 */
function getEncounters(actor) {
    return game.actors.filter(a => a.type === 'encounter' && a.system.members.uuids.has(actor.uuid));
}

/**
 * Get all Vehicle actors in the world which contain this actor in any of the provided positions.
 * Default positions are any of "crew", "passenger", and "draft"
 * @param {Actor5e} actor 
 * @param {object} [options]
 * @param {string[]} [options.positions] 
 * @returns 
 */
function getVehicles(actor, {positions = ['crew', 'passenger', 'draft']} = {}) {
    return game.actors.filter(a => {
        if (a.type !== 'vehicle') return false;
        if (positions.includes('crew') && a.system.crew.value.includes(actor.uuid)) return true;
        if (positions.includes('passenger') && a.system.passengers.value.includes(actor.uuid)) return true;
        if (positions.includes('draft') && a.system.draft.value.includes(actor.uuid)) return true;
        return false;
    });
}

/**
 * Get all active tokens representing this actor in the current scene.
 * @param {Actor5e} actor 
 * @returns {TokenDocument[]}
 */
function getTokens(actor) {
    return actor.getActiveTokens(false, true);
}

/**
 * Get the first active token representing this actor in the current scene.
 * @param {Actor5e} actor 
 * @returns {TokenDocument|undefined}
 */
function getFirstToken(actor) {
    return getTokens(actor)[0];
}

/**
 * Get the first effect applicable to this actor which matches the provided identifier.
 * @param {Actor5e} actor 
 * @param {string} identifier 
 * @returns {ActiveEffect|undefined}
 */
function getEffectByIdentifier(actor, identifier) {
    return getEffects(actor).find(i => documentUtils.getIdentifier(i) === identifier);
}

/**
 * Get this actor's best ability by modifier, provided a list of ability keys.
 * @param {Actor5e} actor 
 * @param {string[]} abilities
 * @returns {string}
 */
function getBestAbility(actor, abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    return abilities.reduce((best, key) => {
        if (!actor.system.abilities[key]) return best;
        return actor.system.abilities[key].mod > actor.system.abilities[best].mod ? key : best;
    });
}

/**
 * Check whether this actor has the trait of the given type.
 * @param {Actor5e} actor   The actor to check
 * @param {string} type     Trait type (e.g. "dr" for damage resistance)
 * @param {string} trait    Trait value (e.g. "fire" for resistance to fire)
 * @returns {boolean}
 */
function checkTrait(actor, type, trait) {
    return !!actor.system.traits?.[type]?.value?.has(trait);
}

/**
 * Get the active effect created explicitly to convey a given status effect on this actor, if any.
 * @param {Actor5e} actor 
 * @param {string} id 
 * @returns {ActiveEffect|undefined}
 */
function getEffectByStatusID(actor, id) {
    return getEffects(actor).find(i => i.id === CONFIG.statusEffects.find(j => j.id === id)?._id);
}

/**
 * Get an item (or all items) on this actor which match the provided identifier.
 * @param {Actor5e} actor 
 * @param {string} identifier 
 * @param {object} [options]
 * @param {boolean} [options.multiple]  Whether to return all items matching the identifier (default false)
 * @returns {Item|Item[]|undefined}
 */
function getItemByIdentifier(actor, identifier, {multiple = false} = {}) {
    const predicate = item => documentUtils.getIdentifier(item) === identifier;
    return multiple ? actor.items.filter(predicate) : actor.items.find(predicate);
}

/**
 * Create active effects on this actor for each provided condition id, unless the actor is immune or already has
 * a dedicated effect for conveying the condition.
 * @param {Actor5e} actor 
 * @param {string[]} conditions 
 * @param {object} [options]
 * @param {boolean} [options.overlay]   Whether to show the icon as an overlay (default false)
 * @returns {Promise<ActiveEffect>}
 */
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

/**
 * Get the slot name (e.g. "spell2") corresponding to a given cast level.
 * @param {Actor5e} actor 
 * @param {number} level 
 * @param {object} [options]
 * @param {boolean} [options.canCast]   Whether to return only if the actor is able to cast a spell of this slot (default false)
 * @returns {string|undefined}
 */
function getEquivalentSpellSlotName(actor, level, {canCast = false} = {}) {
    if (!canCast) {
        return Object.entries(actor.system.spells)?.find(i => i[1].level == level)?.[0];
    } else {
        return Object.entries(actor.system.spells)?.find(i => i[1].level >= level && i[1].value)?.[0];
    }
}

/**
 * Get all spells which are currently castable by the actor, considering each spell's consumption, optionally
 * filtering by a list of provided identifiers.
 * @param {Actor5e} actor 
 * @param {object} [options]
 * @param {string[]} [options.identifiers] 
 * @returns {Item[]}
 */
function getCastableSpells(actor, {identifiers = []} = {}) {
    let validSpells = actor.items.filter(i => i.type === 'spell');
    if (identifiers.length) validSpells = validSpells.filter(i => identifiers.includes(documentUtils.getIdentifier(i)));
    return validSpells.filter(i => itemUtils.canCast(i));
}

/**
 * Return whether this actor has used their reaction.
 * @param {Actor5e} actor 
 * @returns {boolean}
 */
function hasUsedReaction(actor) {
    return MidiQOL.hasUsedReaction(actor);
}

/**
 * Return whether this actor has used their bonus action.
 * @param {Actor5e} actor 
 * @returns {boolean}
 */
function hasUsedBonusAction(actor) {
    return MidiQOL.hasUsedBonusAction(actor);
}

/**
 * Get all equipped weapons on this actor.
 * @param {Actor5e} actor 
 * @returns {Item[]}
 */
function getEquippedWeapons(actor) {
    return actor.items.filter(item => item.type === 'weapon' && item.system.equipped);
}

/**
 * Given actor data, create an actor. Socket to the GM if necessary.
 * @param {object} actorData 
 * @returns {Actor5e}
 */
async function createActor(actorData) {
    const canCreate = game.user.hasPermission('ACTOR_CREATE');
    if (canCreate) {
        return Actor.implementation.create(actorData);
    } else {
        const uuid = await queryUtils.query('createActor', queryUtils.gmUser(), {actorData});
        return await fromUuid(uuid);
    }
}
function getMaxCastLevel(actor) {
    const spells = actor.system.spells;
    const pactLevel = (spells.pact && spells.pact.max > 0) ? (spells.pact.level || 0) : 0;
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((currentMax, i) => {
        const slot = spells['spell' + i];
        return (slot && slot.max > 0) ? Math.max(currentMax, i) : currentMax;
    }, pactLevel);
}
export default {
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
    createActor,
    hasUsedBonusAction,
    getMaxCastLevel
};