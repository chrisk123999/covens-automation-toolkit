import {effectEvents} from '../event.mjs';
import {Logging} from '../lib.mjs';
async function deleteEmbeddedDocuments(wrapped, embeddedName, ids, operation = {}) {
    if (!(this instanceof Actor) || embeddedName != 'ActiveEffect') return await await wrapped(embeddedName, ids, operation);
    let effects = ids.map(id => this.effects.get(id)).filter(i => i);
    for (let effect of effects) {
        let results = await effectEvents.doDeleteActiveEffect(effect, operation);
        if (results && results.find(i => i)) ids = ids.filter(id => effect.id != id);
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
export const documentPatching = {
    patch
};