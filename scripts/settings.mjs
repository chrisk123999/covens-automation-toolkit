import {genericUtils} from './utilities/_module.mjs';
import {SettingsMenuBase} from './applications/_module.mjs';
import dicePatching from './patches/dice.mjs';

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
        menu: 'automation',
        default: {
            dnd5e: {
                enabled: true,
                priority: 60,
                pack: false
            },
            'dnd-players-handbook': {
                enabled: true,
                priority: 50,
                pack: false
            },
            'dnd-dungeon-masters-guide': {
                enabled: true,
                priority: 40,
                pack: false
            },
            'ddb-importer': {
                enabled: true,
                priority: 30,
                pack: false
            },
            'midi-qol': {
                enabled: true,
                priority: 20,
                pack: false
            }
        }
    },
    additionalCompendiums: {
        type: Object,
        menu: 'automation',
        default: {}
    },
    hideNames: {
        type: Boolean,
        default: false,
        menu: 'interface'
    },
    diceSoNice: {
        type: Boolean,
        default: true,
        menu: 'integration'
    },
    effectDescriptions: {
        type: Number,
        default: 2, // Change this to 0 once the setting menu is fixed.
        choices: {
            0: 'CAT.Generic.Disabled',
            1: 'CAT.Generic.Chat',
            2: 'DND5E.Description'
        },
        menu: 'interface'
    },
    effectDescriptionsNPC: {
        type: Boolean,
        default: false,
        menu: 'interface'
    },
    manualRollsEnabled: {
        type: Boolean,
        default: false,
        scope: 'world',
        menu: 'manualRolls',
        onChange: value => dicePatching.force(value)
    },
    manualRollsUsers: {
        type: Array,
        default: [],
        scope: 'world',
        menu: 'manualRolls'
    },
    manualRollsInclusion: {
        type: Number,
        default: 0,
        choices: {
            0: 'CAT.Settings.ManualRollsInclusion.0',
            1: 'CAT.Settings.ManualRollsInclusion.1',
            2: 'CAT.Settings.ManualRollsInclusion.2',
            3: 'CAT.Settings.ManualRollsInclusion.3',
            4: 'CAT.Settings.ManualRollsInclusion.4',
            5: 'CAT.Settings.ManualRollsInclusion.5'
        },
        scope: 'world',
        menu: 'manualRolls'
    },
    manualRollsPromptOnMiss: {
        type: Boolean,
        default: false,
        scope: 'world',
        menu: 'manualRolls'
    },
    manualRollsPromptNoData: {
        type: Boolean,
        default: false,
        scope: 'world',
        menu: 'manualRolls'
    },
    manualRollsEntryMode: {
        type: String,
        default: 'rollTotal',
        choices: {
            rollTotal: 'CAT.Settings.ManualRollsEntryMode.rollTotal',
            diceTotal: 'CAT.Settings.ManualRollsEntryMode.diceTotal',
            perDie: 'CAT.Settings.ManualRollsEntryMode.perDie'
        },
        scope: 'client',
        menu: 'manualRolls'
    },
    manualRollsGMFulfill: {
        type: Boolean,
        default: false,
        scope: 'world',
        menu: 'manualRolls'
    },
    manualRollsRichContext: {
        type: Boolean,
        default: false,
        scope: 'client',
        menu: 'manualRolls'
    }
};
const menus = {
    general: {
        icon: 'fas fa-gears'
    },
    automation: {
        icon: 'fas fa-layer-group'
    },
    backups: {
        icon: 'fas fa-floppy-disk'
    },
    compendiums: {
        icon: 'fas fa-atlas'
    },
    integration: {
        icon: 'fas fa-puzzle-piece'
    },
    interface: {
        icon: 'fas fa-display'
    },
    manualRolls: {
        icon: 'fas fa-calculator',
        restricted: false
    },
    mechanics: {
        icon: 'fas fa-dice'
    },
    permissions: {
        icon: 'fas fa-shield-keyhole'
    },
    summons: {
        icon: 'fas fa-dragon'
    },
    help: {
        icon: 'fas fa-screwdriver-wrench'
    },
    devtools: {
        icon: 'fas fa-tools'
    }
};

function addSetting(key, options) {
    const defaultOptions = {
        scope: 'world',
        config: false,
        name: 'CAT.Settings.' + key.capitalize() + '.Name',
        hint: 'CAT.Settings.' + key.capitalize() + '.Hint'
    };
    game.settings.register('cat', key, genericUtils.mergeObject(defaultOptions, options));
}
function addMenu(key, options) {
    const defaultOptions = {
        name: 'CAT.Settings.' + key.capitalize() + '.Name',
        label: 'CAT.Settings.' + key.capitalize() + '.Label',
        hint: 'CAT.Settings.' + key.capitalize() + '.Hint',
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
    Object.entries(settings).forEach(([key, options]) => {
        addSetting(key, options);
    });
    Object.entries(menus).forEach(([key, options]) => {
        addMenu(key, options);
    });
}