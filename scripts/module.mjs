import {registerHooks} from './hooks.mjs';
import * as lib from './lib.mjs';
import * as utils from './utils.mjs';
import {api} from './api.mjs';
import {test} from './test.mjs';
// eslint-disable-next-line no-undef
Hooks.once('init', () => {
    registerHooks();
});
// eslint-disable-next-line no-undef
Hooks.once('ready', () => {
    lib.constants.registeredMacros = new lib.Macros.RegisteredMacros();
    lib.constants.registeredMacros.registerFnMacro(test);
    globalThis.cat = {
        api,
        lib,
        utils
    };
});