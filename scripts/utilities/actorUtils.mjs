/**
 * Actor lookups and changes: effects, items, tokens, traits, spell slots, conditions, action economy and group
 * membership.
 * @module
 */
/** @import Actor5e from '../../dnd5e/module/documents/actor/actor.mjs'; */
import {constants} from '../lib/_module.mjs';
import {automationUtils, dialogUtils, distanceUtils, documentUtils, effectUtils, genericUtils, itemUtils, queryUtils} from '../utilities/_module.mjs';

/**
 * Get every effect that applies to an actor, including effects transferred from its items. With `includeItemEffects`,
 * enchantments applied to the actor's items are added at the end.
 * @param {Actor5e} actor                         Actor to read from.
 * @param {object} [options]                      Additional options.
 * @param {boolean} [options.includeItemEffects]  Also include applied enchantments on the actor's items.
 * @returns {ActiveEffect[]}
 * @example
 * const effects = actorUtils.getEffects(actor, {includeItemEffects: true});
 */
function getEffects(actor, {includeItemEffects = false} = {}) {
    const effects = Array.from(actor.allApplicableEffects());
    if (!includeItemEffects) return effects;
    const enchantmentEffects = actor.items?.contents.flatMap(item => item.effects.contents).filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment) ?? [];
    return [...effects, ...enchantmentEffects];
}

/**
 * Get every world Group actor that lists this actor as a member.
 * @param {Actor5e} actor  Actor to look for.
 * @returns {Actor5e[]}
 * @example
 * const party = actorUtils.getGroups(actor)[0];
 */
function getGroups(actor) {
    return game.actors.filter(a => a.type === 'group' && a.system.members.ids.has(actor.id));
}

/**
 * Get the cast data CAT stored in the actor's `cat.castData` flag.
 * @param {Actor5e} actor  Actor to read from.
 * @returns {{castLevel?: number; baseLevel?: number; saveDC?: number}|undefined}
 *                         Undefined when no cast data is stored.
 * @example
 * const castLevel = actorUtils.getSavedCastData(actor)?.castLevel;
 */
function getSavedCastData(actor) {
    return actor.flags.cat?.castData;
}

/**
 * Resolve the member actors of an Encounter actor. Each member appears once regardless of its quantity, and members
 * whose uuid no longer resolves are dropped.
 * @param {Actor5e} actor  Encounter actor.
 * @returns {Promise<Actor5e[]>}
 * @example
 * const members = await actorUtils.getEncounterMembers(encounter);
 */
async function getEncounterMembers(actor) {
    return (await Promise.all(actor.system.members.uuids.map(uuid => fromUuid(uuid)))).filter(i => i);
}

/**
 * Get every world Encounter actor that lists this actor as a member.
 * @param {Actor5e} actor  Actor to look for.
 * @returns {Actor5e[]}
 * @example
 * const encounters = actorUtils.getEncounters(actor);
 */
function getEncounters(actor) {
    return game.actors.filter(a => a.type === 'encounter' && a.system.members.uuids.has(actor.uuid));
}

/**
 * Get every world Vehicle actor that holds this actor in one of the given positions. All three positions are checked by
 * default.
 * @param {Actor5e} actor                 Actor to look for.
 * @param {object} [options]              Additional options.
 * @param {string[]} [options.positions]  Any of `crew`, `passenger` and `draft`.
 * @returns {Actor5e[]}
 * @example
 * const ships = actorUtils.getVehicles(actor, {positions: ['crew']});
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
 * Get the actor's tokens on the viewed scene, as documents. An unlinked token's actor returns only its own token.
 * @param {Actor5e} actor      Actor to look for.
 * @returns {TokenDocument[]}  Empty when the actor has no token on the scene.
 * @example
 * const tokens = actorUtils.getTokens(actor);
 */
function getTokens(actor) {
    return actor.getActiveTokens(false, true);
}

/**
 * Get the first of the actor's tokens on the viewed scene. See {@link getTokens}.
 * @param {Actor5e} actor              Actor to look for.
 * @returns {TokenDocument|undefined}  Undefined when the actor has no token on the scene.
 * @example
 * const token = actorUtils.getFirstToken(item.actor);
 * if (!token) return;
 */
function getFirstToken(actor) {
    return getTokens(actor)[0];
}

/**
 * Find the effect on an actor with the given CAT identifier, or every match with `multiple`. Searches the effects from
 * {@link getEffects}, without item enchantments.
 * @param {Actor5e} actor                            Actor to search.
 * @param {string} identifier                        Identifier to match.
 * @param {object} [options]                         Additional options.
 * @param {boolean} [options.multiple]               Return every matching effect as an array.
 * @returns {ActiveEffect|ActiveEffect[]|undefined}  Undefined when nothing matches and `multiple` is off.
 * @example
 * const effect = actorUtils.getEffectByIdentifier(actor, 'hex');
 * if (effect) await documentUtils.deleteDocument(effect);
 */
function getEffectByIdentifier(actor, identifier, {multiple = false} = {}) {
    const effects = getEffects(actor);
    const predicate = item => documentUtils.getIdentifier(item) === identifier;
    return multiple ? effects.filter(predicate) : effects.find(predicate);
}

/**
 * Pick the ability with the highest modifier from a list. Ties go to the earlier key, keys the actor doesn't have are
 * skipped, and the first key is returned when none exist.
 * @param {Actor5e} actor         Actor to read from.
 * @param {string[]} [abilities]  Ability keys to compare. Defaults to all six.
 * @returns {string}              Ability key.
 * @example
 * const ability = actorUtils.getBestAbility(actor, ['str', 'dex']);
 */
function getBestAbility(actor, abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    return abilities.reduce((best, key) => {
        if (!actor.system.abilities[key]) return best;
        return best === undefined || actor.system.abilities[key].mod > actor.system.abilities[best].mod ? key : best;
    }, undefined) ?? abilities[0];
}
/**
 * Pick the ability with the highest saving throw bonus from a list. Ties go to the earlier key, keys the actor doesn't
 * have are skipped, and the first key is returned when none exist.
 * @param {Actor5e} actor         Actor to read from.
 * @param {string[]} [abilities]  Ability keys to compare. Defaults to all six.
 * @returns {string}              Ability key.
 * @example
 * const save = actorUtils.getBestSave(actor, ['con', 'wis']);
 */
function getBestSave(actor, abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    return abilities.reduce((best, key) => {
        if (!actor.system.abilities[key]) return best;
        return best === undefined || actor.system.abilities[key].save.value > actor.system.abilities[best].save.value ? key : best;
    }, undefined) ?? abilities[0];
}
/**
 * Pick the skill with the highest total bonus from a list. Ties go to the earlier key, keys the actor doesn't have are
 * skipped, and the first key is returned when none exist.
 * @param {Actor5e} actor      Actor to read from.
 * @param {string[]} [skills]  Skill keys to compare. Defaults to every skill in `CONFIG.DND5E.skills`.
 * @returns {string}           Skill key.
 * @example
 * const skill = actorUtils.getBestSkill(actor, ['ath', 'acr']);
 */
function getBestSkill(actor, skills = Object.keys(CONFIG.DND5E.skills)) {
    return skills.reduce((best, key) => {
        if (!actor.system.skills[key]) return best;
        return best === undefined || actor.system.skills[key].total > actor.system.skills[best].total ? key : best;
    }, undefined) ?? skills[0];
}
/**
 * Pick the tool with the highest check bonus from a list. A tool the actor has no proficiency entry for uses the
 * modifier of its default ability. Ties go to the earlier key, and the first key is returned when none can be scored.
 * @param {Actor5e} actor     Actor to read from.
 * @param {string[]} [tools]  Tool keys to compare. Defaults to every tool in `CONFIG.DND5E.tools`.
 * @returns {string}          Tool key.
 * @example
 * const tool = actorUtils.getBestTool(actor, ['thief', 'tinker']);
 */
function getBestTool(actor, tools = Object.keys(CONFIG.DND5E.tools)) {
    const getMod = key => actor.system.tools[key]?.total ?? actor.system.abilities[CONFIG.DND5E.tools[key]?.ability]?.mod;
    return tools.reduce((best, key) => {
        const mod = getMod(key);
        if (mod === undefined) return best;
        return best === undefined || mod > getMod(best) ? key : best;
    }, undefined) ?? tools[0];
}

/**
 * Whether the actor's trait set of the given type contains a value. Returns false when the actor has no such trait.
 * @param {Actor5e} actor  Actor to check.
 * @param {string} type    Trait type, such as `dr` for damage resistances or `ci` for condition immunities.
 * @param {string} trait   Trait value, such as `fire`.
 * @returns {boolean}
 * @example
 * if (actorUtils.checkTrait(actor, 'ci', 'frightened')) return;
 */
function checkTrait(actor, type, trait) {
    return !!actor.system.traits?.[type]?.value?.has(trait);
}
/**
 * Whether the actor has at least one unspent spell slot of `atLeast` level or higher. Pact slots count.
 * @param {foundry.documents.Actor} actor  Actor to check.
 * @param {number} [atLeast]               Minimum slot level. Defaults to any level.
 * @returns {boolean}
 * @example
 * if (!actorUtils.hasSpellSlots(actor, 1)) return;
 */
function hasSpellSlots(actor, atLeast = 0) {
    return Object.values(actor.system.spells).some(i => i.value && i.level >= atLeast);
}
/**
 * Get the actor's size, as a numeric rank by default or as the size key.
 * @param {foundry.documents.Actor} actor  Actor to read from.
 * @param {boolean} [returnString]         Return the size key, such as `med`, instead of the rank.
 * @returns {string|number}
 * @example
 * if (actorUtils.getSize(target.actor) > actorUtils.getSize(actor) + 1) return;
 */
function getSize(actor, returnString) {
    const traits = actor.system.traits;
    return returnString ? traits.size : traits.sizeNumeric;
}
/**
 * Get one of the actor's movement speeds in feet, converted from the actor's movement units.
 * @param {Actor5e} actor  Actor to read from.
 * @param {string} [type]  Movement type, such as `fly`, or `max` for the fastest. Defaults to `walk`.
 * @returns {number}       Speed in feet, or `0` when the actor lacks that movement type.
 * @example
 * const flySpeed = actorUtils.getSpeed(actor, 'fly');
 */
function getSpeed(actor, type = 'walk') {
    const movement = actor.system.attributes.movement;
    return distanceUtils.lengthToFeet(type === 'max' ? movement.max : movement.speeds?.[type], movement.units) ?? 0;
}
/**
 * Get one of the actor's sense ranges in feet, converted from the actor's sense units.
 * @param {Actor5e} actor  Actor to read from.
 * @param {string} sense   Sense key, such as `darkvision`.
 * @returns {number}       Range in feet, or `0` when the actor lacks the sense.
 * @example
 * const darkvision = actorUtils.getSense(actor, 'darkvision');
 */
function getSense(actor, sense) {
    const senses = actor.system.attributes.senses;
    return distanceUtils.lengthToFeet(senses.ranges?.[sense], senses.units) ?? 0;
}

/**
 * Get the effect created by toggling a status on the actor, matched by the status's fixed effect id. Effects that only
 * grant the status as one of several are not returned; see {@link getStatusSources}.
 * @param {Actor5e} actor  Actor to search.
 * @param {string} id      Status effect id, such as `prone`.
 * @returns {ActiveEffect|undefined}
 * @example
 * const prone = actorUtils.getEffectByStatusID(actor, 'prone');
 */
function getEffectByStatusID(actor, id) {
    return getEffects(actor).find(i => i.id === CONFIG.statusEffects[id]?._id);
}

/**
 * Get the effects responsible for any of the given statuses on the actor. When the status effect was created by DAE to
 * display a condition, the effects granting that condition are returned instead.
 * @param {Actor5e} actor               Actor to search.
 * @param {string[]} ids                Status effect ids to look for.
 * @returns {ActiveEffect[]|undefined}  Undefined when the actor has none of the statuses.
 * @example
 * const sources = actorUtils.getStatusSources(actor, ['grappled', 'restrained']);
 */
function getStatusSources(actor, ids) {
    const effects = getEffects(actor);
    const hasStatus = new Set();
    for (const condition of ids) {
        const effect = effects.find(i => i.id === CONFIG.statusEffects[condition]?._id);
        if (!effect) continue;
        if (effect.flags.dae?.autoCreated) {
            const sources = effects.filter(e => e.id !== effect.id && effectUtils.getConditions(e).has(condition));
            for (const s of sources) hasStatus.add(s);
        } else hasStatus.add(effect);
    }
    if (hasStatus.size) return Array.from(hasStatus);
}

/**
 * Whether the actor has an effect granting any of these statuses that `sourceActor` applied. The applier is resolved
 * from the effect's origin activity, item, actor or effect.
 * @param {foundry.documents.Actor} actor        Actor to check.
 * @param {string[]} statusIds                   Status ids to look for.
 * @param {foundry.documents.Actor} sourceActor  Actor that must have applied the effect.
 * @returns {boolean}
 * @example
 * if (!actorUtils.hasStatusFromActor(target.actor, ['frightened'], actor)) return;
 */
function hasStatusFromActor(actor, statusIds, sourceActor) {
    return getEffects(actor).some(effect => {
        const conditions = effectUtils.getConditions(effect);
        if (!statusIds.some(id => conditions.has(id))) return false;
        const origin = effectUtils.getOriginActivitySync(effect) ?? (effect.origin ? fromUuidSync(effect.origin, {strict: false}) : undefined);
        let originActor = origin?.actor;
        if (origin instanceof Actor) originActor = origin;
        else if (origin?.documentName === 'ActiveEffect') originActor = effectUtils.getActor(origin);
        return !!originActor && originActor.uuid === sourceActor.uuid;
    });
}

/**
 * Find the item on an actor with the given identifier, or every match with `multiple`. An unknown `type` searches every
 * item.
 * @param {Actor5e} actor               Actor to search.
 * @param {string} identifier           Identifier to match.
 * @param {object} [options]            Additional options.
 * @param {string} [options.type]       Item type to limit the search to, a key of `CONFIG.Item.typeLabels`.
 * @param {boolean} [options.multiple]  Return every matching item as an array.
 * @returns {Item|Item[]|undefined}     Undefined when nothing matches and `multiple` is off.
 * @example
 * const rage = actorUtils.getItemByIdentifier(actor, 'rage', {type: 'feat'});
 */
function getItemByIdentifier(actor, identifier, {multiple = false, type} = {}) {
    const predicate = item => documentUtils.getIdentifier(item) === identifier;
    let collection = actor.items;
    if (type && actor.itemTypes[type]) collection = actor.itemTypes[type];
    return multiple ? collection.filter(predicate) : collection.find(predicate);
}
/**
 * Find the item on an actor matching any of several identifiers, or every match with `multiple`. An unknown `type`
 * searches every item.
 * @param {Actor5e} actor               Actor to search.
 * @param {string[]} identifiers        Identifiers to match.
 * @param {object} [options]            Additional options.
 * @param {string} [options.type]       Item type to limit the search to, a key of `CONFIG.Item.typeLabels`.
 * @param {boolean} [options.multiple]  Return every matching item as an array.
 * @returns {Item|Item[]|undefined}     Undefined when nothing matches and `multiple` is off.
 * @example
 * const channelDivinity = actorUtils.getItemByIdentifiers(actor, ['channel-divinity', 'channel-divinity-paladin']);
 */
function getItemByIdentifiers(actor, identifiers, {multiple = false, type} = {}) {
    const predicate = item => identifiers.includes(documentUtils.getIdentifier(item));
    let collection = actor.items;
    if (type && actor.itemTypes[type]) collection = actor.itemTypes[type];
    return multiple ? collection.filter(predicate) : collection.find(predicate);
}

/**
 * Create the standard status effect for each condition on the actor. Conditions the actor is immune to, or already has
 * a status effect for, are skipped. Effects keep the status's fixed id.
 * @param {Actor5e} actor                        Actor to apply to.
 * @param {string[]} conditions                  Condition ids to apply.
 * @param {object} [options]                     Additional options.
 * @param {boolean} [options.overlay]            Show the status icon as a token overlay.
 * @returns {Promise<ActiveEffect[]|undefined>}  Created effects, or undefined when nothing was created.
 * @example
 * await actorUtils.applyConditions(target.actor, ['prone']);
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
 * Get the `system.spells` key, such as `spell2` or `pact`, for slots of exactly this level. With `canCast`, returns the
 * first key at this level or higher that still has a slot left.
 * @param {Actor5e} actor              Actor to read from.
 * @param {number} level               Spell level.
 * @param {object} [options]           Additional options.
 * @param {boolean} [options.canCast]  Require an unspent slot, allowing higher levels.
 * @returns {string|undefined}         Undefined when no slot qualifies.
 * @example
 * const slotKey = actorUtils.getEquivalentSpellSlotName(actor, 3, {canCast: true});
 */
function getEquivalentSpellSlotName(actor, level, {canCast = false} = {}) {
    if (!canCast) {
        return Object.entries(actor.system.spells)?.find(i => i[1].level == level)?.[0];
    } else {
        return Object.entries(actor.system.spells)?.find(i => i[1].level >= level && i[1].value)?.[0];
    }
}

/**
 * Find the `system.spells` key for a slot level, including pact slots. A value that is already a key, such as `pact`,
 * is returned as is.
 * @param {foundry.documents.Actor} actor  Actor to read from.
 * @param {number|string} level            Spell level or slot key.
 * @returns {string|undefined}             Undefined when the actor has no spell slots or none of that level.
 * @example
 * actorUtils.getSpellSlotKey(actor, 2); // 'spell2'
 */
function getSpellSlotKey(actor, level) {
    if (!actor.system.spells) return;
    if (actor.system.spells[level]) return level;
    return Object.entries(actor.system.spells).find(i => i[1].level == level)?.[0];
}

/**
 * Spend spell slots of a level or slot key, resolved with {@link getSpellSlotKey}. The remaining count is clamped
 * between `0` and the slot maximum. Nothing is updated when the count would not change.
 * @param {Actor5e} actor                 Actor to update.
 * @param {number|string} level           Spell level or slot key, such as `2` or `pact`.
 * @param {object} [options]              Additional options.
 * @param {number} [options.amount]       Number of slots to spend. Defaults to `1`.
 * @returns {Promise<Actor5e|undefined>}  The updated actor, or undefined when nothing changed.
 * @example
 * await actorUtils.spendSpellSlots(actor, workflow.castData.castLevel);
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
 * Recover spell slots of a level or slot key, never above the slot maximum. Inverse of {@link spendSpellSlots}.
 * @param {Actor5e} actor                 Actor to update.
 * @param {number|string} level           Spell level or slot key, such as `2` or `pact`.
 * @param {object} [options]              Additional options.
 * @param {number} [options.amount]       Number of slots to recover. Defaults to `1`.
 * @returns {Promise<Actor5e|undefined>}  The updated actor, or undefined when nothing changed.
 * @example
 * await actorUtils.recoverSpellSlots(actor, 'pact', {amount: 2});
 */
async function recoverSpellSlots(actor, level, {amount = 1} = {}) {
    return await spendSpellSlots(actor, level, {amount: -amount});
}

/**
 * Spend the dice picked with {@link dialogUtils.selectHitDie} and roll them with the actor's roll data. Class hit dice
 * are spent from the class; other items spend their uses and roll their configured `diceSize`.
 * @param {Actor5e} actor           Actor whose roll data the roll uses.
 * @param {Array<{document: Item5e, amount: number}>|false} selections
 *                                  Result of {@link dialogUtils.selectHitDie}.
 * @param {object} [options]        Additional options.
 * @param {boolean} [options.roll]  Evaluate a roll of the spent dice. Defaults to true.
 * @returns {Promise<{count: number, formula: string, roll: Roll|undefined}>}
 *                                  Number of dice spent, their formula, and the evaluated roll. Formula is empty and
 *                                  roll undefined when nothing was spent.
 * @example
 * const selections = await dialogUtils.selectHitDie(actor);
 * const {roll} = await actorUtils.spendHitDice(actor, selections);
 */
async function spendHitDice(actor, selections, {roll = true} = {}) {
    const spent = (selections || []).filter(selection => selection.amount > 0);
    const dice = spent.map(({document, amount}) => {
        const denomination = document.type === 'class' ? document.system.hd.denomination : automationUtils.getConfigValue(document, 'diceSize');
        const faces = String(denomination ?? '').toLowerCase().match(/d(\d+)$/)?.[1];
        return faces ? amount + 'd' + faces : undefined;
    }).filter(Boolean);
    await Promise.all(spent.map(({document, amount}) => {
        if (document.type === 'class') return documentUtils.update(document, {'system.hd.spent': document.system.hd.spent + amount});
        return documentUtils.update(document, {'system.uses.spent': document.system.uses.spent + amount});
    }));
    const count = spent.reduce((total, selection) => total + selection.amount, 0);
    const formula = dice.join(' + ');
    if (!roll || !formula) return {count, formula, roll: undefined};
    return {count, formula, roll: await new Roll(formula, actor.getRollData()).evaluate()};
}

/**
 * Get the actor's spells that it can cast right now, as decided by {@link itemUtils.canCast}. Pass `identifiers` to
 * check only those spells.
 * @param {Actor5e} actor                   Actor to search.
 * @param {object} [options]                Additional options.
 * @param {string[]} [options.identifiers]  Only spells with these identifiers.
 * @returns {Item[]}
 * @example
 * const spells = actorUtils.getCastableSpells(actor, {identifiers: ['shield', 'absorb-elements']});
 */
function getCastableSpells(actor, {identifiers = []} = {}) {
    let validSpells = actor.items.filter(i => i.type === 'spell');
    if (identifiers.length) validSpells = validSpells.filter(i => identifiers.includes(documentUtils.getIdentifier(i)));
    return validSpells.filter(i => itemUtils.canCast(i));
}

/**
 * Whether the actor cannot take a reaction: midi records its reaction as used, or it has the system's No Reactions
 * effect.
 * @param {Actor5e} actor  Actor to check.
 * @returns {boolean}
 * @example
 * if (actorUtils.hasUsedReaction(target.actor)) return;
 */
function hasUsedReaction(actor) {
    return MidiQOL.hasUsedReaction(actor) || hasNoReactions(actor);
}
/**
 * Whether the actor has the system's No Reactions effect, matched by its compendium source or icon.
 * @param {Actor5e} actor  Actor to check.
 * @returns {boolean}
 */
function hasNoReactions(actor) {
    return actor.appliedEffects.some(effect => effect._stats?.compendiumSource === constants.noReactionsEffect || effect.img === constants.noReactionsIcon);
}
/**
 * Get the actor's creature type through midi, falling back to its race.
 * @param {foundry.documents.Actor} actor  Actor to read from.
 * @returns {string}
 * @example
 * if (actorUtils.typeOrRace(target.actor) === 'undead') return;
 */
function typeOrRace(actor) {
    return MidiQOL.typeOrRace(actor);
}

/**
 * Mark the actor's reaction as used through midi.
 * @param {foundry.documents.Actor} actor  Actor to update.
 * @returns {Promise<void>}
 * @example
 * await actorUtils.setReactionUsed(actor);
 */
async function setReactionUsed(actor) {
    return await MidiQOL.setReactionUsed(actor);
}

/**
 * Raise the actor's exhaustion level, capped at the system's highest level. Nothing is updated when the level would not
 * change.
 * @param {Actor5e} actor                 Actor to update.
 * @param {number} [amount]               Levels to add. Defaults to `1`.
 * @returns {Promise<Actor5e|undefined>}  Undefined when no update was made.
 * @example
 * await actorUtils.addExhaustion(target.actor);
 */
async function addExhaustion(actor, amount = 1) {
    const current = actor.system.attributes.exhaustion ?? 0;
    const exhaustion = Math.min(current + amount, CONFIG.DND5E.conditionTypes.exhaustion?.levels ?? 6);
    if (exhaustion !== current) return await documentUtils.update(actor, {'system.attributes.exhaustion': exhaustion});
}

/**
 * Whether midi records the actor's bonus action as used.
 * @param {Actor5e} actor  Actor to check.
 * @returns {boolean}
 * @example
 * if (actorUtils.hasUsedBonusAction(actor)) return;
 */
function hasUsedBonusAction(actor) {
    return MidiQOL.hasUsedBonusAction(actor);
}

/**
 * Mark the actor's bonus action as used through midi.
 * @param {foundry.documents.Actor} actor  Actor to update.
 * @returns {Promise<void>}
 * @example
 * await actorUtils.setBonusActionUsed(actor);
 */
async function setBonusActionUsed(actor) {
    return await MidiQOL.setBonusActionUsed(actor);
}

/**
 * Ask a user to spend the actor's bonus action with {@link dialogUtils.confirm}, and mark it used on yes. Returns false
 * without asking when the bonus action is already used.
 * @param {Actor5e} actor            Actor whose bonus action is spent.
 * @param {string} title             Window title.
 * @param {string} content           Prompt text.
 * @param {object} [options]         Additional options.
 * @param {string} [options.userId]  User the dialog is shown to.
 * @returns {Promise<boolean>}       Whether the bonus action was spent.
 * @example
 * const userId = queryUtils.firstOwner(actor, true);
 * if (!await actorUtils.confirmBonusAction(actor, item.name, 'Use your bonus action?', {userId})) return;
 */
async function confirmBonusAction(actor, title, content, {userId} = {}) {
    if (hasUsedBonusAction(actor) || !await dialogUtils.confirm(title, content, {userId})) return false;
    await setBonusActionUsed(actor);
    return true;
}

/**
 * Whether CAT's Weapon Mastery setting applies masteries to this actor. The setting can cover player characters, NPCs
 * or both, and characters are actors of type `character`.
 * @param {Actor5e} actor  Actor to check.
 * @returns {boolean}
 * @example
 * if (!actorUtils.isMasteryEnabled(actor)) return;
 */
function isMasteryEnabled(actor) {
    const setting = game.settings.get('cat', 'weaponMastery');
    const isCharacter = actor?.type === 'character';
    return setting === 'both' || (setting === 'pc' && isCharacter) || (setting === 'npc' && !isCharacter);
}

/**
 * Get the actor's equipped weapon items.
 * @param {Actor5e} actor  Actor to search.
 * @returns {Item[]}
 * @example
 * const weapons = actorUtils.getEquippedWeapons(actor);
 */
function getEquippedWeapons(actor) {
    return actor.items.filter(item => item.type === 'weapon' && item.system.equipped);
}

/**
 * Create a world actor. Users without permission to create actors have a GM create it through {@link queryUtils.query}.
 * @param {object} actorData  Actor creation data.
 * @returns {Promise<Actor5e>}
 * @example
 * const summon = await actorUtils.createActor(sourceActor.toObject());
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
 * Get the highest level of spell slot the actor has, counting pact slots. Spent slots still count.
 * @param {foundry.documents.Actor} actor  Actor to read from.
 * @returns {number}                       Zero when the actor has no slots.
 * @example
 * const maxLevel = actorUtils.getMaxCastLevel(actor);
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
 * Get the actor's challenge rating. Actors without one, such as player characters, get `4 × proficiency bonus - 7`.
 * @param {foundry.documents.Actor} actor  Actor to read from.
 * @returns {number}
 * @example
 * // A character with a +3 proficiency bonus
 * actorUtils.getCR(actor); // 5
 */
function getCR(actor) {
    return actor.system.details.cr ?? (4 * actor.system.attributes.prof - 7);
}
/**
 * Get the actor's character level, or its challenge rating when it has no levels.
 * @param {foundry.documents.Actor} actor  Actor to read from.
 * @returns {number}                       Zero when the actor has neither.
 * @example
 * const level = actorUtils.getLevelOrCR(target.actor);
 */
function getLevelOrCR(actor) {
    return actor.system.details.level || actor.system.details.cr || 0;
}
/**
 * Add items or activities to the actor's sheet favorites. A GM does it through {@link queryUtils.query} when the user
 * does not own the actor. Does nothing for actor types without favorites.
 * @param {foundry.documents.Actor} actor                    Actor to update.
 * @param {Array<foundry.documents.Item|Activity>} entities  Items or activities to add.
 * @returns {Promise<void>}
 * @example
 * await actorUtils.addFavorites(actor, [item]);
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
 * Remove items or activities from the actor's sheet favorites. A GM does it through {@link queryUtils.query} when the
 * user does not own the actor. Does nothing for actor types without favorites.
 * @param {foundry.documents.Actor} actor                    Actor to update.
 * @param {Array<foundry.documents.Item|Activity>} entities  Items or activities to remove.
 * @returns {Promise<void>}
 * @example
 * await actorUtils.removeFavorites(actor, [item]);
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
/**
 * Whether the actor's hit points are at or below half its effective maximum, rounded down.
 * @param {Actor5e} actor  Actor to check.
 * @returns {boolean}
 * @example
 * const bloodied = workflow.targets.filter(target => actorUtils.isBloodied(target.actor));
 */
function isBloodied(actor) {
    return actor.system.attributes.hp.value <= Math.floor(actor.system.attributes.hp.effectiveMax / 2);
}
/**
 * Whether the actor's hit points are below its effective maximum.
 * @param {Actor5e} actor  Actor to check.
 * @returns {boolean}
 * @example
 * const wounded = workflow.targets.filter(target => actorUtils.isWounded(target.actor));
 */
function isWounded(actor) {
    return actor.system.attributes.hp.value < actor.system.attributes.hp.effectiveMax;
}
/**
 * Whether the actor has one of these tools, either as a tool item of that base type or as a check activity on another
 * item tied to the tool. Only equipped items count by default.
 * @param {Actor5e} actor               Actor to search.
 * @param {string[]} baseItems          Tool keys from `CONFIG.DND5E.tools`.
 * @param {object} [options]            Additional options.
 * @param {boolean} [options.equipped]  Only count equipped items. Defaults to true.
 * @returns {boolean}
 * @example
 * if (!actorUtils.hasTools(actor, ['thief'])) return;
 */
function hasTools(actor, baseItems, {equipped = true} = {}) {
    return actor.items.some(item => (!equipped || item.system.equipped) && ((item.type === 'tool' && baseItems.includes(item.system.type?.baseItem))
        || item.system.activities?.some(activity => activity.type === 'check' && baseItems.some(tool => activity.check.associated.has(tool)))));
}
export default {
    hasTools,
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
    getSpeed,
    getSense,
    getEffectByStatusID,
    applyConditions,
    getItemByIdentifier,
    getItemByIdentifiers,
    getEquivalentSpellSlotName,
    getSpellSlotKey,
    spendSpellSlots,
    recoverSpellSlots,
    spendHitDice,
    getCastableSpells,
    hasUsedReaction,
    hasNoReactions,
    setReactionUsed,
    addExhaustion,
    typeOrRace,
    getEquippedWeapons,
    createActor,
    hasUsedBonusAction,
    setBonusActionUsed,
    confirmBonusAction,
    isMasteryEnabled,
    getMaxCastLevel,
    getCR,
    getLevelOrCR,
    addFavorites,
    removeFavorites,
    isBloodied,
    isWounded,
    getStatusSources,
    hasStatusFromActor
};
