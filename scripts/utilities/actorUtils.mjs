function getCastData(actor) {
    return actor.flags.cat?.castData;
}
function getEffects(actor) {
    return Array.from(actor.allApplicableEffects());
}
export const actorUtils = {
    getCastData,
    getEffects
};