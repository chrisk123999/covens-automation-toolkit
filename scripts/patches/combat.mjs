import {combatEvents} from '../events/_module.mjs';
import {summonUtils} from '../utilities/_module.mjs';
import {constants, Logging} from '../lib/_module.mjs';
async function rollInitiative(wrapped, ids, options) {
    if (!ids) return this;
    const idArray = typeof ids === 'string' ? [ids] : ids;
    const processedOwners = new Set();
    const allowedIds = [];
    for (const id of idArray) {
        const combatant = this.combatants.get(id);
        const summonData = summonUtils.getSummonData(combatant.actor);
        if (summonData?.initiative !== 'follows') {
            allowedIds.push(id);
            continue;
        }
        const owner = summonData.owner;
        const ownerCombatant = owner ? this.getCombatantsByActor(owner)[0] : undefined;
        if (ownerCombatant && ownerCombatant.initiative !== null) {
            if (!processedOwners.has(owner.uuid)) {
                await constants.summons.ownerInitiative(owner);
                processedOwners.add(owner.uuid);
            }
        }
    }
    if (!allowedIds.length) return this;
    if (combatEvents.hasPreInitiative(this)) {
        for (const id of allowedIds) {
            const combatant = this.combatants.get(id);
            if (combatant?.token && combatant.actor && !combatant.actor._cachedInitiativeRoll) await combatEvents.preInitiative(this, combatant, combatant.token);
        }
    }
    return wrapped(allowedIds, options);
}
async function rollInitiativeDialog(wrapped, rollOptions, dialog) {
    const combat = game.combat;
    const combatants = combat?.getCombatantsByActor(this) ?? [];
    const token = combatants[0]?.token ?? this.getActiveTokens(false, true)[0];
    if (combat && token && (!combatants.length || combatants.some(combatant => combatant.initiative === null))) await combatEvents.preInitiative(combat, combatants[0], token);
    return wrapped(rollOptions, dialog);
}
async function onEndTurn(wrapped, combatant, context) {
    await wrapped(combatant, context);
    if (!context.skipped || combatant.isDefeated) await combatEvents.turnEnd(this, combatant, context);
}
async function onStartTurn(wrapped, combatant, context) {
    await wrapped(combatant, context);
    if (!context.skipped || combatant.isDefeated) await combatEvents.turnStart(this, combatant, context);
}
async function onStartRound(wrapped, context) {
    await wrapped(context);
    if (context.round === 1 && !this.previous?.round) await combatEvents.combatStart(this, context);
}
const patches = [
    {path: 'CONFIG.Actor.documentClass.prototype.rollInitiativeDialog', fn: rollInitiativeDialog, wrapType: 'WRAPPER'},
    {path: 'CONFIG.Combat.documentClass.prototype.rollInitiative', fn: rollInitiative, wrapType: 'MIXED'},
    {path: 'CONFIG.Combat.documentClass.prototype._onEndTurn', fn: onEndTurn, wrapType: 'WRAPPER'},
    {path: 'CONFIG.Combat.documentClass.prototype._onStartTurn', fn: onStartTurn, wrapType: 'WRAPPER'},
    {path: 'CONFIG.Combat.documentClass.prototype._onStartRound', fn: onStartRound, wrapType: 'WRAPPER'}
];
function patch(enabled) {
    for (const entry of patches) {
        Logging.addEntry('DEBUG', (enabled ? 'Patching: ' : 'Unpatching: ') + entry.path, {force: true});
        if (enabled) libWrapper.register('cat', entry.path, entry.fn, entry.wrapType);
        else libWrapper.unregister('cat', entry.path);
    }
}
export default {
    patch
};