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
                priority: 100
            },
            'dnd-players-handbook': {
                enabled: true,
                priority: 99
            },
            'dnd-dungeon-masters-guide': {
                enabled: true,
                priority: 98
            },
            'ddb-importer': {
                enabled: true,
                priority: 97
            },
            'midi-qol': {
                enabled: true,
                priority: 96
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
        name: 'CAT.Settings.' + key + '.Name',
        hint: 'CAT.Settings.' + key + '.Hint'
    };
    game.settings.register('cat', key, genericUtils.mergeObject(defaultOptions, options));
}
function addMenu(key, options) {
    const defaultOptions = {
        name: 'CAT.Settings.' + key + '.Name',
        label: 'CAT.Settings.' + key + '.Label',
        hint: 'CAT.Settings.' + key + '.Hint',
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