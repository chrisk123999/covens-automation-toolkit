import {RegisteredAnimations} from './animation.mjs';
import {RegisteredAutomations} from './automations.mjs';
import {RegisteredMacros} from './macros.mjs';
import {RegisteredScales} from './scales.mjs';
import {SummonsManager} from './summons.mjs';
import {default as Triggers} from './trigger.mjs';
const rules = {
    all: 'all',
    2014: '2014',
    2024: '2024'
};
/**
 * Roll workflow passes, in firing order.
 *
 * A macro binds to `<prefix><Pass>`, such as `activityDamageRollComplete` or `targetAttackRollConfig`. The prefix
 * names where the macro is stored relative to the roll:
 * - `activity`, `item`, `enchantment`: the activity used, its item, or an enchantment applied to that item.
 * - `castEnchantment`: the activity that cast a spell item, when the item came from a cast activity.
 * - `actor`: the user, its token, and its items, activities and active effects.
 * - `token`, `region`, `level`, `scene`, `nearby`: the user's token, its regions, its level, or the scene.
 * - `target`: each target's token, actor documents and regions.
 * - `group`, `encounter`, `vehicle`: groups, encounters and vehicles the user belongs to.
 *
 * Macros receive `{workflow, activity, item, actor, token, scene, regions, level, document, castData}`.
 * Target-prefixed macros also receive `sourceToken`, the target's token.
 * @enum {string}
 */
const workflowPasses = {
    /** Before targets are chosen. Receives `config`, `dialog` and `message` instead of `workflow`. Return true to cancel the use. */
    preTargeting: 'preTargeting',
    /** Before the activity rolls. Return true to cancel the use. Consumption is refunded unless the `keepConsumption` workflow property is set. */
    preItemRoll: 'preItemRoll',
    /** Edit the target set. Return true to skip `preambleComplete`. */
    targeting: 'targeting',
    /** Targets are final. Return true to cancel the use. */
    preambleComplete: 'preambleComplete',
    /** Before the attack roll. Adjust advantage, disadvantage and roll parts. */
    attackRollConfig: 'attackRollConfig',
    /** After the attack roll. Re-roll or edit the roll here; do not re-roll it in a later pass. */
    attackRoll: 'attackRoll',
    /** Add attack bonuses before the result is compared to target AC. */
    attackRollBonuses: 'attackRollBonuses',
    /** Add attack bonuses after the result is compared to target AC. */
    attackRollMissedBonuses: 'attackRollMissedBonuses',
    /** Collects optional attack bonuses for the combined dialog. Return a `D20Bonus`. */
    optionalBonusAttack: 'optionalBonusAttack',
    /** The attack roll is final. Read only. */
    attackRollComplete: 'attackRollComplete',
    /** Saves are rolled. `hitTargets` and `failedSaves` can still be edited. */
    savesComplete: 'savesComplete',
    /** After the damage roll. Re-roll or edit the rolls here; do not re-roll them in a later pass. */
    damageRoll: 'damageRoll',
    /** Collects optional damage bonuses for the combined dialog. Return a `DamageBonus`. */
    optionalBonusDamage: 'optionalBonusDamage',
    /** Add damage bonuses to the rolls. */
    damageRollBonuses: 'damageRollBonuses',
    /** The damage rolls are final. Read only. */
    damageRollComplete: 'damageRollComplete',
    /** After the utility roll. Re-roll or edit the roll here; do not re-roll it in a later pass. */
    utilityRoll: 'utilityRoll',
    /** Add bonuses to the utility roll. */
    utilityRollBonuses: 'utilityRollBonuses',
    /** The utility roll is final. Read only. */
    utilityRollComplete: 'utilityRollComplete',
    /** Per target, before damage applies. Also receives `targetToken` and `ditem`. Adjust that target's damage. */
    damage: 'damage',
    /** Per target. Add damage for that target only. */
    damageBonuses: 'damageBonuses',
    /** Per target. Flat damage reductions. */
    damageFlatReductions: 'damageFlatReductions',
    /** Per target. Percentage damage reductions. */
    damagePercentReductions: 'damagePercentReductions',
    /** Per target. Final edits, such as preventing death. */
    damageComplete: 'damageComplete',
    /** The roll is done. For macros that do not edit the workflow. */
    rollFinished: 'rollFinished',
    /** After `rollFinished`. Reactions to being hit, such as retaliation. */
    onHit: 'onHit',
    /** Last pass. Clean up anything left by earlier passes. */
    cleanup: 'cleanup'
};
const workflowHookNames = {
    preTargeting: 'midi-qol.preTargeting',
    preItemRoll: 'midi-qol.premades.postNoAction',
    preambleComplete: 'midi-qol.premades.postPreambleComplete',
    preAttackRollConfig: 'midi-qol.premades.preAttackRollConfig',
    preRollAttack: 'dnd5e.preRollAttackV2',
    postAttackRoll: 'midi-qol.premades.postWaitForAttackRoll',
    attackRollComplete: 'midi-qol.premades.postAttackRollComplete',
    preTargetSave: 'midi-qol.preTargetSave',
    savesComplete: 'midi-qol.premades.postSavesComplete',
    damageRollComplete: 'midi-qol.premades.preDamageRollComplete',
    utilityRollComplete: 'midi-qol.premades.preUtilityRollComplete',
    preTargetDamageApplication: 'midi-qol.preTargetDamageApplication',
    rollFinished: 'midi-qol.premades.postRollFinished',
    regionPlaced: 'midi-qol.premades.postTemplatePlaced'
};
/**
 * Grapple and shove passes. Descriptor key: `grapple`.
 *
 * Prefixes: `token`, `actor`, `scene`, `nearby`, `region`, `level`, `group`, `encounter` or `vehicle` for the grappler, and `target` for the creature grappled or shoved.
 * Macros also receive `targetToken` and `data`.
 * @enum {string}
 */
const grapplePasses = {
    /** Before the size check. Return a number to add to the grappler's size category. Receives `data.identifier` and `data.size`. */
    sizeCheck: 'grappleShoveSizeCheck',
    /** Before the grapple or shove applies. */
    preGrapple: 'preGrapple',
    /** After the grapple or shove applies. */
    postGrapple: 'postGrapple',
    /** Before an escape attempt. The grappled creature is `targetToken`. */
    preEscape: 'preEscape',
    /** After an escape attempt. */
    postEscape: 'postEscape'
};
/**
 * Token movement passes. Descriptor key: `move`.
 *
 * Prefixes: `actor`, `scene`, `nearby`, `region`, `level`, `group`, `encounter` or `vehicle`.
 * Macros also receive `options`, `destination`, `animation`, `range`, `sourceToken`, `teleport` and `action`.
 * @enum {string}
 */
const movementPasses = {
    /** After the token moves. */
    moved: 'moved',
    /** Before the teleport crosshair is shown. Return true to cancel the teleport. */
    aimTeleport: 'aimTeleport',
    /** Before a teleport moves the token. Return true to cancel it. */
    preTeleport: 'preTeleport',
    /** After a teleport moves the token. */
    postTeleport: 'postTeleport',
    /** Before a displacement moves the token. Return true to cancel it. */
    displace: 'displace',
    /** Before a push or pull. Return a number to add to the distance, or 0 to cancel the move. */
    slide: 'slide'
};
const movementHookNames = {
    moveToken: 'moveToken'
};
const effectHookNames = {
    createActiveEffect: 'createActiveEffect',
    deleteActiveEffect: 'deleteActiveEffect',
    updateActiveEffect: 'updateActiveEffect',
    preCreateActiveEffect: 'preCreateActiveEffect',
    preDeleteActiveEffect: 'preDeleteActiveEffect',
    preUpdateActiveEffect: 'preUpdateActiveEffect',
    suppressionChanged: 'dae.suppressionChanged'
};
/**
 * Active effect passes. Descriptor key: `effect`.
 *
 * The effect's own macros bind to the bare pass name, such as `created`. Other macros use the prefixes
 * `actor`, `scene`, `nearby`, `region`, `level`, `group`, `encounter` or `vehicle` for the effect's actor.
 * Macros also receive `effect`, `options` and `updates`.
 * @enum {string}
 */
const effectPasses = {
    /** After the effect is created. */
    created: 'created',
    /** After the effect is deleted. */
    deleted: 'deleted',
    /** After the effect is updated. */
    updated: 'updated',
    /** Before the effect is created. Runs synchronously. */
    preCreated: 'preCreated',
    /** Before the effect is deleted. Runs synchronously. */
    preDeleted: 'preDeleted',
    /** Before the effect is updated. Runs synchronously. */
    preUpdated: 'preUpdated',
    /** Before creation, with the effect data as `effect`. Return true to prevent the effect being created. */
    doCreated: 'doCreated',
    /** Before an actor's own effect is deleted. Return true to prevent the deletion. */
    doDeleted: 'doDeleted'
};
/**
 * Combat passes. Descriptor key: `combat`.
 *
 * Prefixes: `actor`, `scene`, `nearby`, `region`, `level`, `group`, `encounter` or `vehicle`.
 * Macros also receive `context`, `combatant`, `previousCombatant`, `round`, `turn`, `previousRound` and `previousTurn`.
 * @enum {string}
 */
const combatPasses = {
    /** For the combatant whose turn ended. */
    turnEnd: 'turnEnd',
    /** For every token in the scene, at the start of each turn. */
    everyTurn: 'everyTurn',
    /** For the combatant whose turn started. */
    turnStart: 'turnStart',
    /** For each combatant when combat starts. */
    combatStart: 'combatStart',
    /** For each combatant when combat is deleted. */
    combatEnd: 'combatEnd'
};
const combatHookNames = {
    updateCombat: 'updateCombat',
    combatStart: 'combatStart',
    preUpdateCombat: 'preUpdateCombat',
    deleteCombat: 'deleteCombat',
    preUpdateCombatant: 'preUpdateCombatant',
    updateCombatant: 'updateCombatant'
};
/**
 * Aura passes. Descriptor key: `aura`.
 * @enum {string}
 */
const auraPasses = {
    /** Decides whether a token is inside an aura. Receives `source`, `target`, `sourceToken`, `targetToken`, `descriptor` and `distance`. Return true to include the token. */
    filter: 'filter'
};
const auraHookNames = {
    catReady: 'catReady',
    canvasReady: 'canvasReady',
    createScene: 'createScene',
    deleteScene: 'deleteScene',
    updateScene: 'updateScene',
    updateCombat: 'updateCombat',
    deleteCombat: 'deleteCombat',
    createToken: 'createToken',
    updateToken: 'updateToken',
    deleteToken: 'deleteToken',
    createItem: 'createItem',
    updateItem: 'updateItem',
    deleteItem: 'deleteItem',
    createActiveEffect: 'createActiveEffect',
    updateActiveEffect: 'updateActiveEffect',
    deleteActiveEffect: 'deleteActiveEffect',
    updateActor: 'updateActor',
    deleteActor: 'deleteActor'
};
const auraTriggers = {
    enter: 'enter',
    exit: 'exit',
    turnStart: 'turnStart',
    turnEnd: 'turnEnd'
};
const auraMembershipKeys = ['x', 'y', 'elevation', 'width', 'height', 'hidden', 'disposition', 'level'];
const auraActorKeys = ['actorId', 'actorLink', 'delta'];
const auraItemPaths = ['flags.cat.macros', 'flags.cat.genericConfig', 'flags.cat.embeddedMacros', 'system.activities'];
const regionHooksNames = {
    createRegion: 'createRegion',
    updateRegion: 'updateRegion',
    deleteRegion: 'deleteRegion',
    preCreateRegion: 'preCreateRegion',
    preUpdateRegion: 'preUpdateRegion'
};
/**
 * Region passes. Descriptor key: `region`.
 *
 * The region's own macros bind to the bare pass name, such as `enter`. Macros receive `tokens`, `workflow`, `options` and `updates`.
 * `left`, `enter`, `stay` and `passedThrough` fire when a token moves. `entered`, `exited`, `stayed` and `passedOver` fire when the region moves.
 * @enum {string}
 */
const regionPasses = {
    /** After the region is created. Regions placed by an activity also receive `workflow`. */
    created: 'created',
    /** After the region is updated. */
    updated: 'updated',
    /** After the region is deleted. */
    deleted: 'deleted',
    /** A moving token left the region. */
    left: 'left',
    /** A moving token entered the region. */
    enter: 'enter',
    /** A moving token stayed inside the region. */
    stay: 'stay',
    /** A moving token entered and left the region in one move. */
    passedThrough: 'passedThrough',
    /** The moving region now covers the token. */
    entered: 'entered',
    /** The moving region no longer covers the token. */
    exited: 'exited',
    /** The moving region still covers the token. */
    stayed: 'stayed',
    /** The moving region passed over the token. */
    passedOver: 'passedOver'
};
/**
 * Item passes. Descriptor key: `item`.
 *
 * The item's own macros bind to the bare pass name, such as `equipped`. Other macros use the prefixes
 * `actor`, `scene`, `nearby`, `region`, `level`, `group`, `encounter` or `vehicle` for the item's actor.
 * Macros also receive `options` and `updates`.
 * @enum {string}
 */
const itemPasses = {
    /** After the item is created. */
    created: 'created',
    /** After the item is deleted. */
    deleted: 'deleted',
    /** After the item is updated. */
    updated: 'updated',
    /** Once for a batch of items. CAT does not fire it. */
    bulkUpdated: 'bulkUpdated',
    /** For each item on an actor imported by D&D Beyond Importer. Receives `ddbCharacter`. */
    munched: 'munched',
    /** After the item is equipped. */
    equipped: 'equipped',
    /** After the item is unequipped. */
    unequipped: 'unequipped',
    /** After the item becomes active: equipped, and attuned if it requires attunement. */
    attuned: 'attuned',
    /** After the item stops being active. */
    unattuned: 'unattuned',
    /** After an automation is applied to the item on an actor. */
    medkit: 'medkit'
};
const itemHookNames = {
    createItem: 'createItem',
    deleteItem: 'deleteItem',
    updateItem: 'updateItem',
    munched: 'ddb-importer.characterProcessDataComplete',
    preUpdateItem: 'preUpdateItem'
};
const contextMenuHookNames = {
    getActorContextOptions: 'getActorContextOptions',
    getItemContextOptions: 'getItemContextOptions',
    getSceneContextOptions: 'getSceneContextOptions',
    getCompendiumContextOptions: 'getCompendiumContextOptions',
    getSheetItemContextOptions: 'dnd5e.getItemContextOptions',
    getSheetEffectContextOptions: 'dnd5e.getActiveEffectContextOptions',
    getSheetActivityContextOptions: 'dnd5e.getItemActivityContext'
};
const sheetHookNames = {
    getHeaderControlsActiveEffectConfig: 'getHeaderControlsActiveEffectConfig',
    getHeaderControlsActivitySheet: 'getHeaderControlsActivitySheet',
    renderActivitySheet: 'renderActivitySheet',
    getHeaderControlsActorSheetV2: 'getHeaderControlsActorSheetV2',
    getHeaderControlsCompendium: 'getHeaderControlsCompendium',
    getHeaderControlsItemSheet5e: 'getHeaderControlsItemSheet5e',
    renderItemSheet5e: 'renderItemSheet5e',
    renderBaseActorSheet: 'renderBaseActorSheet',
    getHeaderControlsLevelConfig: 'getHeaderControlsLevelConfig',
    getHeaderControlsRegionConfig: 'getHeaderControlsRegionConfig',
    getHeaderControlsSceneConfig: 'getHeaderControlsSceneConfig',
    getHeaderControlsTokenConfig: 'getHeaderControlsTokenConfig',
    renderSourceConfig: 'renderSourceConfig'
};
const restHookNames = {
    restCompleted: 'dnd5e.restCompleted'
};
/**
 * Rest passes. Descriptor key: `rest`.
 *
 * Prefixes: `actor`, `scene`, `nearby`, `region`, `level`, `group`, `encounter` or `vehicle`.
 * Macros also receive `result` and `config`.
 * @enum {string}
 */
const restPasses = {
    /** After any rest, including a long rest. */
    short: 'short',
    /** After a long rest. */
    long: 'long'
};
/**
 * Check, save, skill and tool roll passes. Descriptor keys: `check`, `save`, `skill` and `tool`.
 *
 * Prefixes: `actor`, `scene`, `nearby`, `region`, `level`, `group`, `encounter` or `vehicle`.
 * Macros also receive `config`, `dialog`, `message`, `options`, `D20Bonus` and the roll's id as `checkId`, `saveId`,
 * `skillId` or `toolId`. Passes after the roll also receive `roll`.
 * @enum {string}
 */
const rollPasses = {
    /** Before the roll. Edit `options` to add advantage, disadvantage or other roll options. */
    situational: 'situational',
    /** Before the roll. Return `{type, label}`, with `type` of `advantage` or `disadvantage`, to offer it in a dialog. */
    context: 'context',
    /** After the roll. Return a `Roll` to replace it. */
    bonus: 'bonus',
    /** Collects optional bonuses for the combined dialog. Return a `D20Bonus`. */
    optionalBonus: 'optionalBonus',
    /** After the roll is posted to chat. Read only. */
    post: 'post',
    /** As `situational`, only for rolls requested by an activity. */
    targetSituational: 'targetSituational'
};
/**
 * Phases of the combined optional bonus dialog.
 * @enum {string}
 */
const bonusPhases = {
    /** Before the roll. */
    preRoll: 'preRoll',
    /** After the roll, before success or failure is known. */
    preResult: 'preResult',
    /** After success or failure is known. */
    postResult: 'postResult'
};
const timeHookNames = {
    updateWorldTime: 'updateWorldTime'
};
/**
 * World time passes. Descriptor key: `time`.
 *
 * Prefixes: `actor`, `scene`, `nearby`, `region`, `level`, `group`, `encounter` or `vehicle`.
 * Fires for each actor with a token on the viewed scene and for every player character.
 * Macros also receive `worldTime`, `diff` and `options`.
 * @enum {string}
 */
const timePasses = {
    /** After world time changes. */
    timeUpdated: 'timeUpdated'
};
const actorHookNames = {
    updateActor: 'updateActor',
    preDeleteActor: 'preDeleteActor'
};
/**
 * Summon passes. Descriptor key: `summon`.
 *
 * The document that summoned binds to the bare pass name, such as `create`. Other macros use the prefixes
 * `actor`, `scene`, `nearby`, `region`, `level`, `group`, `encounter` or `vehicle` for the summoner.
 * Macros also receive `summon` and `updates`.
 * @enum {string}
 */
const summonPasses = {
    /** Before the summon is created. Edit `updates` to change it. */
    preCreate: 'preCreate',
    /** After the summon is created. */
    create: 'create',
    /** Before the summon is deleted. */
    preDelete: 'preDelete',
    /** After the summon is deleted. */
    delete: 'delete',
    /** Reserved. CAT does not fire it. */
    placed: 'placed',
    /** Before the summon's token is removed from the scene. */
    removed: 'removed'
};
const tokenHookNames = {
    preDeleteToken: 'preDeleteToken',
    preCreateToken: 'preCreateToken'
};
const miscHookNames = {
    itemUseActivitySelect: 'midi-qol.itemUseActivitySelect',
    applyActiveEffect: 'applyActiveEffect',
    daeSetFieldData: 'dae.setFieldData',
    daeModifySpecials: 'dae.modifySpecials',
    vaeCreateEffectButtons: 'visual-active-effects.createEffectButtons',
    tidyReady: 'tidy5e-sheet.ready',
    tidyGetActivitiesForPlay: 'tidy5e-sheet.getActivitiesForPlay',
    renderTidy5eItemSheetQuadrone: 'renderTidy5eItemSheetQuadrone',
    renderTidy5eCharacterSheetQuadrone: 'renderTidy5eCharacterSheetQuadrone',
    renderTidy5eNpcSheetQuadrone: 'renderTidy5eNpcSheetQuadrone',
    renderCombatTracker: 'renderCombatTracker',
    macroautocomplete: 'macro-autocomplete.ready',
    renderChatMessageHTML: 'renderChatMessageHTML',
    aaWorkflowStart: 'AutomatedAnimations-WorkflowStart',
    preUseActivity: 'dnd5e.preUseActivity'
};
const MEDKIT_STATUSES = {
    UNKNOWN: 'unknown',
    OUTDATED: 'outdated',
    AVAILABLE: 'available',
    UP_TO_DATE: 'up-to-date',
    CONFIGURABLE: 'configurable'
};
const automationStatus = {
    UNAVAILABLE: -2,
    AVAILABLE: -1,
    OUTDATED: 0,
    UP_TO_DATE: 1,
    CONFIGURABLE: 2,
    GENERIC: 3
};
const attacks = [
    'msak',
    'rsak',
    'mwak',
    'rwak'
];
const meleeAttacks = [
    'mwak',
    'msak'
];
const rangedAttacks = [
    'rwak',
    'rsak'
];
const weaponAttacks = [
    'mwak',
    'rwak'
];
const spellAttacks = [
    'msak',
    'rsak'
];
const rangedWeaponAttacks = [
    'rwak'
];
const meleeWeaponAttacks = [
    'mwak'
];
const rangedSpellAttacks = [
    'rsak'
];
const meleeSpellAttacks = [
    'msak'
];
const statusEffectKeys = [
    'macro.CE',
    'macro.StatusEffect',
    'StatusEffect'
];
function getItemKeepPaths({spell = false} = {}) {
    const paths = [
        '_stats.compendiumSource',
        'flags.ddbimporter',
        'flags.dnd5e.advancementOrigin',
        'flags.dnd5e.advancementRoot',
        'flags.dnd5e.cachedFor',
        'flags.dnd5e.sourceId',
        'flags.tidy5e-sheet',
        'folder',
        'name',
        'system.advancement',
        'system.attunement',
        'system.chatFlavor',
        'system.container',
        'system.description.chat',
        'system.description.value',
        'system.equipped',
        'system.materials',
        'system.quantity',
        'system.source',
        'system.sourceItem',
        'system.prepared',
        'system.method',
        'flags.core.sourceId',
        'flags.cat.config',
        'ownership',
        'sort'
    ];
    if (spell) {
        paths.push('system.uses');
    }
    return paths;
}
const massApplyExcludeSources = [
    'dnd-dungeon-masters-guide',
    'dnd5e',
    'dnd-players-handbook'
];
const damageIcons = {
    acid: 'icons/magic/acid/projectile-faceted-glob.webp',
    bludgeoning: 'icons/magic/earth/projectiles-stone-salvo-gray.webp',
    cold: 'icons/magic/air/wind-tornado-wall-blue.webp',
    fire: 'icons/magic/fire/beam-jet-stream-embers.webp',
    force: 'icons/magic/sonic/projectile-sound-rings-wave.webp',
    lightning: 'icons/magic/lightning/bolt-blue.webp',
    necrotic: 'icons/magic/unholy/projectile-bolts-salvo-pink.webp',
    piercing: 'icons/skills/melee/strike-polearm-light-orange.webp',
    poison: 'icons/magic/death/skull-poison-green.webp',
    psychic: 'icons/magic/control/fear-fright-monster-grin-red-orange.webp',
    radiant: 'icons/magic/holy/projectiles-blades-salvo-yellow.webp',
    slashing: 'icons/skills/melee/strike-sword-gray.webp',
    thunder: 'icons/magic/sonic/explosion-shock-wave-teal.webp',
    no: 'icons/svg/cancel.svg'
};
const elementalDamageTypes = ['acid', 'cold', 'fire', 'lightning', 'thunder'];
const damageTypeGroups = {
    physical: 'CAT.Generic.DamageGroups.Physical',
    elemental: 'CAT.Generic.DamageGroups.Elemental',
    other: 'CAT.Generic.DamageGroups.Other'
};
const damageTypeGroupOrder = Object.keys(damageTypeGroups);
function getDamageTypeGroup(type) {
    if (CONFIG.DND5E.damageTypes[type]?.isPhysical) return 'physical';
    if (elementalDamageTypes.includes(type)) return 'elemental';
    return 'other';
}
const tempConditionIcon = 'icons/magic/time/arrows-circling-green.webp';
const grappleIcon = 'icons/magic/control/buff-strength-muscle-damage-red.webp';
const grappleEscapeIcon = 'icons/skills/movement/arrows-up-trio-red.webp';
const itemIconOverrides = {
    feat: 'systems/dnd5e/icons/svg/items/feature.svg'
};
const methodIconOverrides = {
    atwill: 'icons/magic/unholy/hands-cloud-light-pink.webp',
    innate: 'icons/magic/light/hand-sparks-glow-yellow.webp',
    ritual: 'systems/dnd5e/icons/svg/items/spell.svg',
    spell: 'systems/dnd5e/icons/spell-tiers/spell9.webp'
};
const attackTypes = [
    'attack',
    'meleeAttack',
    'rangedAttack',
    'weaponAttack',
    'spellAttack',
    'rangedWeaponAttack',
    'meleeWeaponAttack',
    'rangedSpellAttack',
    'meleeSpellAttack'
];
const meleeWeapons = [];
const rangedWeapons = [];
const tools = [];
const weapons = [];
export async function getPackConstants() {
    const weaponMap = CONFIG.DND5E.weaponTypeMap;
    for (const [id, uuid] of Object.entries(CONFIG.DND5E.weaponIds)) {
        const weapon = await fromUuid(uuid);
        if (!weapon) continue;
        const entry = {value: id, label: weapon.name, image: weapon.img};
        weapons.push(entry);
        if (weaponMap[weapon.system.type.value] === 'melee') meleeWeapons.push(entry);
        else if (weaponMap[weapon.system.type.value] === 'ranged') rangedWeapons.push(entry);
    }
    for (const [id, {id: uuid}] of Object.entries(CONFIG.DND5E.tools)) {
        const tool = await fromUuid(uuid);
        if (!tool) continue;
        tools.push({value: id, label: tool.name, image: tool.img});
    }
}
const cachedTypes = new Set();
function triggerTypes() {
    if (cachedTypes.size) return cachedTypes;
    for (const cls of Object.values(Triggers)) {
        const type = cls.type;
        if (!type) continue;
        cachedTypes.add(type);
    }
    return cachedTypes;
}
export default {
    /** @type {RegisteredMacros} */
    macros: undefined,
    /** @type {RegisteredAutomations} */
    automations: undefined,
    /** @type {RegisteredScales} */
    scales: undefined,
    /** @type {RegisteredAnimations} */
    animations: undefined,
    /** @type {RegisteredTroubleshooterChecks} */
    troubleshooter: undefined,
    /** @type {SummonsManager} */
    summons: undefined,
    alternateAttributes: undefined,
    gameReady: false,
    rules,
    workflowPasses,
    workflowHookNames,
    grapplePasses,
    movementPasses,
    movementHookNames,
    effectHookNames,
    effectPasses,
    combatHookNames,
    combatPasses,
    auraPasses,
    auraHookNames,
    auraTriggers,
    auraMembershipKeys,
    auraActorKeys,
    auraItemPaths,
    regionHooksNames,
    regionPasses,
    itemPasses,
    itemHookNames,
    restHookNames,
    restPasses,
    rollPasses,
    sheetHookNames,
    timeHookNames,
    timePasses,
    actorHookNames,
    MEDKIT_STATUSES,
    contextMenuHookNames,
    attacks,
    meleeAttacks,
    rangedAttacks,
    weaponAttacks,
    spellAttacks,
    rangedWeaponAttacks,
    meleeWeaponAttacks,
    rangedSpellAttacks,
    meleeSpellAttacks,
    miscHookNames,
    bonusPhases,
    statusEffectKeys,
    automationStatus,
    getItemKeepPaths,
    summonPasses,
    tokenHookNames,
    massApplyExcludeSources,
    damageIcons,
    damageTypeGroups,
    getDamageTypeGroup,
    grappleIcon,
    grappleEscapeIcon,
    tempConditionIcon,
    get abilityOptions() { return Object.entries(CONFIG.DND5E.abilities).map(i => ({label: i[1].label, value: i[0], image: i[1].icon})); },
    get activationTypeOptions() { return Object.entries(CONFIG.DND5E.activityActivationTypes).map(i => ({label: i[1].label, value: i[0]})); },
    get activityTypeOptions() { return Object.entries(CONFIG.DND5E.activityTypes).map(i => ({label: _loc(i[1].documentClass.metadata.title), value: i[0], image: i[1].documentClass.metadata.img})); },
    get armorOptions() { return Object.entries(CONFIG.DND5E.armorTypes).map(i => ({label: i[1], value: i[0]})); },
    attackTypes,
    get attackTypeOptions() { return attackTypes.map(i => ({label: _loc('CAT.Common.AttackType.' + i), value: i})); },
    get bonusPhaseOptions() { return [...Object.keys(bonusPhases), 'all'].map(p => ({value: p, label: _loc('CAT.OptionalBonus.Phase.' + p.capitalize())})); },
    get characterLevelOptions() { return Array.from({length: CONFIG.DND5E.maxLevel}, (_, i) => ({label: _loc('DND5E.LevelNumber', {level: i + 1}), value: i + 1})); },
    get coverOptions() { return [
        CONFIG.statusEffects.coverHalf,
        CONFIG.statusEffects.coverThreeQuarters,
        CONFIG.statusEffects.coverTotal
    ].map(i => ({label: i.name, value: i.coverBonus ?? 999, image: i.img})); },
    get creatureTypeOptions() { return Object.entries(CONFIG.DND5E.creatureTypes).map(i => ({label: i[1].label, value: i[0], image: i[1].icon})); },
    get spiritTypeOptions() { return this.creatureTypeOptions.filter(option => ['celestial', 'fey', 'fiend'].includes(option.value)); },
    get damageTypeOptions() {
        return Object.entries(CONFIG.DND5E.damageTypes).map(([value, config]) => {
            const group = getDamageTypeGroup(value);
            return {label: config.label, value, image: damageIcons[value] ?? config.icon, invertColor: ['midi-none', 'none', 'vitality'].includes(value), group, tag: _loc(damageTypeGroups[group])};
        }).sort((a, b) => damageTypeGroupOrder.indexOf(a.group) - damageTypeGroupOrder.indexOf(b.group));
    },
    get diceSizeOptions() { return [4, 6, 8, 10, 12, 20].map(i => ({label: `d${i}`, value: `d${i}`, image: `systems/dnd5e/icons/svg/dice/d${i}.svg`})); },
    get dispositionOptions() { return [
        {value: 'ally', label: _loc('DND5E.TARGET.Type.Ally.Label')},
        {value: 'enemy', label: _loc('DND5E.TARGET.Type.Enemy.Label')}
    ];},
    get healingTypeOptions() { return Object.entries(CONFIG.DND5E.healingTypes).map(i => ({label: i[1].label, value: i[0], image: i[1].icon, invertColor: i[0] === 'vitality'})); },
    get itemProperties() { return Object.entries(CONFIG.DND5E.itemProperties).map(i => ({label: i[1].label, value: i[0]})); },
    get meleeWeaponOptions() { return meleeWeapons; },
    get physicalItemTypes() { return Object.entries(Item.implementation.compendiumBrowserTypes().physical.children).map(i => ({label: _loc(i[1].label), value: i[0], image: `systems/dnd5e/icons/svg/items/${i[0]}.svg`})); },
    get rangedWeaponOptions() { return rangedWeapons; },
    get sizeOptions() { return Object.entries(CONFIG.DND5E.actorSizes).sort((a, b) => a[1].numerical - b[1].numerical).map(i => ({label: i[1].label, value: i[0]})); },
    get skillOptions() { return Object.entries(CONFIG.DND5E.skills).map(i => ({label: i[1].label, value: i[0], image: i[1].icon})); },
    get statusOptions() { return Object.values(CONFIG.statusEffects).map(i => ({label: _loc(i.name ?? i.id), value: i.id, image: i.img})); },
    get spellMethodOptions() { return Object.entries(CONFIG.DND5E.spellcasting).map(i => ({label: i[1].label, value: i[0], image: methodIconOverrides[i[0]] ?? i[1].img})); },
    get spellSchoolOptions() { return Object.entries(CONFIG.DND5E.spellSchools).map(i => ({label: i[1].label, value: i[0], image: i[1].icon, invertColor: true})); },
    get spellSlotOptions() { return Object.entries(CONFIG.DND5E.spellLevels).map(i => i[0] == 0 ? {label: i[1], value: i[0]} : {label: i[1], value: i[0], image: `systems/dnd5e/icons/spell-tiers/${CONFIG.DND5E.spellcasting.spell.getSpellSlotKey(i[0])}.webp`}); },
    get toolOptions() { return tools; },
    get triggerTypes() { return triggerTypes(); },
    get usableItemTypes() { return ['consumable', 'equipment' ,'feat', 'loot', 'spell', 'tool', 'weapon'].map(i => ({label: _loc(CONFIG.Item.typeLabels[i]), value: i, image: itemIconOverrides[i] ?? `systems/dnd5e/icons/svg/items/${i}.svg`})); },
    get weaponOptions() { return weapons; },
    get weaponTypes() { return Object.entries(CONFIG.DND5E.weaponTypes).map(i => ({label: i[1], value: i[0]})); }
};
