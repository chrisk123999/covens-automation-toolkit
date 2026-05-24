import {genericUtils} from './utilities/_module.mjs';
import {SettingsMenuBase} from './applications/_module.mjs';

/**
 * Settings to register.
 * 
 * Required properties:
 *  key: {
 *    type,
 *    default,
 *    menu
 *  }
 * 
 * Optional properties:
 *  {
 *    onChange,
 *    choices,
 *    reloadRequired,
 *    select
 *  }
 */
const settings = {
    displayDebugLogs: {
        type: Boolean,
        default: true, // Change this to false eventually.
        menu: 'devtools'
    },
    automationSources: {
        type: Object,
        default: {
            dnd5e: {
                enabled: true,
                priority: 100,
                pack: false
            },
            'dnd-players-handbook': {
                enabled: true,
                priority: 99,
                pack: false
            },
            'dnd-dungeon-masters-guide': {
                enabled: true,
                priority: 98,
                pack: false
            },
            'ddb-importer': {
                enabled: true,
                priority: 97,
                pack: false
            },
            'midi-qol': {
                enabled: true,
                priority: 96,
                pack: false
            }
        }
    },
    hideNames: {
        type: Boolean,
        default: false
    }
};
const menus = {
    devtools: {
        icon: 'fas fa-tools'
    }
};

function addSetting(key, options) {
    const defaultOptions = {
        scope: 'world',
        config: false,
        name: 'CAT.Settings.' + key.titleCase() + '.Name',
        hint: 'CAT.Settings.' + key.titleCase() + '.Hint'
    };
    game.settings.register('cat', key, genericUtils.mergeObject(defaultOptions, options));
}
function addMenu(key, options) {
    const defaultOptions = {
        name: 'CAT.Settings.' + key.titleCase() + '.Name',
        label: 'CAT.Settings.' + key.titleCase() + '.Label',
        hint: 'CAT.Settings.' + key.titleCase() + '.Hint',
        type: createMenu(key),
        restricted: true
    };
    game.settings.registerMenu('cat', key, genericUtils.mergeObject(defaultOptions, options));
}
function createMenu(key) {
    return class SettingsMenu extends SettingsMenuBase {
        constructor() {
            super(key);
        }
    };
}
export function registerSettings() {
    Object.entries(settings).sort().forEach(([key, options]) => {
        addSetting(key, options);
    });
    Object.entries(menus).forEach(([key, options]) => {
        addMenu(key, options);
    });
}