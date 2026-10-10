import {effects, regions} from '../handlers/_module.mjs';
import {Auras, constants, Events} from '../lib/_module.mjs';
import {genericUtils, queryUtils, summonUtils} from '../utilities/_module.mjs';
function getCombatData(combat, combatant, round, turn) {
    return {inCombat: true, currentRound: round, currentTurn: turn, currentCombatantId: combatant.id, combatId: combat.id};
}
function getPrevious(combat) {
    return {
        previousCombatant: combat.combatants.get(combat.previous?.combatantId),
        previousRound: combat.previous?.round ?? -1,
        previousTurn: combat.previous?.turn ?? -1
    };
}
async function turnEnd(combat, combatant, context = {}) {
    const {round, turn} = context;
    const token = combatant?.token;
    if (!token) return;
    const combatData = getCombatData(combat, combatant, round, turn);
    await regions.processRegionActivities(token, Array.from(token.regions), constants.combatPasses.turnEnd, {combatData});
    await new Events.CombatEvent(combat, constants.combatPasses.turnEnd, token, {context, combatant, round, turn}).run();
    await Auras.turnEvent(token, constants.auraTriggers.turnEnd, {combat, round, combatantId: combatant.id});
    await effects.specialDurationTurn(token, constants.combatPasses.turnEnd, {round, turn});
}
async function turnStart(combat, combatant, context = {}) {
    const {round, turn} = context;
    const token = combatant?.token;
    if (!token) return;
    const {previousCombatant, previousRound, previousTurn} = getPrevious(combat);
    const combatData = getCombatData(combat, combatant, round, turn);
    for (const sceneToken of token.parent.tokens.filter(i => i.actor && ['npc', 'character'].includes(i.actor.type))) {
        await regions.processRegionActivities(sceneToken, Array.from(sceneToken.regions), constants.combatPasses.everyTurn, {combatData});
        await new Events.CombatEvent(combat, constants.combatPasses.everyTurn, sceneToken, {context, combatant, round, turn, previousCombatant, previousRound, previousTurn}).run();
    }
    await regions.processRegionActivities(token, Array.from(token.regions), constants.combatPasses.turnStart, {combatData});
    await new Events.CombatEvent(combat, constants.combatPasses.turnStart, token, {context, combatant, round, turn, previousCombatant, previousRound, previousTurn}).run();
    await Auras.turnEvent(token, constants.auraTriggers.turnStart, {combat, round, combatantId: combatant.id});
    await effects.specialDurationTurn(token, constants.combatPasses.turnStart, {round, turn});
}
async function combatStart(combat, context = {}) {
    const {round} = context;
    const turn = combat.current.turn;
    for (const combatant of combat.combatants) {
        await new Events.CombatEvent(combat, constants.combatPasses.combatStart, combatant.token, {context, combatant, round, turn}).run();
    }
}
async function deleteCombat(combat, updates, context) {
    const currentTurn = combat.current.turn;
    const currentRound = combat.current.round;
    const {previousCombatant, previousRound, previousTurn} = getPrevious(combat);
    for (const combatant of combat.combatants) {
        await new Events.CombatEvent(combat, constants.combatPasses.combatEnd, combatant.token, {context, combatant, round: currentRound, turn: currentTurn, previousCombatant, previousRound, previousTurn}).run();
    }
}
function preUpdateCombat(combat, updates) {
    if (!Array.isArray(updates.combatants)) return;
    const combatantUpdates = new Map(updates.combatants.map(update => [update._id, update]));
    const followsCounts = new Map();
    for (const combatant of combat.combatants) {
        const summonData = summonUtils.getSummonData(combatant.actor);
        if (summonData?.initiative !== 'follows') continue;
        const update = combatantUpdates.get(combatant.id);
        const ownerCombatant = summonData.owner ? combat.getCombatantsByActor(summonData.owner)[0] : undefined;
        if (!update || !ownerCombatant) continue;
        const ownerInitiative = combatantUpdates.get(ownerCombatant.id)?.initiative ?? ownerCombatant.initiative;
        if (ownerInitiative === null || ownerInitiative === undefined) continue;
        const followsCount = (followsCounts.get(ownerCombatant.id) ?? 0) + 1;
        followsCounts.set(ownerCombatant.id, followsCount);
        update.initiative = ownerInitiative - (followsCount * 0.001);
    }
}
function preUpdateCombatant(combatant, updates, context, userId) {
    if (('initiative' in updates) && combatant.initiative === null) genericUtils.setProperty(context, 'cat.isFirstInitiativeRoll', true);
}
async function updateCombatant(combatant, updates, context, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!context.cat?.isFirstInitiativeRoll) return;
    if (!('initiative' in updates)) return;
    if (!combatant.actor) return;
    await constants.summons.ownerInitiative(combatant.actor);
}
export default {
    turnEnd,
    turnStart,
    combatStart,
    preUpdateCombat,
    deleteCombat,
    preUpdateCombatant,
    updateCombatant
};
