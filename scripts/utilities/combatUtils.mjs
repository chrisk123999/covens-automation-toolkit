/**
 * Turn checks and per-turn stamps. A stamp records that a token already did something on the current combat turn, such
 * as triggering a once-per-turn effect.
 * @module
 */
/**
 * Whether this token already has a stamp for the turn in progress. Outside combat there are no turns, so nothing is
 * ever stamped. Stamps written before combatant ids were recorded compare by turn index.
 * @param {{id: string, combatId: string, round: number, combatantId: string}[]} stamps
 *                                                Stamps recorded so far.
 * @param {string} tokenId                        Token whose stamp is being checked.
 * @param {object} combatData                     From {@link tokenUtils.getCombatData}.
 * @param {boolean} combatData.inCombat           Whether the token is in an active combat.
 * @param {string} combatData.combatId            Combat id.
 * @param {number} combatData.currentRound        Round in progress.
 * @param {number} combatData.currentTurn         Turn index in progress.
 * @param {string} combatData.currentCombatantId  Combatant whose turn it is.
 * @returns {boolean}
 * @example
 * const combatData = tokenUtils.getCombatData(token);
 * if (combatUtils.isStampedThisTurn(stamps, target.id, combatData)) return;
 */
function isStampedThisTurn(stamps, tokenId, combatData) {
    if (!combatData.inCombat || !stamps?.length) return false;
    const record = stamps.find(pt => pt.id === tokenId);
    if (!record || record.combatId !== combatData.combatId || record.round !== combatData.currentRound) return false;
    return record.combatantId ? record.combatantId === combatData.currentCombatantId : record.turn === combatData.currentTurn;
}
/**
 * Replace this token's stamp with one for the current turn. Nothing is saved to any document.
 * @param {{id: string, combatId: string, round: number, combatantId: string}[]} stamps
 *                                                Stamps recorded so far.
 * @param {string} tokenId                        Token being stamped.
 * @param {object} combatData                     From {@link tokenUtils.getCombatData}.
 * @param {boolean} combatData.inCombat           Whether the token is in an active combat.
 * @param {string} combatData.combatId            Combat id.
 * @param {number} combatData.currentRound        Round in progress.
 * @param {string} combatData.currentCombatantId  Combatant whose turn it is.
 * @returns {{id: string, combatId: string, round: number, combatantId: string}[]}
 *                                                A new array, or the input unchanged outside combat.
 * @example
 * const combatData = tokenUtils.getCombatData(token);
 * stamps = combatUtils.addTurnStamp(stamps, target.id, combatData);
 */
function addTurnStamp(stamps, tokenId, combatData) {
    if (!combatData.inCombat) return stamps;
    const newStamps = stamps.filter(pt => pt.id !== tokenId);
    newStamps.push({
        id: tokenId,
        combatId: combatData.combatId,
        round: combatData.currentRound,
        combatantId: combatData.currentCombatantId
    });
    return newStamps;
}
/**
 * Whether it is currently this token's turn in its combat.
 * @param {foundry.documents.TokenDocument} token  Token to check.
 * @returns {boolean}                              Also true when the token is not in a combat.
 * @example
 * if (!combatUtils.isOwnTurn(token)) return;
 */
function isOwnTurn(token) {
    const combat = token.combatant?.combat;
    if (!combat) return true;
    return token.id === combat.current.tokenId;
}
export default {
    isStampedThisTurn,
    addTurnStamp,
    isOwnTurn
};
