import {effectEvents} from '../events/_module.mjs';
import {Logging} from '../lib/_module.mjs';
async function create(wrapped, data = [], operation = {}) {
    const filtered = [];
    for (let i = 0; i < data.length; i++) {
        const effectData = data[i];
        if (await effectEvents.doCreateActiveEffect(effectData, operation)) {
            Logging.addEntry('DEBUG', `Effect creation prevented by doCreate event | Parent UUID: ${operation.parent?.uuid ?? operation.parentUuid} | Effect: ${i + 1} of ${data.length}`);
            continue;
        }
        filtered.push(effectData);
    }
    return await wrapped(filtered, operation);
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: ActiveEffect.implementation.createDocuments');
        libWrapper.register('cat', 'ActiveEffect.implementation.createDocuments', create, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: ActiveEffect.implementation.createDocuments');
        libWrapper.unregister('cat', 'ActiveEffect.implementation.createDocuments');
    }
}
export default {
    patch
};