import genericUtils from '../utilities/genericUtils.mjs';
const {CompendiumBrowser} = dnd5e.applications;
export class CatCompendiumBrowser extends CompendiumBrowser {
    static DEFAULT_OPTIONS = genericUtils.mergeObject(super.DEFAULT_OPTIONS, {allowedPacks: [], filterPredicate: null}, {inplace: false});
    async _prepareResultsContext(context, options) {
        context.filters ??= {};
        context.filters.arbitrary ??= [];
        context.filters.arbitrary.push({
            _customPackFilter: this.options.allowedPacks,
            _customPredicate: this.options.filterPredicate
        });
        if (this.options.allowedPacks?.length > 0) {
            options.filters ??= {};
            options.filters.locked ??= {};
            options.filters.locked.packages = new Set(this.options.allowedPacks);
        }
        return super._prepareResultsContext(context, options);
    }
    static async fetch(documentClass, options = {}) {
        let allowedPacks = [];
        let customPredicate = null;
        if (options.filters) {
            const idx = options.filters.findIndex(f => '_customPackFilter' in f);
            if (idx !== -1) {
                allowedPacks = options.filters[idx]._customPackFilter ?? [];
                customPredicate = options.filters[idx]._customPredicate;
                options.filters.splice(idx, 1);
            }
        }
        let results = await super.fetch(documentClass, options);
        if (allowedPacks.length > 0) {
            const allowed = new Set(allowedPacks);
            results = results.filter(doc => {
                if (!doc.uuid) return false;
                const parts = doc.uuid.split('.');
                if (parts[0] === 'Compendium') {
                    const packId = parts[1] + '.' + parts[2];
                    return allowed.has(packId);
                }
                return false;
            });
        }
        if (typeof customPredicate === 'function') results = results.filter(customPredicate);
        return results;
    }
}