import {documentUtils} from '../utils.mjs';
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
function getVehicles(actor, {positions = ['crew', 'passenger', 'draft']} = {}) {
    return game.actors.filter(a => a.type === 'vehicle' && ((positions.includes('crew') && a.system.crew.value.includes(actor.uuid)) || ((positions.includes('passenger') && a.system.passengers.value.includes(actor.uuid)) || ((positions.includes('draft') && a.system.draft.value.includes(actor.uuid))))));
}
function getTokens(actor) {
    return actor.getActiveTokens();
}
function getFirstToken(actor) {
    return getTokens(actor)?.[0]?.document;
}
function getEffectByIdentifier(actor, identifier) {
    return getEffects(actor).find(i => documentUtils.getIdentifier(i) === identifier);
}
export const actorUtils = {
    getCastData,
    getEffects,
    getGroups,
    getSavedCastData,
    getEncounterMembers,
    getEncounters,
    getVehicles,
    getTokens,
    getFirstToken,
    getEffectByIdentifier
};