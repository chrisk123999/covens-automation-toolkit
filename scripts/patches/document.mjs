import {effectEvents} from '../events/_module.mjs';
import {Logging} from '../lib/_module.mjs';
async function deleteEmbeddedDocuments(wrapped, embeddedName, ids, operation = {}) {
    if (embeddedName != 'ActiveEffect') return await await wrapped(embeddedName, ids, operation);
    if (!(parent instanceof Actor) || (parent instanceof Item && parent.actor)) return await await wrapped(embeddedName, ids, operation);
    let effects = ids.map(id => this.effects.get(id)).filter(i => i);
    for (let effect of effects) {
        let result = await effectEvents.doDeleteActiveEffect(effect, operation);
        if (result) ids = ids.filter(id => effect.id != id);
    }
    return await wrapped(embeddedName, ids, operation);
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: foundry.abstract.Document.prototype.deleteEmbeddedDocuments');
        libWrapper.register('cat', 'foundry.abstract.Document.prototype.deleteEmbeddedDocuments', deleteEmbeddedDocuments, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: foundry.abstract.Document.prototype.deleteEmbeddedDocuments');
        libWrapper.unregister('cat', 'foundry.abstract.Document.prototype.deleteEmbeddedDocuments');
    }
}
export default {
    patch
};