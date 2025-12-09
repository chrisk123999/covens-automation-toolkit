import {midiEvents} from './events/midi.mjs';
export function registerHooks() {
    Hooks.on('midi-qol.premades.postRollFinished', midiEvents.rollFinished);
}