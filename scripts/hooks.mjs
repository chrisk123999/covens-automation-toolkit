import {midiEvents} from './events/midi.mjs';
import {constants} from './lib.mjs';
export function registerHooks() {
    Hooks.on(constants.workflowHookNames.preTargeting, midiEvents.preTargeting);
    Hooks.on(constants.workflowHookNames.preItemRoll, midiEvents.preItemRoll);
    Hooks.on(constants.workflowHookNames.preambleComplete, midiEvents.preambleComplete);
    Hooks.on(constants.workflowHookNames.postAttackRoll, midiEvents.postAttackRoll);
    Hooks.on(constants.workflowHookNames.attackRollComplete, midiEvents.attackRollComplete);
    Hooks.on(constants.workflowHookNames.savesComplete, midiEvents.savesComplete);
    Hooks.on(constants.workflowHookNames.damageRollComplete, midiEvents.damageRollComplete);
    Hooks.on(constants.workflowHookNames.utilityRollComplete, midiEvents.utilityRollComplete);
    Hooks.on(constants.workflowHookNames.preTargetDamageApplication, midiEvents.preTargetDamageApplication);
    Hooks.on(constants.workflowHookNames.rollFinished, midiEvents.rollFinished);
}