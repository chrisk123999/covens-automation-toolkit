import {midiEvents} from './events/midi.js';
export function registerHooks() {
    Hooks.on('midi-qol.premades.postRollFinished', midiEvents.rollFinished);
}