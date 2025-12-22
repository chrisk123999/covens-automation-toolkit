const workflowPasses = {
    preTargeting: 'preTargeting',
    preItemRoll: 'preItemRoll',
    targeting: 'targeting', // For editing targets
    preambleComplete: 'preambleComplete', // Other stuff
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
    targetDamage: 'targetDamage', // Regular adjustments to target damage item.
    targetDamageBonuses: 'targetDamageBonuses', // Bonus damage to specific targets.
    targetDamageFlatReductions: 'targetDamageFlatReductions', // Flat reductions of damage to specific targets.
    targetDamagePercentReductions: 'targetDamagePercentReductions', // Percent reductions of damage to specific targets.
    targetDamageComplete: 'targetDamageComplete', // Other edits to damage such as preventing death.
    rollFinished: 'rollFinished', // All other things that don't required workflow edits or adjustments.
    onHit: 'onHit', // For retaliation-like macros.
    cleanup: 'cleanup' // For extra late clean-up stuff.
};
const workflowHookNames = {
    preTargeting: 'midi-qol.preTargeting',
    preItemRoll: 'midi-qol.premades.postNoAction',
    preambleComplete: 'midi-qol.premades.postPreambleComplete',
    postAttackRoll: 'midi-qol.premades.postWaitForAttackRoll',
    attackRollComplete: 'midi-qol.premades.postAttackRollComplete',
    savesComplete: 'midi-qol.premades.postSavesComplete',
    damageRollComplete: 'midi-qol.premades.preDamageRollComplete',
    utilityRollComplete: 'midi-qol.premades.preUtilityRollComplete',
    preTargetDamageApplication: 'midi-qol.preTargetDamageApplication',
    rollFinished: 'midi-qol.premades.postRollFinished'
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
    preUpdated: 'preUpdated'
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
    deleteCombat: 'deleteCombat'
};
const auraPasses = {
    update: 'update'
};
const auraHookNames = {
    createToken: 'createToken',
    deleteToken: 'deleteToken',
    canvasReady: 'canvasReady'
};
const regionPasses = {
    created: 'created',
    deleted: 'deleted',
    moved: 'moved',
    left: 'left',
    enter: 'enter',
    stay: 'stay',
    passedThrough: 'passedThrough'
};
const itemPasses = {
    created: 'created',
    deleted: 'deleted',
    updated: 'updated',
    bulkUpdated: 'bulkUpdated',
    munched: 'munched'
};
const itemHookNames = {
    createItem: 'createItem',
    deleteItem: 'deleteItem',
    updateItem: 'updateItem',
    munched: 'ddb-importer.characterProcessDataComplete'
};
export const constants = {
    registeredMacros: undefined,
    automations: undefined,
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
    regionPasses,
    itemPasses,
    itemHookNames
};