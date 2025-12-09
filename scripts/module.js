import {registerHooks} from './hooks.js';
import {constants} from './lib/constants.js';
import {test} from './test.js';
Hooks.once('init', () => {
    registerHooks();
});
Hooks.once('ready', () => {
    constants.init();
    constants.registeredMacros().registerFnMacro(test);
});