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
async function getEncounterMembers(actor) {
    return (await Promise.all(actor.system.members.uuids.map(uuid => fromUuid(uuid)))).filter(i => i);
}
function getEncounters(actor) {
    return game.actors.filter(a => a.type === 'encounter' && a.system.members.uuids.has(actor.uuid));
}
export const actorUtils = {
    getCastData,
    getEffects,
    getGroups,
    getSavedCastData,
    getEncounterMembers,
    getEncounters
};