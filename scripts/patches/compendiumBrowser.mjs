import {Logging} from '../lib/_module.mjs';
async function fetch(wrapped, documentClass, options = {}) {
    let customPredicate = null;
    if (Array.isArray(options.filters)) {
        options.filters = options.filters.filter(f => {
            if (typeof f._customPredicate === 'function') {
                customPredicate = f._customPredicate;
                return false; 
            }
            return true;
        });
        const originalPush = options.filters.push;
        options.filters.push = (...args) => {
            if (args.length && args[0].k === 'system.container') return this.length;
            return originalPush.apply(this, args);
        };
    }
    let results = await wrapped(documentClass, options);
    if (options.allowedPacks?.length) {
        const allowed = new Set(options.allowedPacks);
        results = results.filter(r => {
            if (r.uuid) {
                const parts = r.uuid.split('.');
                if (parts.length >= 3) return allowed.has(parts[1] + '.' + parts[2]);
            }
            if (r.pack) return allowed.has(r.pack);
            return true; 
        });
    }
    results = results.filter(r => {
        const c = foundry.utils.getProperty(r, 'system.container');
        if (typeof c === 'string' && c.trim() !== '' && c !== 'null') return false;
        if (c && typeof c === 'object' && c._id) return false;
        return true;
    });
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