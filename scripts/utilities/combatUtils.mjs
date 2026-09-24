/**
 * Whether this token already has a stamp for the turn in progress. Outside combat there are no turns, so nothing is ever stamped.
 * @param {{id: string, combatId: string, round: number, turn: number}[]} stamps Stamps recorded so far.
 * @param {string} tokenId Token whose stamp is being checked.
 * @param {{inCombat: boolean, combatId: string, currentRound: number, currentTurn: number}} combatData From tokenUtils.getCombatData.
 * @returns {boolean}
 */
function isStampedThisTurn(stamps, tokenId, combatData) {
    if (!combatData.inCombat || !stamps?.length) return false;
    const record = stamps.find(pt => pt.id === tokenId);
    return record && record.combatId === combatData.combatId && record.round === combatData.currentRound &&  record.turn === combatData.currentTurn;
}
/**
 * Replace this token's stamp with one for the current turn.
 * @param {{id: string, combatId: string, round: number, turn: number}[]} stamps Stamps recorded so far.
 * @param {string} tokenId Token being stamped.
 * @param {{inCombat: boolean, combatId: string, currentRound: number, currentTurn: number}} combatData From tokenUtils.getCombatData.
 * @returns {{id: string, combatId: string, round: number, turn: number}[]} A new array, or the input unchanged outside combat.
 */
function addTurnStamp(stamps, tokenId, combatData) {
    if (!combatData.inCombat) return stamps;
    const newStamps = stamps.filter(pt => pt.id !== tokenId);
    newStamps.push({
        id: tokenId,
        combatId: combatData.combatId,
        round: combatData.currentRound,
        turn: combatData.currentTurn
    });
    return newStamps;
}
/**
 * Whether it is currently this token's turn.
 * @param {foundry.documents.TokenDocument|foundry.canvas.placeables.Token} token Token to check.
 * @returns {boolean} True when the token is not in a combat.
 */
function isOwnTurn(token) {
    const tokenDocument = token.document ?? token;
    const combat = tokenDocument.combatant?.combat;
    if (!combat) return true;
    return tokenDocument.id === combat.current.tokenId;
}
export default {
    isStampedThisTurn,
    addTurnStamp,
    isOwnTurn
};
