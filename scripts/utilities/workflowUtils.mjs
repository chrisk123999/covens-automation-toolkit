import {constants} from '../lib/_module.mjs';
import {activityUtils, actorUtils, genericUtils, itemUtils, queryUtils, rollUtils} from './_module.mjs';
function getActionType(workflow) {
    if (!workflow.activity) return;
    return workflow.activity.getActionType(workflow.attackMode);
}
function isAttackType(workflow, type = 'attack') {
    if (!workflow.activity) return;
    let field;
    switch (type) {
        case 'attack': field = 'attacks'; break;
        case 'meleeAttack': field = 'meleeAttacks'; break;
        case 'rangedAttack': field = 'rangedAttacks'; break;
        case 'weaponAttack': field = 'weaponAttacks'; break;
        case 'spellAttack': field = 'spellAttacks'; break;
        case 'rangedWeaponAttack': field = 'rangedWeaponAttacks'; break;
        case 'meleeWeaponAttack': field = 'meleeWeaponAttacks'; break;
        case 'rangedSpellAttack': field = 'rangedSpellAttacks'; break;
        case 'meleeSpellAttack': field = 'meleeSpellAttacks'; break;
        default: return;
    }
    return constants[field].includes(getActionType(workflow));
}
async function completeActivityUse(activity, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true, fast = false, autoDamage} = {}) {
    const defaultConfig = {
        consumeUsage,
        consume: {
            resources: consumeResources,
            spellSlot
        }
    };
    const defaultOptions = {
        targetUuids: targets.map(i => i.uuid),
        configureDialog: false,
        workflowOptions: {
            autoFastDamage: fast,
            autoRollAttack: fast
        }
    };
    if (autoDamage) {
        let autoRollDamage = MidiQOL.configSettings().autoRollDamage;
        if (!['always', 'onHit'].includes(autoRollDamage)) autoRollDamage = 'onHit';
        defaultOptions.workflowOptions.autoRollDamage = autoRollDamage;
    }
    if (atLevel) {
        const spellLabel = actorUtils.getEquivalentSpellSlotName(activity.actor, atLevel);
        if (spellLabel) defaultConfig.spell = {slot: spellLabel};
    }
    if (userId) {
        options.asUser ||= userId;
    } else {
        options.asUser ||= queryUtils.firstOwner(activity.actor, true);
    }
    options = genericUtils.mergeObject(defaultOptions, options);
    config = genericUtils.mergeObject(defaultConfig, config);
    config.midiOptions = options;
    let fixSets = false;
    if (!config.midiOptions?.asUser && !queryUtils.hasPermission(activity.actor, game.userId)) {
        if (!config.midiOptions) config.midiOptions = {};
        config.midiOptions.asUser = queryUtils.firstOwner(activity.actor, true);
        config.midiOptions.checkGMStatus = true;
        config.midiOptions.workflowData = true;
        fixSets = true;
    } else if (config.midiOptions?.asUser && config.midiOptions?.asUser !== game.userId) {
        config.midiOptions.workflowData = true;
        fixSets = true;
    } 
    let workflow = await MidiQOL.completeActivityUse(activity, config, dialog, message);
    workflow = workflow.workflow ?? workflow;
    if (fixSets) {
        if (workflow.failedSaves) workflow.failedSaves = new Set(workflow.failedSaves);
        if (workflow.hitTargets) workflow.hitTargets = new Set(workflow.hitTargets);
        if (workflow.targets) workflow.targets = new Set(workflow.targets);
    }
    return workflow;
}
async function syntheticActivityRoll(activity, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true} = {}) {
    return await completeActivityUse(activity, targets, {config, options, dialog, message, userId, atLevel, consumeUsage, consumeResources, spellSlot, fast: true, autoDamage: true});
}
async function syntheticActivityDataRoll(activityData, item, targets, {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true} = {}) {
    const activity = activityUtils.syntheticActivity(activityData, item);
    return await syntheticActivityRoll(activity, targets, {config, options, dialog, message, userId, atLevel, consumeUsage, consumeResources, spellSlot});
}
async function completeItemUse(item, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true, fast = false, autoDamage} = {}) {
    const defaultConfig = {
        consumeUsage,
        consume: {
            resources: consumeResources,
            spellSlot
        }
    };
    const defaultOptions = {
        targetUuids: targets.map(i => i.uuid),
        configureDialog: false,
        workflowOptions: {
            autoFastDamage: fast,
            autoRollAttack: fast
        }
    };
    if (autoDamage) {
        let autoRollDamage = MidiQOL.configSettings().autoRollDamage;
        if (!['always', 'onHit'].includes(autoRollDamage)) autoRollDamage = 'onHit';
        defaultOptions.workflowOptions.autoRollDamage = autoRollDamage;
    }
    if (atLevel) {
        const spellLabel = actorUtils.getEquivalentSpellSlotName(item.actor, atLevel);
        if (spellLabel) defaultConfig.spell = {slot: spellLabel};
    }
    if (userId) {
        options.asUser ||= userId;
    } else {
        options.asUser ||= queryUtils.firstOwner(item.actor, true);
    }
    options = genericUtils.mergeObject(defaultOptions, options);
    config = genericUtils.mergeObject(defaultConfig, config);
    config.midiOptions = options;
    let fixSets = false;
    if (!config.midiOptions?.asUser && !queryUtils.hasPermission(item.actor, game.userId)) {
        if (!config.midiOptions) config.midiOptions = {};
        config.midiOptions.asUser = queryUtils.firstOwner(item.actor, true);
        config.midiOptions.checkGMStatus = true;
        config.midiOptions.workflowData = true;
        fixSets = true;
    } else if (config.midiOptions?.asUser && config.midiOptions?.asUser !== game.userId) {
        config.midiOptions.workflowData = true;
        fixSets = true;
    }
    let workflow = await MidiQOL.completeItemUse(item, config, dialog, message);
    workflow = workflow.workflow ?? workflow;
    if (fixSets) {
        if (workflow.failedSaves) workflow.failedSaves = new Set(workflow.failedSaves);
        if (workflow.hitTargets) workflow.hitTargets = new Set(workflow.hitTargets);
        if (workflow.targets) workflow.targets = new Set(workflow.targets);
    }
    return workflow;
}
async function syntheticItemRoll(item, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true} = {}) {
    return await completeItemUse(item, targets, {config, options, dialog, message, userId, atLevel, consumeUsage, consumeResources, spellSlot, fast: true, autoDamage: true});
}
async function syntheticItemDataRoll(itemData, actor, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true} = {}) {
    const newItem = itemUtils.syntheticItem(itemData, actor);
    return await syntheticItemRoll(newItem, targets, {config, options, dialog, message, userId, atLevel, consumeUsage, consumeResources, spellSlot});
}
function negateDamageItemDamage(ditem) {
    ditem.totalDamage = 0;
    ditem.newHP = ditem.oldHP;
    ditem.newTempHP = ditem.oldTempHP;
    ditem.hpDamage = 0;
    ditem.tempDamage = 0;
    ditem.damageDetail.forEach(i => i.value = 0);
    ditem.rawDamageDetail.forEach(i => i.value = 0);
}
function setWorkflowProperty(workflow, path, value) {
    genericUtils.setProperty(workflow, 'cat.' + path, value);
}
function getWorkflowProperty(workflow, path) {
    return genericUtils.getProperty(workflow, 'cat.' + path);
}
async function bonusDamage(workflow, formula, {ignoreCrit = false, damageType = workflow.defaultDamageType} = {}) {
    formula = String(formula);
    if (workflow.isCritical && !ignoreCrit) formula = rollUtils.getCriticalFormula(formula, workflow.activity);
    const roll = await new CONFIG.Dice.DamageRoll(formula, workflow.activity.getRollData(), {type: damageType}).evaluate();
    workflow.damageRolls.push(roll);
    await workflow.setDamageRolls(workflow.damageRolls);
}
export default {
    getActionType,
    isAttackType,
    completeActivityUse,
    syntheticActivityRoll,
    syntheticActivityDataRoll,
    completeItemUse,
    syntheticItemRoll,
    syntheticItemDataRoll,
    negateDamageItemDamage,
    setWorkflowProperty,
    getWorkflowProperty,
    bonusDamage
};