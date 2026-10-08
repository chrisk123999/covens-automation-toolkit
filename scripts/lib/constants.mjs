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
const workflowPasses = {
    preTargeting: 'preTargeting',
    preItemRoll: 'preItemRoll',
    targeting: 'targeting', // For editing targets
    preambleComplete: 'preambleComplete', // Other stuff
    attackRollConfig: 'attackRollConfig', // For adjustments to attack roll advantage and disadvantage.
    attackRoll: 'attackRoll', // Regular adjustments to attack rolls, such as re-rolling them or editing the formula. Do not re-roll an attack after this pass.
    attackRollBonuses: 'attackRollBonuses', // Add bonuses to attack rolls but before target AC checks.
    attackRollMissedBonuses: 'attackRollMissedBonuses', // Add bonuses to attack rolls after checking target AC.
    optionalBonusAttack: 'optionalBonusAttack', // Combined optional bonus attack dialog.
    attackRollComplete: 'attackRollComplete', // Finalized attack roll, no adjustments can be made here.
    savesComplete: 'savesComplete', // Can adjust the hitTargets and failedSaves set here (not often used).
    damageRoll: 'damageRoll', // Regular adjustments to damage rolls, such as re-rolling them or editing the formula. Do not re-roll damage after this pass.
    optionalBonusDamage: 'optionalBonusDamage', // Combined optional bonus damage dialog.
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
    preTargetSave: 'midi-qol.preTargetSave',
    savesComplete: 'midi-qol.premades.postSavesComplete',
    damageRollComplete: 'midi-qol.premades.preDamageRollComplete',
    utilityRollComplete: 'midi-qol.premades.preUtilityRollComplete',
    preTargetDamageApplication: 'midi-qol.preTargetDamageApplication',
    rollFinished: 'midi-qol.premades.postRollFinished',
    regionPlaced: 'midi-qol.premades.postTemplatePlaced'
};
const grapplePasses = {
    sizeCheck: 'grappleShoveSizeCheck',
    preGrapple: 'preGrapple',
    postGrapple: 'postGrapple',
    preEscape: 'preEscape',
    postEscape: 'postEscape'
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
    filter: 'filter'
};
const auraHookNames = {
    catReady: 'catReady',
    canvasReady: 'canvasReady',
    createScene: 'createScene',
    deleteScene: 'deleteScene',
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
    optionalBonus: 'optionalBonus',
    post: 'post',
    targetSituational: 'targetSituational'
};
const bonusPhases = {
    preRoll: 'preRoll',
    preResult: 'preResult',
    postResult: 'postResult'
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
    grappleIcon,
    grappleEscapeIcon,
    tempConditionIcon,
    get abilityOptions() { return Object.entries(CONFIG.DND5E.abilities).map(i => ({label: i[1].label, value: i[0], image: i[1].icon})); },
    get activationTypeOptions() { return Object.entries(CONFIG.DND5E.activityActivationTypes).map(i => ({label: i[1].label, value: i[0]})); },
    get activityTypeOptions() { return Object.entries(CONFIG.DND5E.activityTypes).map(i => ({label: _loc(i[1].documentClass.metadata.title), value: i[0], image: i[1].documentClass.metadata.img})); },
    get armorOptions() { return Object.entries(CONFIG.DND5E.armorTypes).map(i => ({label: i[1], value: i[0]})); },
    attackTypes,
    get attackTypeOptions() { return attackTypes.map(i => ({label: _loc('CAT.Common.AttackType.' + i), value: i})); },
    get characterLevelOptions() { return Array.from({length: CONFIG.DND5E.maxLevel}, (_, i) => ({label: _loc('DND5E.LevelNumber', {level: i + 1}), value: i + 1})); },
    get creatureTypeOptions() { return Object.entries(CONFIG.DND5E.creatureTypes).map(i => ({label: i[1].label, value: i[0], image: i[1].icon})); },
    get spiritTypeOptions() { return this.creatureTypeOptions.filter(option => ['celestial', 'fey', 'fiend'].includes(option.value)); },
    get damageTypeOptions() { return Object.entries(CONFIG.DND5E.damageTypes).map(i => ({label: i[1].label, value: i[0], image: damageIcons[i[0]] ?? i[1].icon, invertColor: ['midi-none', 'none', 'vitality'].includes(i[0])})); },
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
    get statusOptions() { return CONFIG.statusEffects.map(i => ({label: _loc(i.name ?? i.label ?? i.id), value: i.id, image: i.img ?? i.icon})); },
    get spellMethodOptions() { return Object.entries(CONFIG.DND5E.spellcasting).map(i => ({label: i[1].label, value: i[0], image: methodIconOverrides[i[0]] ?? i[1].img})); },
    get spellSchoolOptions() { return Object.entries(CONFIG.DND5E.spellSchools).map(i => ({label: i[1].label, value: i[0], image: i[1].icon, invertColor: true})); },
    get spellSlotOptions() { return Object.entries(CONFIG.DND5E.spellLevels).map(i => i[0] == 0 ? {label: i[1], value: i[0]} : {label: i[1], value: i[0], image: `systems/dnd5e/icons/spell-tiers/${CONFIG.DND5E.spellcasting.spell.getSpellSlotKey(i[0])}.webp`}); },
    get toolOptions() { return tools; },
    get triggerTypes() { return triggerTypes(); },
    get usableItemTypes() { return ['consumable', 'equipment' ,'feat', 'loot', 'spell', 'tool', 'weapon'].map(i => ({label: _loc(CONFIG.Item.typeLabels[i]), value: i, image: itemIconOverrides[i] ?? `systems/dnd5e/icons/svg/items/${i}.svg`})); },
    get weaponOptions() { return weapons; },
    get weaponTypes() { return Object.entries(CONFIG.DND5E.weaponTypes).map(i => ({label: i[1], value: i[0]})); }
};
