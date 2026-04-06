import {effectEvents} from '../events/_module.mjs';
import {Logging} from '../lib/_module.mjs';
async function create(wrapped, data = {}, operation = {}) {
    let result = await effectEvents.doCreateActiveEffect(data, operation);
    if (result) return;
    let effect =  await wrapped(data, operation);
    return effect;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: ActiveEffect.implementation.create');
        libWrapper.register('cat', 'ActiveEffect.implementation.create', create, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: ActiveEffect.implementation.create');
        libWrapper.unregister('cat', 'ActiveEffect.implementation.create');
    }
}
export default {
    patch
};