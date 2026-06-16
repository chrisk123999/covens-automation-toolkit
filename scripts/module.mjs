import {readyHooks, initHooks} from './hooks.mjs';
import {registerSettings} from './settings.mjs';
import * as lib from './lib/_module.mjs';
import * as utils from './utilities/_module.mjs';
import {buildApi} from './api.mjs';
import * as applications from './applications/_module.mjs';
import CatCombobox from './applications/elements/combobox.mjs';
import CatMultiCombobox from './applications/elements/multi-combobox.mjs';
import {test} from './test.mjs';
import * as patches from './patches/_module.mjs';
import * as integration from './integration/_modules.mjs';
import * as handlers from './handlers/_module.mjs';
customElements.define(CatCombobox.tagName, CatCombobox);
customElements.define(CatMultiCombobox.tagName, CatMultiCombobox);
Hooks.once('i18nInit', () => {
    integration.dae.initFlags();
});
Hooks.once('init', () => {
    initHooks();
    registerSettings();
    lib.queries.registerQueries();
    lib.constants.macros = new lib.Macros.RegisteredMacros();
    lib.constants.automations = new lib.Automations.RegisteredAutomations();
    lib.constants.scales = new lib.Scales.RegisteredScales();
    lib.constants.animations = new lib.Animations.RegisteredAnimations();
    handlers.quickConditions.registerHelpers();
    globalThis.cat = {
        api: buildApi(),
        applications,
        lib,
        utils
    };
    Hooks.callAll('catInit');
});
Hooks.once('libWrapper.Ready', () => {
    patches.activityPatching.patch(true); //Early so initial sheet render is correct.
    patches.dataModelPatching.patch(true);
    patches.itemPatching.patch(true);
    patches.dicePatching.patch(true);
});
let catGate;
const catInitGate = new Promise(resolve => {
    catGate = resolve;
});
Hooks.once('ready', async () => {
    lib.constants.summons = lib.SummonsManager.create();
    readyHooks();
    if (game.settings.get('cat', 'manualRollsEnabled')) patches.dicePatching.force(true);
    integration.dae.injectFlags();
    patches.documentPatching.patch(true);
    patches.actorPatching.patch(true);
    patches.effectPatching.patch(true);
    patches.compendiumBrowserPatching.patch(true);
    patches.combatPatching.patch(true);
    await utils.genericUtils.sleep(1000);
    await handlers.items.registerCompendiums({startup: true});
    catGate();
    Hooks.callAll('catReady');
});
Hooks.once('ddb-importer.compendiumCreationComplete', async () => {
    await catInitGate;
    const enabledSources = utils.automationUtils.getAutomationSources();
    if (enabledSources.includes('ddb-importer')) {
        await integration.ddbi.registerAutomations({register: enabledSources.includes('ddb-importer')});
        await integration.ddbi.registerScales({register: enabledSources.includes('ddb-importer')});
    }
});