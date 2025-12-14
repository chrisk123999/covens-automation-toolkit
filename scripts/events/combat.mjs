import {Events} from '../lib.mjs';
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
    const previousToken = previousCombatant.token;
    if (previousToken) {
        await new Events.SingleCombatEvent(combat, 'turnEnd', previousToken, {context, combatant: previousCombatant, round: previousRound, turn: previousTurn}).run();
    }
    if (currentToken) {
        await new Events.SingleCombatEvent(combat, 'turnStart', currentToken, {context, combatant: currentCombatant, round: currentRound, turn: currentTurn, previousCombatant, previousRound, previousTurn}).run();
    }
}
export const combatEvents = {
    updateCombat
};