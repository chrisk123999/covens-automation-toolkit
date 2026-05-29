import {constants, Events} from '../lib/_module.mjs';
import {queryUtils} from '../utilities/_module.mjs';
import {regions} from '../handlers/_module.mjs';
async function updateCombat(combat, updates, context) {
    if (!queryUtils.isTheGM()) return;
    if (!updates.turn && !updates.round) return;
    if (!combat.started || !combat.isActive) return;
    const currentTurn = combat.current.turn;
    const previousTurn = combat.previous.turn ?? -1;
    const currentRound = combat.current.round;
    const previousRound = combat.previous.round ?? -1;
    if (currentRound < previousRound || (currentTurn < previousTurn && currentRound === previousRound)) return;
    const currentCombatant = combat.combatants.get(combat.current.combatantId);
    const previousCombatant = combat.combatants.get(combat.previous.combatantId);
    const currentToken = currentCombatant.token;
    const previousToken = previousCombatant?.token;
    if (previousToken) {
        await regions.processRegionActivities(previousToken, Array.from(previousToken.regions), constants.combatPasses.turnEnd, {combatData: {inCombat: true, currentRound: previousRound, currentTurn: previousTurn, combatId: combat.id}});
        await new Events.CombatEvent(combat, constants.combatPasses.turnEnd, previousToken, {context, combatant: previousCombatant, round: previousRound, turn: previousTurn}).run();
    }
    if (currentToken) {
        for (let token of currentToken.parent.tokens.filter(i => i.actor && ['npc', 'character'].includes(i.actor.type))) {
            await regions.processRegionActivities(token, Array.from(token.regions), constants.combatPasses.everyTurn, {combatData: {inCombat: true, currentRound, currentTurn, combatId: combat.id}});
            await new Events.CombatEvent(combat, constants.combatPasses.everyTurn, token, {context, combatant: currentCombatant, round: currentRound, turn: currentTurn, previousCombatant, previousRound, previousTurn}).run();
        }
        await regions.processRegionActivities(previousToken, Array.from(currentToken.regions), constants.combatPasses.turnStart, {combatData: {inCombat: true, currentRound, currentTurn, combatId: combat.id}});
        await new Events.CombatEvent(combat, constants.combatPasses.turnStart, currentToken, {context, combatant: currentCombatant, round: currentRound, turn: currentTurn, previousCombatant, previousRound, previousTurn}).run();
    }
}
async function combatStart(combat, updates) {
    const currentTurn = combat.current.turn;
    const currentRound = combat.current.round;
    for (const combatant of combat.combatants) {
        await new Events.CombatEvent(combat, constants.combatPasses.combatStart, combatant.token, {combatant, round: currentRound, turn: currentTurn}).run();
    }
}
async function deleteCombat(combat, updates, context) {
    const currentTurn = combat.current.turn;
    const currentRound = combat.current.round;
    const previousCombatant = combat.combatants.get(combat.previous.combatantId);
    const previousRound = combat.previous.round ?? -1;
    const previousTurn = combat.previous.turn ?? -1;
    for (const combatant of combat.combatants) {
        await new Events.CombatEvent(combat, constants.combatPasses.combatEnd, combatant.token, {context, combatant, round: currentRound, turn: currentTurn, previousCombatant, previousRound, previousTurn}).run();
    }
}
export default {
    updateCombat,
    combatStart,
    deleteCombat
};