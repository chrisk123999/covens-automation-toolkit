import {midiEvents} from './events/midi.mjs';
export function registerHooks() {
    // eslint-disable-next-line no-undef
    Hooks.on('midi-qol.premades.postRollFinished', midiEvents.rollFinished);
}