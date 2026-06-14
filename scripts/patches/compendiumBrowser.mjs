import {Logging} from '../lib/_module.mjs';
async function fetch(wrapped, documentClass, options = {}) {
    const isCatRequest = Array.isArray(options.filters) && options.filters.some(f => Object.hasOwn(f, '_customPredicate') || Object.hasOwn(f, '_allowedPacks'));
    if (!isCatRequest) return wrapped(documentClass, options);
    let customPredicate = null;
    let allowedPacks = null;
    options.filters = options.filters.filter(f => {
        if (Object.hasOwn(f, '_customPredicate')) {
            customPredicate = f._customPredicate;
            return false; 
        }
        if (Object.hasOwn(f, '_allowedPacks')) {
            allowedPacks = f._allowedPacks;
            return false;
        }
        return true;
    });
    let results = await wrapped(documentClass, options);
    if (allowedPacks?.length) {
        const allowed = new Set(allowedPacks);
        results = results.filter(r => {
            if (!r.uuid) return false; 
            const parts = r.uuid.split('.');
            return parts.length >= 3 && allowed.has(parts[1] + '.' + parts[2]);
        });
    }
    if (customPredicate) results = results.filter(customPredicate);
    return results;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.applications.CompendiumBrowser.fetch');
        libWrapper.register('cat', 'dnd5e.applications.CompendiumBrowser.fetch', fetch, 'WRAPPER');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.applications.CompendiumBrowser.fetch');
        libWrapper.unregister('cat', 'dnd5e.applications.CompendiumBrowser.fetch');
    }
}
export default {
    patch
};