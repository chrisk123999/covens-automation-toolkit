import {constants} from './lib.mjs';
import {workflowEvents, movementEvents} from './event.mjs';
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
}