import {constants} from '../lib/_module.mjs';
/**
 * Create a summon's sidebar actor, ready to be placed on the canvas.
 * @param {Actor5e} ownerActor Actor the summon belongs to.
 * @param {Actor5e} sourceActor Actor the summon is copied from.
 * @param {object} [options] Additional options.
 * @param {number} [options.created] World time the summon was created at, used for its duration.
 * @param {number} [options.duration] Seconds the summon lasts. Without one it lasts until dismissed.
 * @param {object} [options.animation] Animation played when it is placed and removed.
 * @param {number} [options.placeAlpha] Opacity the token fades in from when placed.
 * @param {string} [options.avatarImg] Replaces the source actor's portrait.
 * @param {string} [options.tokenImg] Replaces the source actor's token image.
 * @param {string} [options.name] Replaces the source actor's name.
 * @param {object} [options.updates] Merged over the created actor's data.
 * @param {number} [options.disposition] Token disposition. Defaults to the owner's.
 * @param {foundry.abstract.Document} [options.parent] Document the summon depends on, such as a concentration effect.
 * @param {foundry.abstract.Document} [options.sourceDocument] Item or activity that summoned it.
 * @param {object} [options.sounds] Sounds played when it is placed, removed and killed.
 * @param {object[]} [options.items] Item data added to the summon, replacing the source actor's own.
 * @param {'follows'|'separate'|'standard'} [options.initiative] How the summon takes its turn.
 * @param {boolean} [options.dismissAtZero] Prompt to dismiss the summon when it drops to zero hit points.
 * @param {string} [options.size] Creature size to resize the token to.
 * @returns {Promise<Summon>} The summon, whose token is placed separately.
 */
async function createSummon(ownerActor, sourceActor, {created = game.time.worldTime, duration, animation, placeAlpha, avatarImg, tokenImg, name, updates, disposition, parent, sourceDocument, sounds, items, initiative, dismissAtZero, size} = {}) {
    return await constants.summons.createSummon(ownerActor, sourceActor, created, {duration, animation, placeAlpha, avatarImg, tokenImg, name, updates, disposition, parent, sourceDocument, sounds, items, initiative, dismissAtZero, size});
}
/**
 * Place a summon on the canvas with a crosshair.
 * @param {Summon} summon Summon to place.
 * @param {number} range Scene units the crosshair is bounded to.
 * @param {object} [options] Additional options.
 * @param {Function} [options.preAnimation] Runs before the token appears.
 * @param {Function} [options.postAnimation] Runs after the token appears.
 * @param {number} [options.alpha] Opacity the token fades in from.
 * @param {foundry.documents.TokenDocument} [options.token] Origin of the range check. Defaults to the owner's token.
 * @returns {Promise<foundry.documents.TokenDocument|undefined>} Undefined when the crosshair is cancelled.
 */
async function placeSummon(summon, range, {preAnimation, postAnimation, alpha, token} = {}) {
    return await constants.summons.placeSummon(summon, range, {preAnimation, postAnimation, alpha, token});
}
/**
 * Place a summon at a known position, without a crosshair.
 * @param {Summon} summon Summon to place.
 * @param {foundry.documents.Scene} scene Scene to place it on.
 * @param {{x: number, y: number}} location Canvas position to place it at.
 * @param {object} [options] Additional options.
 * @param {Function} [options.preAnimation] Runs before the token appears.
 * @param {Function} [options.postAnimation] Runs after the token appears.
 * @param {number} [options.alpha] Opacity the token fades in from.
 * @returns {Promise<foundry.documents.TokenDocument|undefined>}
 */
async function spawnSummon(summon, scene, location, {preAnimation, postAnimation, alpha} = {}) {
    return await constants.summons.spawnSummon(summon, scene, location, {preAnimation, postAnimation, alpha});
}
/**
 * Remove a summon's tokens and delete its actor.
 * @param {Summon} summon Summon to delete.
 * @param {object} [options] Additional options.
 * @param {Function} [options.preAnimation] Runs before the tokens are removed.
 * @param {Function} [options.postAnimation] Runs after the tokens are removed.
 * @returns {Promise<void>}
 */
async function deleteSummon(summon, {preAnimation, postAnimation} = {}) {
    return await constants.summons.deleteSummon(summon, {preAnimation, postAnimation});
}
/**
 * Remove a summon's token from the canvas, keeping its actor.
 * @param {Summon} summon Summon to remove.
 * @param {object} [options] Additional options.
 * @param {Function} [options.preAnimation] Runs before the token is removed.
 * @param {Function} [options.postAnimation] Runs after the token is removed.
 * @returns {Promise<void>}
 */
function removeSummon(summon, {preAnimation, postAnimation} = {}) {
    return constants.summons.removeSummon(summon, {preAnimation, postAnimation});
}
/**
 * Every summon belonging to this actor.
 * @param {Actor5e} actor Actor whose summons are wanted.
 * @returns {Summon[]}
 */
function getSummons(actor) {
    return constants.summons.getSummons(actor);
}
/**
 * The summon an actor is, rather than the summons it owns.
 * @param {Actor5e} actor Actor to look up.
 * @returns {Summon|undefined} Undefined when the actor is not a summon.
 */
function getSummonData(actor) {
    return constants.summons.getSummonData(actor);
}
/**
 * Every summon created by this item or activity, across all owners.
 * @param {foundry.abstract.Document} document Item or activity that did the summoning.
 * @returns {Summon[]}
 */
function getSummonsBySource(document) {
    return constants.summons.getSummonsBySource(document);
}
/**
 * Place several summons in turn, stopping if one is cancelled.
 * @param {Summon[]} summons Summons to place.
 * @param {number} range Scene units each crosshair is bounded to.
 * @param {object} [options] Additional options.
 * @param {foundry.documents.TokenDocument} [options.token] Origin of the range check. Defaults to each summon's owner.
 * @returns {Promise<foundry.documents.TokenDocument[]|undefined>} The tokens placed before any cancellation.
 */
function placeSummons(summons, range, {token} = {}) {
    return constants.summons.placeSummons(summons, range, {token});
}
/**
 * Place every unplaced summon created by this item or activity.
 * @param {foundry.abstract.Document} document Item or activity that did the summoning.
 * @param {number} range Scene units each crosshair is bounded to.
 * @param {object} [options] Additional options.
 * @param {foundry.documents.TokenDocument} [options.token] Origin of the range check.
 * @returns {Promise<foundry.documents.TokenDocument[]|undefined>}
 */
async function placeAllSourceSummons(document, range, {token} = {}) {
    return await placeSummons(getSummonsBySource(document), range, {token});
}
/**
 * Take every summon created by this item or activity off the canvas, keeping their actors.
 * @param {foundry.abstract.Document} document Item or activity that did the summoning.
 * @returns {Promise<void[]>}
 */
async function recallAllSourceSummons(document) {
    return await Promise.all(getSummonsBySource(document).map(async summon => summon.recall()));
}
/**
 * Every summon matching an identifier, which defaults to the source actor's.
 * @param {string} identifier Summon identifier to match.
 * @param {object} [options] Additional options.
 * @param {Actor5e} [options.actor] Only summons belonging to this actor.
 * @returns {Summon[]}
 */
function getSummonsByIdentifier(identifier, {actor} = {}) {
    return constants.summons.getSummonsByIdentifier(identifier, {actor});
}
export default {
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
