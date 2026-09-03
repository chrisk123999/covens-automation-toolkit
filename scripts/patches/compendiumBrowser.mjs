import {Logging} from '../lib/_module.mjs';
async function fetch(wrapped, documentClass, options = {}) {
    const isCatRequest = Array.isArray(options.filters) && options.filters.some(f => 
        Object.hasOwn(f, '_exceptionIdentifiers') ||
        Object.hasOwn(f, '_customPredicate') || 
        Object.hasOwn(f, '_exceptionUuids') ||
        Object.hasOwn(f, '_allowedPacks')
    );
    if (!isCatRequest) return wrapped(documentClass, options);
    let customPredicate = null;
    let allowedPacks = null;
    let exceptionUuids = null;
    let exceptionIdentifiers = null;
    options.filters = options.filters.filter(f => {
        if (Object.hasOwn(f, '_customPredicate')) {
            customPredicate = f._customPredicate;
            return false; 
        }
        if (Object.hasOwn(f, '_allowedPacks')) {
            allowedPacks = f._allowedPacks;
            return false;
        }
        if (Object.hasOwn(f, '_exceptionUuids')) {
            exceptionUuids = f._exceptionUuids;
            return false;
        }
        if (Object.hasOwn(f, '_exceptionIdentifiers')) {
            exceptionIdentifiers = f._exceptionIdentifiers;
            return false;
        }
        return true;
    });
    const exceptionFilters = [];
    if (exceptionUuids?.length) exceptionFilters.push({k: 'uuid', o: 'in', v: exceptionUuids});
    if (exceptionIdentifiers?.length) exceptionFilters.push({k: 'system.identifier', o: 'in', v: exceptionIdentifiers});
    if (exceptionFilters.length) {
        if (options.filters.length)
            options.filters = [{o: 'OR', v: [{o: 'AND', v: options.filters}, ...exceptionFilters]}];
        else
            options.filters = exceptionFilters;
    }
    let results = await wrapped(documentClass, options);
    if (allowedPacks?.length) {
        const allowed = new Set(allowedPacks);
        const uuid = exceptionUuids?.length ? new Set(exceptionUuids) : {has: () => false};
        const identifier = exceptionIdentifiers?.length ? new Set(exceptionIdentifiers) : {has: () => false};
        const exceptions = r => uuid.has(r.uuid) || identifier.has(r.system.identifier);
        results = results.filter(r => {
            if (!r.uuid) return false; 
            const parts = r.uuid.split('.');
            return (parts.length >= 3 && allowed.has(parts[1] + '.' + parts[2])) || exceptions(r);
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