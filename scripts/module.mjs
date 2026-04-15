import {registerHooks} from './hooks.mjs';
import {registerSettings} from './settings.mjs';
import * as lib from './lib/_module.mjs';
import * as utils from './utilities/_module.mjs';
import {buildApi} from './api.mjs';
import {test} from './test.mjs';
import {activityPatching, actorPatching, documentPatching, effectPatching} from './patches/_module.mjs';
Hooks.once('init', () => {
    registerSettings();
    lib.queries.registerQueries();
});
Hooks.once('libWrapper.Ready', () => {
    activityPatching.patch(true); //Early so initial sheet render is correct.
});
Hooks.once('ready', () => {
    lib.constants.registeredMacros = new lib.Macros.RegisteredMacros();
    lib.constants.automations = new lib.Automations.RegisteredAutomations();
    registerHooks();
    documentPatching.patch(true);
    effectPatching.patch(true);
    actorPatching.patch(true);
    lib.constants.registeredMacros.registerFnMacro(test);
    globalThis.cat = {
        api: buildApi(),
        lib,
        utils
    };
});