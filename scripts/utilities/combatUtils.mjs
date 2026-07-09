function isStampedThisTurn(stamps, tokenId, combatData) {
    if (!combatData.inCombat || !stamps?.length) return false;
    const record = stamps.find(pt => pt.id === tokenId);
    return record && record.combatId === combatData.combatId && record.round === combatData.currentRound &&  record.turn === combatData.currentTurn;
}
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
