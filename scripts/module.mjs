import {registerHooks} from './hooks.mjs';
import {Logging, constants, Macros} from './lib.mjs';
import {api} from './lib/api.mjs';
import * as utils from './utils.mjs';
import {test} from './test.mjs';
// eslint-disable-next-line no-undef
Hooks.once('init', () => {
    registerHooks();
});
// eslint-disable-next-line no-undef
Hooks.once('ready', () => {
    constants.registeredMacros = new Macros.RegisteredMacros();
    constants.registeredMacros.registerFnMacro(test);
    globalThis.cat = {
        api,
        lib: {
            Logging
        },
        utils
    };
});