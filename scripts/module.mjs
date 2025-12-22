import {registerHooks} from './hooks.mjs';
import {registerSettings} from './settings.mjs';
import * as lib from './lib.mjs';
import * as utils from './utils.mjs';
import {api} from './api.mjs';
import {test} from './test.mjs';
import {auraEvents} from './event.mjs';
Hooks.once('init', () => {
    registerSettings();
    registerHooks();
    lib.queries.registerQueries();
});
Hooks.once('ready', () => {
    if (game.user.isGM) {
        game.settings.set('cat', 'gmID', game.user.id);
    }
    lib.constants.registeredMacros = new lib.Macros.RegisteredMacros();
    lib.constants.automations = new lib.Automations.RegisteredAutomations();
    lib.constants.gameReady = true;
    lib.constants.registeredMacros.registerFnMacro(test);
    globalThis.cat = {
        api,
        lib,
        utils
    };
    auraEvents.canvasReady(game.canvas);
});