import {midiEvents} from './events/midi.mjs';
import { constants } from './lib.mjs';
export function registerHooks() {
    Hooks.on(constants.workflowHookNames.preTargeting, midiEvents.preTargeting);
}