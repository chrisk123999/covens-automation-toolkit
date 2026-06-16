import {RegisteredMacros} from './macros.mjs';
import {RegisteredAutomations} from './automations.mjs';
import {RegisteredScales} from './scales.mjs';
import {RegisteredAnimations} from './animation.mjs';
import {SummonsManager} from './summons.mjs';
const workflowPasses = {
    preTargeting: 'preTargeting',
    preItemRoll: 'preItemRoll',
    targeting: 'targeting', // For editing targets
    preambleComplete: 'preambleComplete', // Other stuff
    attackRollConfig: 'attackRollConfig', // For adjustments to attack roll advantage and disadvantage.
    attackRoll: 'attackRoll', // Regular adjustments to attack rolls, such as re-rolling them or editing the formula. Do not re-roll an attack after this pass.
    attackRollBonuses: 'attackRollBonuses', // Add bonuses to attack rolls but before target AC checks.
    attackRollMissedBonuses: 'attackRollMissedBonuses', // Add bonuses to attack rolls after checking target AC.
    attackRollComplete: 'attackRollComplete', // Finalized attack roll, no adjustments can be made here.
    savesComplete: 'savesComplete', // Can adjust the hitTargets and failedSaves set here (not often used).
    damageRoll: 'damageRoll', // Regular adjustments to damage rolls, such as re-rolling them or editing the formula. Do not re-roll damage after this pass.
    damageRollBonuses: 'damageRollBonuses', // Add bonuses to damage rolls.
    damageRollComplete: 'damageRollComplete', // Finalized damage rolls, no adjustments should be made here.
    utilityRoll: 'utilityRoll', // Regular adjusments to utility rolls, such as re-rolling them or editing the formula. Do not re-roll an attack after this pass.
    utilityRollBonuses: 'utilityRollBonuses', // Add bonuses to utility rolls.
    utilityRollComplete: 'utilityRollComplete', // Finalized utility rolls, not adjustments should be made here.
    damage: 'damage', // Regular adjustments to target damage item.
    damageBonuses: 'damageBonuses', // Bonus damage to specific targets.
    damageFlatReductions: 'damageFlatReductions', // Flat reductions of damage to specific targets.
    damagePercentReductions: 'damagePercentReductions', // Percent reductions of damage to specific targets.
    damageComplete: 'damageComplete', // Other edits to damage such as preventing death.
    rollFinished: 'rollFinished', // All other things that don't required workflow edits or adjustments.
    onHit: 'onHit', // For retaliation-like macros.
    cleanup: 'cleanup' // For extra late clean-up stuff.
};
const workflowHookNames = {
    preTargeting: 'midi-qol.preTargeting',
    preItemRoll: 'midi-qol.premades.postNoAction',
    preambleComplete: 'midi-qol.premades.postPreambleComplete',
    preAttackRollConfig: 'midi-qol.premades.preAttackRollConfig',
    postAttackRoll: 'midi-qol.premades.postWaitForAttackRoll',
    attackRollComplete: 'midi-qol.premades.postAttackRollComplete',
    savesComplete: 'midi-qol.premades.postSavesComplete',
    damageRollComplete: 'midi-qol.premades.preDamageRollComplete',
    utilityRollComplete: 'midi-qol.premades.preUtilityRollComplete',
    preTargetDamageApplication: 'midi-qol.preTargetDamageApplication',
    rollFinished: 'midi-qol.premades.postRollFinished',
    regionPlaced: 'midi-qol.premades.postTemplatePlaced'
};
const movementPasses = {
    moved: 'moved',
    movedNear: 'movedNear'
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
    preUpdateActiveEffect: 'preUpdateActiveEffect'
};
const effectPasses = {
    created: 'created',
    deleted: 'deleted',
    updated: 'updated',
    preCreated: 'preCreated',
    preDeleted: 'preDeleted',
    preUpdated: 'preUpdated',
    doCreated: 'doCreated',
    doDeleted: 'doDeleted'
};
const combatPasses = {
    turnEnd: 'turnEnd',
    everyTurn: 'everyTurn',
    turnStart: 'turnStart',
    combatStart: 'combatStart',
    combatEnd: 'combatEnd'
};
const combatHookNames = {
    updateCombat: 'updateCombat',
    combatStart: 'combatStart',
    deleteCombat: 'deleteCombat',
    preUpdateCombatant: 'preUpdateCombatant',
    updateCombatant: 'updateCombatant'
};
const auraPasses = {
    update: 'update'
};
const auraHookNames = {
    createToken: 'createToken',
    deleteToken: 'deleteToken',
    canvasReady: 'canvasReady'
};
const regionHooksNames = {
    createRegion: 'createRegion',
    updateRegion: 'updateRegion',
    deleteRegion: 'deleteRegion',
    preCreateRegion: 'preCreateRegion',
    preUpdateRegion: 'preUpdateRegion'
};
const regionPasses = {
    created: 'created',
    updated: 'updated',
    deleted: 'deleted',
    left: 'left',
    enter: 'enter',
    stay: 'stay',
    passedThrough: 'passedThrough',
    entered: 'entered',
    exited: 'exited',
    stayed: 'stayed',
    passedOver: 'passedOver'
};
const itemPasses = {
    created: 'created',
    deleted: 'deleted',
    updated: 'updated',
    bulkUpdated: 'bulkUpdated',
    munched: 'munched',
    equipped: 'equipped',
    unequipped: 'unequipped',
    attuned: 'attuned',
    unattuned: 'unattuned',
    medkit: 'medkit'
};
const itemHookNames = {
    createItem: 'createItem',
    deleteItem: 'deleteItem',
    updateItem: 'updateItem',
    munched: 'ddb-importer.characterProcessDataComplete'
};
const sheetHookNames = {
    getHeaderControlsActiveEffectConfig: 'getHeaderControlsActiveEffectConfig',
    getHeaderControlsActivitySheet: 'getHeaderControlsActivitySheet',
    renderActivitySheet: 'renderActivitySheet',
    getHeaderControlsActorSheetV2: 'getHeaderControlsActorSheetV2',
    getHeaderControlsCompendium: 'getHeaderControlsCompendium',
    getHeaderControlsItemSheet5e: 'getHeaderControlsItemSheet5e',
    getHeaderControlsLevelConfig: 'getHeaderControlsLevelConfig',
    getHeaderControlsRegionConfig: 'getHeaderControlsRegionConfig',
    getHeaderControlsSceneConfig: 'getHeaderControlsSceneConfig',
    getHeaderControlsTokenConfig: 'getHeaderControlsTokenConfig',
    renderSourceConfig: 'renderSourceConfig'
};
const restHookNames = {
    restCompleted: 'dnd5e.restCompleted'
};
const restPasses = {
    short: 'short',
    long: 'long'
};
const rollPasses = {
    situational: 'situational',
    context: 'context',
    bonus: 'bonus',
    post: 'post',
    targetSituational: 'targetSituational'
};
const timeHookNames = {
    updateWorldTime: 'updateWorldTime'
};
const timePasses = {
    timeUpdated: 'timeUpdated'
};
const actorHookNames = {
    updateActor: 'updateActor',
    preDeleteActor: 'preDeleteActor'
};
const summonPasses = {
    preCreate: 'preCreate',
    create: 'create',
    preDelete: 'preDelete',
    delete: 'delete',
    placed: 'placed',
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
    renderTidy5eItemSheetClassic: 'renderTidy5eItemSheetClassic',
    renderTidy5eItemSheetQuadrone: 'renderTidy5eItemSheetQuadrone',
    renderTidy5eCharacterSheetQuadrone: 'renderTidy5eCharacterSheetQuadrone',
    renderCombatTracker: 'renderCombatTracker'
};
const MEDKIT_STATUSES = {
    UNKNOWN: 'unknown',
    OUTDATED_CPR: 'outdated',
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
    'macro.CUB',
    'macro.StatusEffect',
    'StatusEffect'
];
function getItemKeepPaths({spell = false} = {}) {
    const paths = [
        '_stats.compendiumSource',
        'flags.ddbimporter',
        'flags.dnd5e.advancementOrigin',
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
export default {
    /** @type {RegisteredMacros} */
    macros: undefined,
    /** @type {RegisteredAutomations} */
    automations: undefined,
    /** @type {RegisteredScales} */
    scales: undefined,
    /** @type {RegisteredAnimations} */
    animations: undefined,
    /** @type {SummonsManager} */
    summons: undefined,
    gameReady: false,
    workflowPasses,
    workflowHookNames,
    movementPasses,
    movementHookNames,
    effectHookNames,
    effectPasses,
    combatHookNames,
    combatPasses,
    auraPasses,
    auraHookNames,
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
    statusEffectKeys,
    automationStatus,
    getItemKeepPaths,
    summonPasses,
    tokenHookNames
};