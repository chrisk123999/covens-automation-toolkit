/** @import Actor5e from '../../dnd5e/module/documents/actor/actor.mjs'; */
import {dataUtils, documentUtils, genericUtils, itemUtils, queryUtils} from '../utilities/_module.mjs';

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
 * Get the first (or all) effect applicable to this actor which matches the provided identifier.
 * @param {Actor5e} actor
 * @param {string} identifier
 * @param {object} [options]
 * @param {boolean} [options.multiple]  Whether to return all effects matching the identifier (default false)
 * @returns {ActiveEffect|ActiveEffect[]|undefined}
 */
function getEffectByIdentifier(actor, identifier, {multiple = false} = {}) {
    const effects = getEffects(actor);
    const predicate = item => documentUtils.getIdentifier(item) === identifier;
    return multiple ? effects.filter(predicate) : effects.find(predicate);
}

/**
 * Get this actor's best ability by modifier, provided a list of ability keys.
 * @param {Actor5e} actor
 * @param {string[]} [abilities]
 * @returns {string}
 */
function getBestAbility(actor, abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    return abilities.reduce((best, key) => {
        if (!actor.system.abilities[key]) return best;
        return actor.system.abilities[key].mod > actor.system.abilities[best].mod ? key : best;
    }, abilities[0]);
}
/**
 * Get this actor's best saving throw by modifier, provided a list of ability keys.
 * @param {Actor5e} actor
 * @param {string[]} [abilities]
 * @returns {string}
 */
function getBestSave(actor, abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    return abilities.reduce((best, key) => {
        if (!actor.system.abilities[key]) return best;
        return actor.system.abilities[key].save.value > actor.system.abilities[best].save.value ? key : best;
    }, abilities[0]);
}
/**
 * Get this actor's best skill by modifier, provided a list of skill keys.
 * @param {Actor5e} actor
 * @param {string[]} [skills]
 * @returns {string}
 */
function getBestSkill(actor, skills = Object.keys(CONFIG.DND5E.skills)) {
    return skills.reduce((best, key) => {
        if (!actor.system.skills[key]) return best;
        return actor.system.skills[key].total > actor.system.skills[best].total ? key : best;
    }, skills[0]);
}
/**
 * Get this actor's best tool by modifier, provided a list of tool keys.
 * @param {Actor5e} actor
 * @param {string[]} [tools]
 * @returns {string}
 */
function getBestTool(actor, tools = Object.keys(CONFIG.DND5E.tools)) {
    const getMod = key => actor.system.tools[key]?.total ?? actor.system.abilities[CONFIG.DND5E.tools[key].ability]?.mod;
    return tools.reduce((best, key) => {
        const mod = getMod(key);
        if (mod === undefined) return best;
        return mod > getMod(best) ? key : best;
    }, tools[0]);
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
 * Whether this actor has any spell slot available at or above a given level.
 * @param {foundry.documents.Actor} actor
 * @param {number} [atLeast] Minimum slot level.
 * @returns {boolean}
 */
function hasSpellSlots(actor, atLeast = 0) {
    return Object.values(actor.system.spells).some(i => i.value && i.level >= atLeast);
}
/**
 * Get this actor's size.
 * @param {foundry.documents.Actor} actor
 * @param {boolean} [returnString] Return the size key rather than its numeric rank.
 * @returns {string|number}
 */
function getSize(actor, returnString) {
    const traits = actor.system.traits;
    return returnString ? traits.size : traits.sizeNumeric;
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
 * @param {string|string[]} identifier A single identifier, or a list of aliases for the same thing.
 * @param {object} [options]
 * @param {string} [options.type] The item type to find. Possible values are the keys of CONFIG.Item.typeLabels.
 * @param {boolean} [options.multiple]  Whether to return all items matching the identifier (default false)
 * @returns {Item|Item[]|undefined}
 */
function getItemByIdentifier(actor, identifier, {multiple = false, type} = {}) {
    const identifiers = dataUtils.toArray(identifier);
    const predicate = item => identifiers.includes(documentUtils.getIdentifier(item));
    let collection = actor.items;
    if (type && actor.itemTypes[type]) collection = actor.itemTypes[type];
    return multiple ? collection.filter(predicate) : collection.find(predicate);
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
 * Find the `system.spells` key holding slots of a given level, including pact slots.
 * @param {foundry.documents.Actor} actor
 * @param {number|string} level
 * @returns {string|undefined}
 */
function getSpellSlotKey(actor, level) {
    if (!actor.system.spells) return;
    if (actor.system.spells[level]) return level;
    return Object.entries(actor.system.spells).find(i => i[1].level == level)?.[0];
}

/**
 * Spend spell slots of a given level or slot key (e.g. 2 or "pact").
 * @param {Actor5e} actor
 * @param {number|string} level
 * @param {object} [options]
 * @param {number} [options.amount]
 * @returns {Promise<void>}
 */
async function spendSpellSlots(actor, level, {amount = 1} = {}) {
    const key = getSpellSlotKey(actor, level);
    if (!key) return;
    const slot = actor.system.spells[key];
    const value = Math.clamp(slot.value - amount, 0, slot.max);
    if (value === slot.value) return;
    return await documentUtils.update(actor, {['system.spells.' + key + '.value']: value});
}

/**
 * Recover spell slots of a given level or slot key (e.g. 2 or "pact").
 * @param {Actor5e} actor
 * @param {number|string} level
 * @param {object} [options]
 * @param {number} [options.amount]
 * @returns {Promise<void>}
 */
async function recoverSpellSlots(actor, level, {amount = 1} = {}) {
    return await spendSpellSlots(actor, level, {amount: -amount});
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
 * Get this actor's creature type, falling back to its race.
 * @param {foundry.documents.Actor} actor
 * @returns {string}
 */
function typeOrRace(actor) {
    return MidiQOL.typeOrRace(actor);
}

/**
 * Mark this actor's reaction as used for the current round.
 * @param {foundry.documents.Actor} actor
 * @returns {Promise<void>}
 */
async function setReactionUsed(actor) {
    return await MidiQOL.setReactionUsed(actor);
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
/**
 * Get the highest spell slot level this actor has, counting pact slots.
 * @param {foundry.documents.Actor} actor
 * @returns {number} Zero when the actor has no slots.
 */
function getMaxCastLevel(actor) {
    const spells = actor.system.spells;
    const pactLevel = (spells.pact && spells.pact.max > 0) ? (spells.pact.level || 0) : 0;
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((currentMax, i) => {
        const slot = spells['spell' + i];
        return (slot && slot.max > 0) ? Math.max(currentMax, i) : currentMax;
    }, pactLevel);
}
/**
 * Get this actor's challenge rating, derived from proficiency when it has none.
 * @param {foundry.documents.Actor} actor
 * @returns {number}
 */
function getCR(actor) {
    return actor.system.details.cr ?? (4 * actor.system.attributes.prof - 7);
}
/**
 * Add items or activities to this actor's favorites, delegating to a GM when the user lacks permission.
 * @param {foundry.documents.Actor} actor
 * @param {Array<foundry.documents.Item|Activity>} entities
 * @returns {Promise<void>}
 */
async function addFavorites(actor, entities) {
    if (!actor?.system.addFavorite) return;
    if (queryUtils.hasPermission(actor, game.user.id)) {
        for (const entity of entities) {
            const type = entity.documentName;
            if (type === 'Item') {
                await actor.system.addFavorite({
                    id: foundry.utils.buildRelativeUuid(entity, entity.actor),
                    type: 'item'
                });
            } else if (type === 'Activity') {
                await actor.system.addFavorite({
                    id: entity.relativeUUID,
                    type: 'activity'
                });
            }
        }
    } else {
        await queryUtils.query('addFavorites', queryUtils.gmUser(), {actorUuid: actor.uuid, entityUuids: entities.map(e => e.uuid)});
    }
}
/**
 * Remove items or activities from this actor's favorites, delegating to a GM when the user lacks permission.
 * @param {foundry.documents.Actor} actor
 * @param {Array<foundry.documents.Item|Activity>} entities
 * @returns {Promise<void>}
 */
async function removeFavorites(actor, entities) {
    if (!actor?.system.removeFavorite) return;
    if (queryUtils.hasPermission(actor, game.user.id)) {
        for (const entity of entities) {
            const type = entity.documentName;
            if (type === 'Item') {
                await actor.system.removeFavorite(foundry.utils.buildRelativeUuid(entity, entity.actor));
            } else if (type === 'Activity') {
                await actor.system.removeFavorite(entity.relativeUUID);
            }
        }
    } else {
        await queryUtils.query('removeFavorites', queryUtils.gmUser(), {actorUuid: actor.uuid, entityUuids: entities.map(e => e.uuid)});
    }
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
    getBestSave,
    getBestSkill,
    getBestTool,
    checkTrait,
    hasSpellSlots,
    getSize,
    getEffectByStatusID,
    applyConditions,
    getItemByIdentifier,
    getEquivalentSpellSlotName,
    getSpellSlotKey,
    spendSpellSlots,
    recoverSpellSlots,
    getCastableSpells,
    hasUsedReaction,
    setReactionUsed,
    typeOrRace,
    getEquippedWeapons,
    createActor,
    hasUsedBonusAction,
    getMaxCastLevel,
    getCR,
    addFavorites,
    removeFavorites
};
