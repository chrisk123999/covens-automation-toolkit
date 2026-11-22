/**
 * Summon creation, placement and lookups. A summon is a linked sidebar actor copied from a source actor and tracked as
 * a `Summon` with its owner, source item and duration.
 * @module
 */
import {constants} from '../lib/_module.mjs';
import {documentUtils} from './_module.mjs';
/**
 * Create a summon's sidebar actor, ready to be placed on the canvas with {@link placeSummon} or {@link spawnSummon}.
 * The actor is copied from the source actor, linked to its token, given the owner's ownership and filed in a summons
 * folder for the owner. The summon's `preCreate` and `create` passes run. With `parent`, the actor depends on it and is
 * deleted with it.
 * @param {Actor5e} ownerActor                                  Actor the summon belongs to.
 * @param {Actor5e} sourceActor                                 Actor the summon is copied from.
 * @param {object} [options]                                    Additional options.
 * @param {number} [options.created]                            World time the summon was created at, used for its
 *                                                              duration. Defaults to the current world time.
 * @param {number} [options.duration]                           Seconds the summon lasts, plus 6 more. It is deleted
 *                                                              once that time passes. Without one it lasts until
 *                                                              dismissed.
 * @param {object} [options.animation]                          Animation played when it is placed and removed.
 * @param {number} [options.placeAlpha]                         Opacity the token fades in from when placed.
 * @param {string} [options.avatarImg]                          Replaces the source actor's portrait.
 * @param {string} [options.tokenImg]                           Replaces the source actor's token image.
 * @param {string} [options.name]                               Replaces the source actor's name.
 * @param {object} [options.updates]                            Merged over the created actor's data.
 * @param {number} [options.disposition]                        Token disposition. Defaults to the owner's.
 * @param {foundry.abstract.Document} [options.parent]          Document the summon depends on, such as a concentration
 *                                                              effect.
 * @param {foundry.abstract.Document} [options.sourceDocument]  Item or activity that summoned it.
 * @param {object} [options.sounds]                             Sounds played when it is placed, removed and killed.
 * @param {object[]} [options.items]                            Items added to the summon, as item data or `{uuid}`
 *                                                              entries. A source actor item with the same identifier is
 *                                                              replaced.
 * @param {'follows'|'separate'|'standard'} [options.initiative]
 *                                                              How the summon takes its turn.
 * @param {boolean} [options.dismissAtZero]                     Prompt to dismiss the summon when it drops to zero hit
 *                                                              points.
 * @param {string} [options.size]                               Creature size key, such as `lg`. Sets the actor's size
 *                                                              and resizes its token.
 * @param {number} [options.scale]                              Token image scale. Replaces the scale set by `size`.
 * @param {boolean} [options.lockRotation]                      Lock the token's rotation.
 * @param {boolean} [options.ring]                              Enable the dynamic token ring.
 * @param {string} [options.identifier]                         Summon identifier. Defaults to the source actor's.
 * @param {object} [options.workflowOptions]                    Workflow options of the use that summoned it, readable
 *                                                              by summon passes as `summon.workflowOptions`. Not saved
 *                                                              on the actor, so they are gone after a reload.
 * @returns {Promise<Summon>}                                   The summon, whose token is placed separately.
 * @example
 * const summon = await summonUtils.createSummon(actor, sourceActor, {duration: 3600, parent: effect, sourceDocument: activity, initiative: 'follows'});
 * await summonUtils.placeSummon(summon, 30);
 */
async function createSummon(ownerActor, sourceActor, {
    created = game.time.worldTime,
    duration,
    animation,
    placeAlpha,
    avatarImg,
    tokenImg,
    name,
    updates,
    disposition,
    parent,
    sourceDocument,
    sounds,
    items,
    initiative,
    dismissAtZero,
    size,
    scale,
    lockRotation,
    ring,
    identifier,
    workflowOptions
} = {}) {
    return await constants.summons.createSummon(ownerActor, sourceActor, created, {
        duration,
        animation,
        placeAlpha,
        avatarImg,
        tokenImg,
        name,
        updates,
        disposition,
        parent,
        sourceDocument,
        sounds,
        items,
        initiative,
        dismissAtZero,
        size,
        scale,
        lockRotation,
        ring,
        identifier,
        workflowOptions
    });
}
/**
 * Prompt a user to place a summon with a crosshair, then place it with {@link spawnSummon}. The crosshair only accepts
 * spaces the origin token can see. When the token can reach surfaces on other levels, the user picks a level first.
 * @param {Summon} summon                                    Summon to place.
 * @param {number} range                                     Range in feet the crosshair is bounded to.
 * @param {object} [options]                                 Additional options.
 * @param {Function} [options.preAnimation]                  Runs before the token appears.
 * @param {Function} [options.postAnimation]                 Runs after the token appears.
 * @param {number} [options.alpha]                           Opacity the token fades in from.
 * @param {foundry.documents.TokenDocument} [options.token]  Origin of the range check. Defaults to the owner's token.
 * @param {string} [options.userId]                          User who aims the crosshair, through a query to their
 *                                                           client. Defaults to the current user.
 * @returns {Promise<foundry.documents.TokenDocument|undefined>}
 *                                                           Undefined when the crosshair is cancelled, there is no
 *                                                           origin token or the summon is already on the canvas.
 * @example
 * const summonToken = await summonUtils.placeSummon(summon, 30, {token});
 * if (!summonToken) return;
 */
async function placeSummon(summon, range, {preAnimation, postAnimation, alpha, token, userId} = {}) {
    return await constants.summons.placeSummon(summon, range, {preAnimation, postAnimation, alpha, token, userId});
}
/**
 * Place a summon at a known position, without a crosshair. The token is created on the owner token's level and plays
 * the summon's animation. When the owner's combat has started and the summon's initiative is `follows` or `standard`,
 * it is added to the combat. The token's bars are hidden when the actor has no max hit points or 1000 or more.
 * @param {Summon} summon                     Summon to place.
 * @param {foundry.documents.Scene} scene     Scene to place it on.
 * @param {Point} location                    Top-left corner of the token, in canvas pixels.
 * @param {object} [options]                  Additional options.
 * @param {Function} [options.preAnimation]   Runs before the token appears.
 * @param {Function} [options.postAnimation]  Runs after the token appears.
 * @param {number} [options.alpha]            Opacity the token fades in from, up to fully opaque. Defaults to the
 *                                            summon's `placeAlpha`.
 * @param {number} [options.elevation]        Token elevation in scene units. Defaults to the owner token's.
 * @returns {Promise<foundry.documents.TokenDocument|undefined>}
 * @example
 * const {x, y} = token;
 * await summonUtils.spawnSummon(summon, canvas.scene, {x, y}, {elevation: token.elevation});
 */
async function spawnSummon(summon, scene, location, {preAnimation, postAnimation, alpha, elevation} = {}) {
    return await constants.summons.spawnSummon(summon, scene, location, {preAnimation, postAnimation, alpha, elevation});
}
/**
 * Delete a summon: its tokens on every scene, its actor, and documents its effects created on other actors or regions.
 * The owner's summons folder is deleted once it is empty. The summon's `preDelete` and `deleted` passes run. A summon
 * already being deleted is skipped.
 * @param {Summon} summon                     Summon to delete.
 * @param {object} [options]                  Additional options.
 * @param {Function} [options.preAnimation]   Runs before each token on the viewed scene is removed.
 * @param {Function} [options.postAnimation]  Runs after each token on the viewed scene is removed.
 * @returns {Promise<void>}
 * @example
 * await Promise.all(summonUtils.getSummonsBySource(item).map(summon => summonUtils.deleteSummon(summon)));
 */
async function deleteSummon(summon, {preAnimation, postAnimation} = {}) {
    return await constants.summons.deleteSummon(summon, {preAnimation, postAnimation});
}
/**
 * Remove a summon's token from the canvas, keeping its actor so it can be placed again. The summon's `remove` pass and
 * removal animation run. Does nothing when the summon has no token.
 * @param {Summon} summon                     Summon to remove.
 * @param {object} [options]                  Additional options.
 * @param {Function} [options.preAnimation]   Runs before the token is removed.
 * @param {Function} [options.postAnimation]  Runs after the token is removed.
 * @returns {Promise<void>}
 * @example
 * const summon = summonUtils.getSummonData(target.actor);
 * if (summon) await summonUtils.removeSummon(summon);
 */
function removeSummon(summon, {preAnimation, postAnimation} = {}) {
    return constants.summons.removeSummon(summon, {preAnimation, postAnimation});
}
/**
 * Every summon belonging to this actor whose summoned actor still exists, placed or not.
 * @param {Actor5e} actor  Actor whose summons are wanted.
 * @returns {Summon[]}
 * @example
 * const placed = summonUtils.getSummons(actor).filter(summon => summon.token);
 */
function getSummons(actor) {
    return constants.summons.getSummons(actor);
}
/**
 * The summon an actor is, rather than the summons it owns.
 * @param {Actor5e} actor       Actor to look up.
 * @returns {Summon|undefined}  Undefined when the actor is not a summon.
 * @example
 * const owner = summonUtils.getSummonData(target.actor)?.owner;
 */
function getSummonData(actor) {
    return constants.summons.getSummonData(actor);
}
/**
 * Every summon created by this item or activity, across all owners. Matches the exact document passed as
 * `sourceDocument`, so an item does not match summons created by its activities.
 * @param {foundry.abstract.Document} document  Item or activity that did the summoning.
 * @returns {Summon[]}                          Empty when no document is given.
 * @example
 * const summons = summonUtils.getSummonsBySource(activity);
 */
function getSummonsBySource(document) {
    return constants.summons.getSummonsBySource(document);
}
/**
 * Place several summons in turn with {@link placeSummon}. Summons already on the canvas are skipped, and placing stops
 * at the first one that is cancelled.
 * @param {Summon[]} summons                                 Summons to place.
 * @param {number} range                                     Range in feet each crosshair is bounded to.
 * @param {object} [options]                                 Additional options.
 * @param {foundry.documents.TokenDocument} [options.token]  Origin of the range check. Defaults to each summon's owner
 *                                                           token.
 * @param {string} [options.userId]                          User who aims the crosshairs. Defaults to the current user.
 * @returns {Promise<foundry.documents.TokenDocument[]|undefined>}
 *                                                           The tokens placed before stopping. Undefined when `summons`
 *                                                           is empty.
 * @example
 * const tokens = await summonUtils.placeSummons(summons, 60, {token});
 */
function placeSummons(summons, range, {token, userId} = {}) {
    return constants.summons.placeSummons(summons, range, {token, userId});
}
/**
 * Place every summon created by this item or activity with {@link placeSummons}, aimed by the current user. Summons
 * already on the canvas are skipped, and placing stops at the first one that is cancelled.
 * @param {foundry.abstract.Document} document               Item or activity that did the summoning.
 * @param {number} range                                     Range in feet each crosshair is bounded to.
 * @param {object} [options]                                 Additional options.
 * @param {foundry.documents.TokenDocument} [options.token]  Origin of the range check. Defaults to each summon's owner
 *                                                           token.
 * @returns {Promise<foundry.documents.TokenDocument[]|undefined>}
 *                                                           The tokens placed. Undefined when the document has no
 *                                                           summons.
 * @example
 * await summonUtils.placeAllSourceSummons(activity, 30, {token});
 */
async function placeAllSourceSummons(document, range, {token} = {}) {
    return await placeSummons(getSummonsBySource(document), range, {token});
}
/**
 * Take every summon created by this item or activity off the canvas with {@link removeSummon}, keeping their actors.
 * @param {foundry.abstract.Document} document  Item or activity that did the summoning.
 * @returns {Promise<void[]>}
 * @example
 * await summonUtils.recallAllSourceSummons(activity);
 */
async function recallAllSourceSummons(document) {
    return await Promise.all(getSummonsBySource(document).map(async summon => summon.recall()));
}
/**
 * Every summon with this identifier. A summon's identifier is the one given to {@link createSummon}, or the source
 * actor's identifier otherwise.
 * @param {string} identifier        Summon identifier to match.
 * @param {object} [options]         Additional options.
 * @param {Actor5e} [options.actor]  Only summons belonging to this actor.
 * @returns {Summon[]}
 * @example
 * const [familiar] = summonUtils.getSummonsByIdentifier('find-familiar', {actor});
 */
function getSummonsByIdentifier(identifier, {actor} = {}) {
    return constants.summons.getSummonsByIdentifier(identifier, {actor});
}
/**
 * Make documents depend on the `parent` a summoned actor was created with, such as its spell's concentration effect, so
 * they are deleted with it. Does nothing when the actor is not a summon or has no parent.
 * @param {Actor5e} actor                          Summoned actor.
 * @param {foundry.abstract.Document[]} documents  Documents to tie.
 * @returns {Promise<void>}
 * @example
 * await summonUtils.makeDependentOnParent(summonToken.actor, [region]);
 */
async function makeDependentOnParent(actor, documents) {
    const parent = getSummonData(actor)?.parent;
    if (parent && documents.length) await documentUtils.makeDependent(parent, documents);
}
export default {
    makeDependentOnParent,
    createSummon,
    placeSummon,
    spawnSummon,
    removeSummon,
    getSummons,
    getSummonData,
    deleteSummon,
    getSummonsBySource,
    placeSummons,
    placeAllSourceSummons,
    recallAllSourceSummons,
    getSummonsByIdentifier
};
