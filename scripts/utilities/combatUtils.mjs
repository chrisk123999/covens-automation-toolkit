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
function inCombat() {
    return !!game.combat;
}
function isOwnTurn(token) {
    if (!inCombat()) return true;
    return (token.document ?? token).id === game.combat.current.tokenId;
}
export default {
    isStampedThisTurn,
    addTurnStamp,
    inCombat,
    isOwnTurn
};
