import {constants} from './lib.mjs';
import {workflowEvents, movementEvents, effectEvents, combatEvents, auraEvents} from './event.mjs';
export function registerHooks() {
    // Workflow Events
    Hooks.on(constants.workflowHookNames.preTargeting, workflowEvents.preTargeting);
    Hooks.on(constants.workflowHookNames.preItemRoll, workflowEvents.preItemRoll);
    Hooks.on(constants.workflowHookNames.preambleComplete, workflowEvents.preambleComplete);
    Hooks.on(constants.workflowHookNames.postAttackRoll, workflowEvents.postAttackRoll);
    Hooks.on(constants.workflowHookNames.attackRollComplete, workflowEvents.attackRollComplete);
    Hooks.on(constants.workflowHookNames.savesComplete, workflowEvents.savesComplete);
    Hooks.on(constants.workflowHookNames.damageRollComplete, workflowEvents.damageRollComplete);
    Hooks.on(constants.workflowHookNames.utilityRollComplete, workflowEvents.utilityRollComplete);
    Hooks.on(constants.workflowHookNames.preTargetDamageApplication, workflowEvents.preTargetDamageApplication);
    Hooks.on(constants.workflowHookNames.rollFinished, workflowEvents.rollFinished);
    // Movement Events
    Hooks.on(constants.movementHookNames.moveToken, movementEvents.moveToken);
    // Effect Events
    Hooks.on(constants.effectHookNames.createActiveEffect, effectEvents.createActiveEffect);
    Hooks.on(constants.effectHookNames.deleteActiveEffect, effectEvents.deleteActiveEffect);
    Hooks.on(constants.effectHookNames.updateActiveEffect, effectEvents.updateActiveEffect);
    Hooks.on(constants.effectHookNames.preCreateActiveEffect, effectEvents.preCreateActiveEffect);
    Hooks.on(constants.effectHookNames.preDeleteActiveEffect, effectEvents.preDeleteActiveEffect);
    Hooks.on(constants.effectHookNames.preUpdateActiveEffect, effectEvents.preUpdateActiveEffect);
    // Combat Events
    Hooks.on(constants.combatHookNames.updateCombat, combatEvents.updateCombat);
    Hooks.on(constants.combatHookNames.combatStart, combatEvents.combatStart);
    Hooks.on(constants.combatHookNames.deleteCombat, combatEvents.deleteCombat);
    // Aura Events
    Hooks.on(constants.auraHookNames.canvasReady, auraEvents.canvasReady);
    Hooks.on(constants.auraHookNames.createToken, auraEvents.createToken);
    Hooks.on(constants.auraHookNames.deleteToken, auraEvents.deleteToken);
}