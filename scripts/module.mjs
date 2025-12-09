import {registerHooks} from './hooks.mjs';
import {constants} from './lib/constants.mjs';
import {test} from './test.mjs';
Hooks.once('init', () => {
    registerHooks();
});
Hooks.once('ready', () => {
    constants.init();
    constants.registeredMacros().registerFnMacro(test);
});