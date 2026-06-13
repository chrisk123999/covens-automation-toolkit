const {CompendiumBrowser} = dnd5e.applications;
export class CatCompendiumBrowser extends CompendiumBrowser {
    static DEFAULT_OPTIONS = {
        allowedPacks: [],
        arbitraryFilters: []
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
        context.filters.arbitrary ??= [];
        if (this.options.allowedPacks?.length) {
            context.filters.arbitrary.push({
                o: 'OR',
                v: this.options.allowedPacks.map(packId => ({
                    k: 'uuid',
                    o: 'icontains',
                    v: packId
                }))
            });
        }
        if (this.options.arbitraryFilters?.length) context.filters.arbitrary.push(...this.options.arbitraryFilters);
        return super._prepareResultsContext(context, options);
    }
}