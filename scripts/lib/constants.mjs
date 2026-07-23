import {RegisteredMacros} from './macros.mjs';
import {RegisteredAutomations} from './automations.mjs';
import {RegisteredScales} from './scales.mjs';
import {RegisteredAnimations} from './animation.mjs';
import {SummonsManager} from './summons.mjs';
import {default as Triggers} from './trigger.mjs';
const rules = {
    all: 'all',
    2014: '2014',
    2024: '2024'
};
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
    smite: 'smite', // Smite spells.
    optionalBonusDamage: 'optionalBonusDamage', // Combined optional bonus damage dialog.
    contextualBonusDamage: 'contextualBonusDamage', // Combined bonus damage dialog, see above.
    damageRollBonuses: 'damageRollBonuses', // Add bonuses to damage rolls.
    damageRollComplete: 'damageRollComplete', // Finalized damage rolls, no adjustments should be made here.
    utilityRoll: 'utilityRoll', // Regular adjustments to utility rolls, such as re-rolling them or editing the formula. Do not re-roll after this pass.
    utilityRollBonuses: 'utilityRollBonuses', // Add bonuses to utility rolls.
    utilityRollComplete: 'utilityRollComplete', // Finalized utility rolls, no adjustments should be made here.
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
    aimTeleport: 'aimTeleport',
    preTeleport: 'preTeleport',
    postTeleport: 'postTeleport',
    displace: 'displace',
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
    munched: 'ddb-importer.characterProcessDataComplete',
    preUpdateItem: 'preUpdateItem'
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
    renderCombatTracker: 'renderCombatTracker',
    macroautocomplete: 'macro-autocomplete.ready'
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
const tempConditionIcon = 'icons/magic/time/arrows-circling-green.webp';
const itemIconOverrides = {
    feat: 'systems/dnd5e/icons/svg/items/feature.svg'
};
const methodIconOverrides = {
    atwill: 'icons/magic/unholy/hands-cloud-light-pink.webp',
    innate: 'icons/magic/light/hand-sparks-glow-yellow.webp',
    ritual: 'systems/dnd5e/icons/svg/items/spell.svg',
    spell: 'systems/dnd5e/icons/spell-tiers/spell9.webp'
};
const abilityOptions = () => Object.entries(CONFIG.DND5E.abilities).map(i => ({label: i[1].label, value: i[0], image: i[1].icon}));
const armorOptions = () => Object.entries(CONFIG.DND5E.armorTypes).map(i => ({label: i[1], value: i[0]}));
const creatureTypeOptions = () => Object.entries(CONFIG.DND5E.creatureTypes).map(i => ({label: i[1].label, value: i[0], image: i[1].icon}));
const damageTypeOptions = () => Object.entries(CONFIG.DND5E.damageTypes).map(i => ({label: i[1].label, value: i[0], image: damageIcons[i[1]] ?? i[1].icon, invertColor: ['midi-none', 'none', 'vitality'].includes(i[0])}));
const diceSizeOptions = () => [4, 6, 8, 10, 12, 20].map(i => ({label: `d${i}`, value: `d${i}`, image: `systems/dnd5e/icons/svg/dice/d${i}.svg`}));
const healingTypeOptions = () => Object.entries(CONFIG.DND5E.healingTypes).map(i => ({label: i[1].label, value: i[0], image: i[1].icon, invertColor: i[0] === 'vitality'}));
const itemProperties = () => Object.entries(CONFIG.DND5E.itemProperties).map(i => ({label: i[1].label, value: i[0]}));
const physicalItemTypes = () => Object.entries(Item.implementation.compendiumBrowserTypes().physical.children)
    .map(i => ({label: _loc(i[1].label), value: i[0], image: `systems/dnd5e/icons/svg/items/${i[0]}.svg`}));
const skillOptions = () => Object.entries(CONFIG.DND5E.skills).map(i => ({label: i[1].label, value: i[0], image: i[1].icon}));
const spellMethodOptions = () => Object.entries(CONFIG.DND5E.spellcasting).map(i => ({label: i[1].label, value: i[0], image: methodIconOverrides[i[0]] ?? i[1].img}));
const spellSchoolOptions = () => Object.entries(CONFIG.DND5E.spellSchools).map(i => ({label: i[1].label, value: i[0], image: i[1].icon, invertColor: true}));
const spellSlotOptions = () => Object.entries(CONFIG.DND5E.spellLevels).map(i => i[0] == 0 ? 
    {label: _loc('None'), value: i[0]} : 
    {label: i[1], value: i[0], image: `systems/dnd5e/icons/spell-tiers/${CONFIG.DND5E.spellcasting.spell.getSpellSlotKey(i[0])}.webp`}
);
const statusOptions = () => CONFIG.statusEffects.map(i => ({label: _loc(i.name ?? i.label ?? i.id), value: i.id, image: i.img ?? i.icon}));
const usableItemTypes = () => ['consumable', 'equipment' ,'feat', 'loot', 'spell', 'tool', 'weapon']
    .map(i => ({label: _loc(CONFIG.Item.typeLabels[i]), value: i, image: itemIconOverrides[i] ?? `systems/dnd5e/icons/svg/items/${i}.svg`}));
const meleeWeapons = [];
const rangedWeapons = [];
const tools = [];
const weapons = [];
const meleeWeaponOptions = () => meleeWeapons;
const rangedWeaponOptions = () => rangedWeapons;
const toolOptions = () => tools;
const weaponOptions = () => weapons;
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
    /** @type {SummonsManager} */
    summons: undefined,
    alternateAttributes: undefined,
    gameReady: false,
    rules,
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
    tokenHookNames,
    massApplyExcludeSources,
    damageIcons,
    tempConditionIcon,
    armorOptions,
    abilityOptions,
    creatureTypeOptions,
    damageTypeOptions,
    diceSizeOptions,
    healingTypeOptions,
    itemProperties,
    meleeWeaponOptions,
    physicalItemTypes,
    rangedWeaponOptions,
    statusOptions,
    skillOptions,
    spellMethodOptions,
    spellSchoolOptions,
    spellSlotOptions,
    toolOptions,
    triggerTypes,
    usableItemTypes,
    weaponOptions
};