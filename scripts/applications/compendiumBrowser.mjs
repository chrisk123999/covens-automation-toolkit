const {CompendiumBrowser} = dnd5e.applications;
export class CatCompendiumBrowser extends CompendiumBrowser {
    static DEFAULT_OPTIONS = {
        allowedPacks: [],
        customFilters: [],
        filterPredicate: null 
    };
    static async select(config = {}, renderOptions = {}) {
        for (const key of Object.keys(config)) {
            if (config[key] === undefined) delete config[key];
        }
        const tabData = dnd5e.applications.CompendiumBrowser.TABS.find(t => t.tab === config.tab);
        if (tabData && config.mode === undefined) {
            config.mode = tabData.advanced ?  
                dnd5e.applications.CompendiumBrowser.MODES.ADVANCED : 
                dnd5e.applications.CompendiumBrowser.MODES.BASIC;
        }
        return new Promise(resolve => {
            const browser = new CatCompendiumBrowser(config);
            browser.addEventListener('close', () => {
                resolve(browser.selected?.size ? browser.selected : null);
            }, {once: true});
            browser.render({force: true, ...renderOptions});
        });
    }
    async _prepareResultsContext(context, options) {
        context.filters ??= {};
        context.filters.arbitrary = [];
        if (typeof this.options.filterPredicate === 'function') {
            context.filters.arbitrary.push({
                _customPredicate: this.options.filterPredicate
            });
        }
        if (this.options.allowedPacks?.length) {
            context.filters.arbitrary.push({
                _allowedPacks: this.options.allowedPacks
            });
        }
        if (this.options.customFilters?.length) context.filters.arbitrary.push(...this.options.customFilters);
        return super._prepareResultsContext(context, options);
    }
}