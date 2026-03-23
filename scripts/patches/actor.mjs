import {checkEvents} from '../events/check.mjs';
import {Logging} from '../lib.mjs';
async function rollCheck(wrapped, config, dialog = {}, message = {}) {
    let event = config.event;
    let checkId = config.ability;
    let options = {};
    await checkEvents.situational(this, {config, dialog, message, options, checkId});
    let selections = await checkEvents.context(this, {config, dialog, message, options, checkId});
    //Do stuff with the selections here.
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: CONFIG.Actor.documentClass.prototype.rollAbilityCheck');
        libWrapper.register('cat', 'CONFIG.Actor.documentClass.prototype.rollAbilityCheck', rollCheck, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollAbilityCheck');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollAbilityCheck');
    }
}
export const actorPatching = {
    patch
};