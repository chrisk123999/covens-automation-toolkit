function getCastData(actor) {
    return actor.flags.cat?.castData;
}
function getEffects(actor) {
    return Array.from(actor.allApplicableEffects());
}
function getGroups(actor) {
    return game.actors.filter(a => a.type === 'group' && a.system.creatures.includes(actor));
}
function getSavedCastData(actor) {
    return actor.flags.cat?.castData;
}
export const actorUtils = {
    getCastData,
    getEffects,
    getGroups,
    getSavedCastData
};