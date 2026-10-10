import {Logging} from '../lib/_module.mjs';
function doActivityEffects(wrapped, activity, activate, tokens, effectUuids = [], ...args) {
    const item = activity?.item;
    if (item && !item.actor?.items.has(item.id)) {
        const prefix = item.uuid + '.ActiveEffect.';
        effectUuids = effectUuids.map(uuid => uuid?.startsWith(prefix) ? '.ActiveEffect.' + uuid.slice(prefix.length) : uuid);
    }
    return wrapped(activity, activate, tokens, effectUuids, ...args);
}
const patches = [
    {path: 'DAE.doActivityEffects', fn: doActivityEffects, wrapType: 'WRAPPER'}
];
function patch(enabled) {
    for (const entry of patches) {
        Logging.addEntry('DEBUG', (enabled ? 'Patching: ' : 'Unpatching: ') + entry.path, {force: true});
        if (enabled) libWrapper.register('cat', entry.path, entry.fn, entry.wrapType);
        else libWrapper.unregister('cat', entry.path);
    }
}
export default {
    patch
};
