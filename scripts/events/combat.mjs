import {constants, Events} from '../lib.mjs';
import {queryUtils} from '../utils.mjs';
async function updateCombat(combat, updates, context) {
    if (!queryUtils.isTheGM()) return;
    if (!updates.turn && !updates.round) return;
    if (!combat.started || !combat.isActive) return;
    const currentTurn = combat.current.turn;
    const previousTurn = combat.previous.turn ?? -1;
    const currentRound = combat.current.round;
    const previousRound = combat.previous.round ?? -1;
    if (currentRound < previousRound || (currentTurn < previousTurn && currentTurn === previousRound)) return;
    const currentCombatant = combat.combatants.get(combat.current.combatantId);
    const previousCombatant = combat.combatants.get(combat.previous.combatantId);
    const currentToken = currentCombatant.token;
    const previousToken = previousCombatant?.token;
    if (previousToken) {
        await new Events.CombatEvent(combat, constants.combatPasses.turnStart, previousToken, {context, combatant: previousCombatant, round: previousRound, turn: previousTurn}).run();
    }
    if (currentToken) {
        for (let token of currentToken.parent.tokens.filter(i => i.actor && ['npc', 'character'].includes(i.actor.type))) {
            await new Events.CombatEvent(combat, constants.combatPasses.everyTurn, token, {context, combatant: currentCombatant, round: currentRound, turn: currentTurn, previousCombatant, previousRound, previousTurn}).run();
        }
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
export const combatEvents = {
    updateCombat,
    combatStart,
    deleteCombat
};