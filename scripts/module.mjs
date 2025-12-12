import {registerHooks} from './hooks.mjs';
import {registerSettings} from './settings.mjs';
import * as lib from './lib.mjs';
import * as utils from './utils.mjs';
import {api} from './api.mjs';
import {test} from './test.mjs';
Hooks.once('init', () => {
    registerSettings();
    registerHooks();
});
Hooks.once('ready', () => {
    lib.constants.registeredMacros = new lib.Macros.RegisteredMacros();
    lib.constants.automations = new lib.Automations.RegisteredAutomations();
    lib.constants.registeredMacros.registerFnMacro(test);
    globalThis.cat = {
        api,
        lib,
        utils
    };
});