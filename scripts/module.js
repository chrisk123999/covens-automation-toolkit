import {registerHooks} from './hooks.js';
Hooks.once('init', () => {
    registerHooks();
});