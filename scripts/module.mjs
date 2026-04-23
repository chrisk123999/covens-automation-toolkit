import {registerHooks} from './hooks.mjs';
import {registerSettings} from './settings.mjs';
import * as lib from './lib/_module.mjs';
import * as utils from './utilities/_module.mjs';
import {buildApi} from './api.mjs';
import {test} from './test.mjs';
import * as patches from './patches/_module.mjs';
import * as integration from './integration/_modules.mjs';
Hooks.once('init', () => {
    registerSettings();
    lib.queries.registerQueries();
});
Hooks.once('libWrapper.Ready', () => {
    patches.activityPatching.patch(true); //Early so initial sheet render is correct.
    patches.dataModelPatching.patch(true);
});
Hooks.once('ready', () => {
    lib.constants.macros = new lib.Macros.RegisteredMacros();
    lib.constants.automations = new lib.Automations.RegisteredAutomations();
    lib.constants.scales = new lib.Scales.RegisteredScales();
    registerHooks();
    patches.documentPatching.patch(true);
    patches.effectPatching.patch(true);
    patches.actorPatching.patch(true);
    lib.constants.macros.registerFnMacro(test); // Testing
    lib.constants.scales.registerScale({ // More Testing
        source: 'cat',
        rules: 'all',
        identifier: 'test',
        data: {
            type: 'ScaleValue',
            configuration: {
                distance: {
                    units: ''
                },
                identifier: 'rage-damage',
                type: 'number',
                scale: {
                    1: {
                        value: 2
                    },
                    9: {
                        value: 3
                    },
                    16: {
                        value: 4
                    }
                }
            },
            value: {},
            title: 'Rage Damage',
            icon: null
        }
    });
    globalThis.cat = {
        api: buildApi(),
        lib,
        utils
    };
    integration.dnd5e.registerAutomations();
    integration.dnd5e.registerScales();
});