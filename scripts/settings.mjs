import {SettingsMenuBase, TroubleshooterApp} from './applications/_module.mjs';
import customMacros from './handlers/customMacros.mjs';
import items from './handlers/items.mjs';
import {Auras} from './lib/_module.mjs';
import {dicePatching} from './patches/_module.mjs';
import {genericUtils} from './utilities/_module.mjs';

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
 *    packSelect,
 *    reloadRequired,
 *    select
 *  }
 */
const permissionChoices = {
    1: 'USER.RolePlayer',
    2: 'USER.RoleTrusted',
    3: 'USER.RoleAssistant',
    4: 'USER.RoleGamemaster'
};
const settings = {
    windowPositions: {
        type: Object,
        default: {},
        scope: 'client'
    },
    welcomes: {
        type: Object,
        default: {}
    },
    displayDebugLogs: {
        type: Boolean,
        default: false,
        menu: 'devtools'
    },
    displayDebugEventData: {
        type: Boolean,
        default: false,
        menu: 'devtools'
    },
    fixDescriptionEnrichers: {
        type: Boolean,
        default: false,
        menu: 'general'
    },
    automationSources: {
        type: Object,
        menu: 'automation',
        default: {
            dnd5e: {
                enabled: false,
                priority: 60,
                pack: false
            },
            'dnd-players-handbook': {
                enabled: false,
                priority: 50,
                pack: false
            },
            'dnd-dungeon-masters-guide': {
                enabled: false,
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
            },
            'chris-premades': {
                enabled: true,
                priority: 10,
                pack: false
            }
        },
        onChange: async () => items.registerCompendiums()
    },
    hideNames: {
        type: Boolean,
        default: false,
        menu: 'interface'
    },
    hideActivitiesOnActorSheet: {
        type: Boolean,
        default: false,
        menu: 'interface'
    },
    diceSoNice: {
        type: Boolean,
        default: true,
        menu: 'integration'
    },
    animationPriority: {
        type: String,
        default: 'cat',
        choices: {
            cat: 'CAT.Settings.AnimationPriority.Cat',
            module: 'CAT.Settings.AnimationPriority.Module',
            both: 'CAT.Settings.AnimationPriority.Both'
        },
        menu: 'integration'
    },
    effectDescriptions: {
        type: Number,
        default: 0,
        choices: {
            0: 'CAT.Generic.Disabled',
            1: 'CAT.Generic.Chat',
            2: 'DND5E.Description'
        },
        menu: 'interface'
    },
    autoRecharge: {
        type: String,
        default: 'no',
        choices: {
            no: 'SETTINGS.DND5E.NPCS.AutoRecharge.No',
            silent: 'SETTINGS.DND5E.NPCS.AutoRecharge.Silent',
            yes: 'SETTINGS.DND5E.NPCS.AutoRecharge.Yes'
        },
        menu: 'mechanics'
    },
    auraCombatOnly: {
        type: Boolean,
        default: false,
        menu: 'mechanics',
        onChange: () => Auras.resyncScenes(game.scenes.contents)
    },
    placedRegionVisibility: {
        type: String,
        default: 'layer',
        choices: {
            layer: 'CAT.Settings.PlacedRegionVisibility.layer',
            always: 'CAT.Settings.PlacedRegionVisibility.always'
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
    },
    automaticBackups: {
        type: Boolean,
        default: false,
        menu: 'backups'
    },
    backupCompendium: {
        type: String,
        default: '',
        packSelect: {type: 'Actor', packageType: 'world'},
        menu: 'backups'
    },
    backupFrequency: {
        type: Number,
        default: 79200000,
        choices: {
            79200000: 'CAT.Backups.Daily',
            597600000: 'CAT.Backups.Weekly',
            2622546000: 'CAT.Backups.Monthly'
        },
        menu: 'backups'
    },
    backupRetention: {
        type: Number,
        default: 0,
        choices: {
            0: 'CAT.Backups.Forever',
            604800000: 'CAT.Backups.OneWeek',
            1209600000: 'CAT.Backups.TwoWeeks',
            2629746000: 'CAT.Backups.OneMonth',
            7889238000: 'CAT.Backups.ThreeMonths',
            15778476000: 'CAT.Backups.SixMonths',
            31556952000: 'CAT.Backups.OneYear'
        },
        menu: 'backups'
    },
    backupTime: {
        type: Number,
        default: 0
    },
    monsterCompendiums: {
        type: Object,
        default: {
            'dnd5e.actors24': {
                enabled: true,
                priority: 70
            },
            'dnd5e.monsters': {
                enabled: true,
                priority: 60
            },
            'dnd-players-handbook.actors': {
                enabled: true,
                priority: 50
            },
            'dnd-dungeon-masters-guide.actors': {
                enabled: true,
                priority: 40
            }
        },
        scope: 'world',
        menu: 'compendiums'
    },
    itemCompendiums: {
        type: Object,
        default: {
            'dnd5e.equipment24': {
                enabled: true,
                priority: 70
            },
            'dnd5e.items': {
                enabled: true,
                priority: 60
            },
            'dnd5e.tradegoods': {
                enabled: true,
                priority: 50
            },
            'dnd-players-handbook.equipment': {
                enabled: true,
                priority: 40
            },
            'dnd-dungeon-masters-guide.equipment': {
                enabled: true,
                priority: 30
            }
        },
        scope: 'world',
        menu: 'compendiums'
    },
    spellCompendiums: {
        type: Object,
        default: {
            'dnd5e.spells24': {
                enabled: true,
                priority: 70
            },
            'dnd5e.spells': {
                enabled: true,
                priority: 60
            },
            'dnd-players-handbook.spells': {
                enabled: true,
                priority: 50
            }
        },
        scope: 'world',
        menu: 'compendiums'
    },
    spellListJournals: {
        type: Object,
        default: {},
        scope: 'world',
        menu: 'compendiums'
    },
    macroCompendiums: {
        type: Object,
        default: {},
        scope: 'world',
        menu: 'compendiums',
        onChange: () => customMacros.load()
    },
    permissionsAutomation: {
        type: Number,
        default: 4,
        choices: permissionChoices,
        menu: 'permissions'
    },
    permissionsConfiguration: {
        type: Number,
        default: 1,
        choices: permissionChoices,
        menu: 'permissions'
    },
    permissionsGeneric: {
        type: Number,
        default: 4,
        choices: permissionChoices,
        menu: 'permissions'
    },
    permissionsEmbedded: {
        type: Number,
        default: 4,
        choices: permissionChoices,
        menu: 'permissions'
    },
    permissionsDocProps: {
        type: Number,
        default: 4,
        choices: permissionChoices,
        menu: 'permissions'
    },
    permissionsMacros: {
        type: Number,
        default: 4,
        choices: permissionChoices,
        menu: 'permissions'
    },
    permissionsPlacedRegion: {
        type: Number,
        default: 4,
        choices: permissionChoices,
        menu: 'permissions'
    },
    hideTroubleshooterWarnings: {
        type: Boolean,
        default: false,
        name: 'CAT.Troubleshooter.HideWarnings.Name',
        hint: 'CAT.Troubleshooter.HideWarnings.Hint'
    },
    exportStripDialog: {
        type: Boolean,
        default: true,
        scope: 'client',
        name: 'CAT.Troubleshooter.StripDialog.Name',
        hint: 'CAT.Troubleshooter.StripDialog.Hint'
    }
};
const menus = {
    help: {
        icon: 'fas fa-stethoscope',
        type: TroubleshooterApp
    },
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
