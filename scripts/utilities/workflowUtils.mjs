import {constants} from '../lib/_module.mjs';
import {activityUtils, actorUtils, genericUtils, itemUtils, queryUtils, rollUtils} from './_module.mjs';
/**
 * The activity's action type for the attack mode in play, such as mwak or rsak.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @returns {string|undefined} Undefined when the workflow has no activity.
 */
function getActionType(workflow) {
    if (!workflow.activity) return;
    return workflow.activity.getActionType(workflow.attackMode);
}
/**
 * Whether this workflow is an attack of the given category.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @param {'attack'|'meleeAttack'|'rangedAttack'|'weaponAttack'|'spellAttack'|'rangedWeaponAttack'|'meleeWeaponAttack'|'rangedSpellAttack'|'meleeSpellAttack'} type Attack category to test for.
 * @returns {boolean}
 */
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
/**
 * Use an activity through midi, rolling as the actor's owner when the current user lacks permission.
 * @param {dnd5e.documents.activity.Activity} activity Activity to use.
 * @param {foundry.documents.TokenDocument[]} [targets] Tokens the use is aimed at.
 * @param {object} [options] Additional options.
 * @param {object} [options.config] Merged over the usage config.
 * @param {object} [options.options] Merged over midi's workflow options.
 * @param {object} [options.dialog] Usage dialog configuration.
 * @param {object} [options.message] Chat message configuration.
 * @param {string} [options.userId] User the roll is performed as. Defaults to the actor's first owner.
 * @param {number} [options.atLevel] Cast at this spell level, if the actor has an equivalent slot.
 * @param {boolean} [options.consumeUsage] Spend the item or activity's own uses.
 * @param {boolean} [options.consumeResources] Spend the resources the activity consumes.
 * @param {boolean} [options.spellSlot] Spend a spell slot.
 * @param {boolean} [options.fast] Skip the attack and damage prompts.
 * @param {boolean} [options.autoDamage] Roll damage according to midi's autoRollDamage setting.
 * @returns {Promise<MidiQOL.Workflow|undefined>} Undefined when midi declines the use.
 */
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
    workflow = workflow?.workflow ?? workflow;
    if (fixSets && workflow) {
        if (workflow.failedSaves) workflow.failedSaves = new Set(workflow.failedSaves);
        if (workflow.hitTargets) workflow.hitTargets = new Set(workflow.hitTargets);
        if (workflow.targets) workflow.targets = new Set(workflow.targets);
    }
    return workflow;
}
/**
 * {@link completeActivityUse} with the prompts skipped and damage rolled automatically.
 * @param {dnd5e.documents.activity.Activity} activity Activity to use.
 * @param {foundry.documents.TokenDocument[]} [targets] Tokens the use is aimed at.
 * @param {object} [options] Additional options.
 * @param {object} [options.config] Merged over the usage config.
 * @param {object} [options.options] Merged over midi's workflow options.
 * @param {object} [options.dialog] Usage dialog configuration.
 * @param {object} [options.message] Chat message configuration.
 * @param {string} [options.userId] User the roll is performed as. Defaults to the actor's first owner.
 * @param {number} [options.atLevel] Cast at this spell level, if the actor has an equivalent slot.
 * @param {boolean} [options.consumeUsage] Spend the item or activity's own uses.
 * @param {boolean} [options.consumeResources] Spend the resources the activity consumes.
 * @param {boolean} [options.spellSlot] Spend a spell slot.
 * @returns {Promise<MidiQOL.Workflow|undefined>}
 */
async function syntheticActivityRoll(activity, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true} = {}) {
    return await completeActivityUse(activity, targets, {config, options, dialog, message, userId, atLevel, consumeUsage, consumeResources, spellSlot, fast: true, autoDamage: true});
}
/**
 * {@link syntheticActivityRoll} for activity data that is not on the item, such as a modified copy.
 * @param {object} activityData Activity data to roll, which need not exist on the item.
 * @param {Item5e} item Item the in-memory activity belongs to.
 * @param {foundry.documents.TokenDocument[]} [targets] Tokens the use is aimed at.
 * @param {object} [options] Additional options.
 * @param {object} [options.config] Merged over the usage config.
 * @param {object} [options.options] Merged over midi's workflow options.
 * @param {object} [options.dialog] Usage dialog configuration.
 * @param {object} [options.message] Chat message configuration.
 * @param {string} [options.userId] User the roll is performed as. Defaults to the actor's first owner.
 * @param {number} [options.atLevel] Cast at this spell level, if the actor has an equivalent slot.
 * @param {boolean} [options.consumeUsage] Spend the item or activity's own uses.
 * @param {boolean} [options.consumeResources] Spend the resources the activity consumes.
 * @param {boolean} [options.spellSlot] Spend a spell slot.
 * @returns {Promise<MidiQOL.Workflow|undefined>}
 */
async function syntheticActivityDataRoll(activityData, item, targets, {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true} = {}) {
    const activity = activityUtils.syntheticActivity(activityData, item);
    return await syntheticActivityRoll(activity, targets, {config, options, dialog, message, userId, atLevel, consumeUsage, consumeResources, spellSlot});
}
/**
 * Spend an activity's consumption at a scaled amount without triggering its parent.
 * @param {Item5e} item Item to use.
 * @param {string} activityIdentifier The hidden cost activity.
 * @param {number} amount Scaling amount the consumption is multiplied by.
 */
async function spendScaledCost(item, activityIdentifier, amount) {
    const activity = itemUtils.getActivityByIdentifier(item, activityIdentifier);
    const activityData = activity ? activityUtils.getConsumptionModifiedActivityData(activity, amount) : undefined;
    if (!activityData) return genericUtils.notify('CAT.Error.MissingCostActivity', {type: 'warn'});
    return await syntheticActivityDataRoll(activityData, item, []);
}
/**
 * Use an item through midi, rolling as the actor's owner when the current user lacks permission. Sets returned by midi across clients are rebuilt, since they arrive as arrays.
 * @param {Item5e} item Item to use.
 * @param {foundry.documents.TokenDocument[]} [targets] Tokens the use is aimed at.
 * @param {object} [options] Additional options.
 * @param {object} [options.config] Merged over the usage config.
 * @param {object} [options.options] Merged over midi's workflow options.
 * @param {object} [options.dialog] Usage dialog configuration.
 * @param {object} [options.message] Chat message configuration.
 * @param {string} [options.userId] User the roll is performed as. Defaults to the actor's first owner.
 * @param {number} [options.atLevel] Cast at this spell level, if the actor has an equivalent slot.
 * @param {boolean} [options.consumeUsage] Spend the item or activity's own uses.
 * @param {boolean} [options.consumeResources] Spend the resources the activity consumes.
 * @param {boolean} [options.spellSlot] Spend a spell slot.
 * @param {boolean} [options.fast] Skip the attack and damage prompts.
 * @param {boolean} [options.autoDamage] Roll damage according to midi's autoRollDamage setting.
 * @returns {Promise<MidiQOL.Workflow|undefined>} Undefined when midi declines the use.
 */
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
    workflow = workflow?.workflow ?? workflow;
    if (fixSets && workflow) {
        if (workflow.failedSaves) workflow.failedSaves = new Set(workflow.failedSaves);
        if (workflow.hitTargets) workflow.hitTargets = new Set(workflow.hitTargets);
        if (workflow.targets) workflow.targets = new Set(workflow.targets);
    }
    return workflow;
}
/**
 * {@link completeItemUse} with the prompts skipped and damage rolled automatically.
 * @param {Item5e} item Item to use.
 * @param {foundry.documents.TokenDocument[]} [targets] Tokens the use is aimed at.
 * @param {object} [options] Additional options.
 * @param {object} [options.config] Merged over the usage config.
 * @param {object} [options.options] Merged over midi's workflow options.
 * @param {object} [options.dialog] Usage dialog configuration.
 * @param {object} [options.message] Chat message configuration.
 * @param {string} [options.userId] User the roll is performed as. Defaults to the actor's first owner.
 * @param {number} [options.atLevel] Cast at this spell level, if the actor has an equivalent slot.
 * @param {boolean} [options.consumeUsage] Spend the item or activity's own uses.
 * @param {boolean} [options.consumeResources] Spend the resources the activity consumes.
 * @param {boolean} [options.spellSlot] Spend a spell slot.
 * @returns {Promise<MidiQOL.Workflow|undefined>}
 */
async function syntheticItemRoll(item, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true} = {}) {
    return await completeItemUse(item, targets, {config, options, dialog, message, userId, atLevel, consumeUsage, consumeResources, spellSlot, fast: true, autoDamage: true});
}
/**
 * {@link syntheticItemRoll} for item data that is not on the actor, such as a compendium copy.
 * @param {object} itemData Item data to roll, which need not exist on the actor.
 * @param {Actor5e} actor Actor the in-memory item belongs to.
 * @param {foundry.documents.TokenDocument[]} [targets] Tokens the use is aimed at.
 * @param {object} [options] Additional options.
 * @param {object} [options.config] Merged over the usage config.
 * @param {object} [options.options] Merged over midi's workflow options.
 * @param {object} [options.dialog] Usage dialog configuration.
 * @param {object} [options.message] Chat message configuration.
 * @param {string} [options.userId] User the roll is performed as. Defaults to the actor's first owner.
 * @param {number} [options.atLevel] Cast at this spell level, if the actor has an equivalent slot.
 * @param {boolean} [options.consumeUsage] Spend the item or activity's own uses.
 * @param {boolean} [options.consumeResources] Spend the resources the activity consumes.
 * @param {boolean} [options.spellSlot] Spend a spell slot.
 * @returns {Promise<MidiQOL.Workflow|undefined>}
 */
async function syntheticItemDataRoll(itemData, actor, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeUsage = true, consumeResources = true, spellSlot = true} = {}) {
    const newItem = itemUtils.syntheticItem(itemData, actor);
    return await syntheticItemRoll(newItem, targets, {config, options, dialog, message, userId, atLevel, consumeUsage, consumeResources, spellSlot});
}
/**
 * Zero every damage total on a damage item, leaving hit points untouched.
 * @param {object} ditem Midi damage item, from workflow.damageList.
 */
function negateDamageItemDamage(ditem) {
    ditem.totalDamage = 0;
    ditem.newHP = ditem.oldHP;
    ditem.newTempHP = ditem.oldTempHP;
    ditem.hpDamage = 0;
    ditem.tempDamage = 0;
    ditem.damageDetail.forEach(i => i.value = 0);
    ditem.rawDamageDetail.forEach(i => i.value = 0);
}
/**
 * Add or subtract a flat amount of damage on one target, recalculating the resulting hit points.
 * @param {object} ditem Midi damage item, from workflow.damageList.
 * @param {number} modificationAmount Negative to reduce damage. Reductions are capped at the damage dealt.
 * @param {object} [options] Additional options.
 * @param {string} [options.type] Damage type of the modification.
 * @param {number|'auto'} [options.multiplier] 'auto' applies the target's immunity, resistance and vulnerability.
 */
function modifyDamageAppliedFlat(ditem, modificationAmount, {type = 'none', multiplier = 1} = {}) {
    const active = {type: {}};
    if (ditem.saved) active.type.saved = true;
    if (multiplier === 'auto') {
        const {damageImmunityMultiplier, damageResistanceMultiplier, damageVulnerabilityMultiplier} = MidiQOL.configSettings();
        multiplier = ditem.calcDamageOptions?.midi.saveMultiplier ?? 1;
        const actor = fromUuidSync(ditem.actorUuid);
        if (actor) {
            if (actorUtils.checkTrait(actor, 'di', type)) {
                multiplier *= damageImmunityMultiplier;
                active.type.immunity = true;
            }
            if (actorUtils.checkTrait(actor, 'dr', type)) {
                multiplier *= damageResistanceMultiplier;
                active.type.resistance = true;
            }
            if (actorUtils.checkTrait(actor, 'dv', type)) {
                multiplier *= damageVulnerabilityMultiplier;
                active.type.vulnerability = true;
            }
        }
    }
    active.multiplier = multiplier;
    modificationAmount = Math.trunc(modificationAmount * multiplier);
    if (modificationAmount < 0 && type !== 'healing') modificationAmount = Math.max(modificationAmount, -ditem.totalDamage);
    ditem.damageDetail.push({active, type, value: modificationAmount});
    ditem.rawDamageDetail.push({value: modificationAmount, type});
    const actualTotal = ditem.totalDamage + modificationAmount;
    ditem.totalDamage = actualTotal;
    const newTempHP = ditem.oldTempHP - actualTotal;
    ditem.newTempHP = Math.max(newTempHP, 0);
    ditem.newHP = Math.clamp(ditem.oldHP + Math.min(0, newTempHP), 0, ditem.oldHP);
    ditem.hpDamage = ditem.oldHP - ditem.newHP;
}
/**
 * Whether this roll is a continuation rather than a fresh use: over time effects, automation-only activities, and spells cast without spending a slot.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @returns {boolean}
 */
function isSustainedRoll(workflow) {
    if (['workflowOptions.isOverTime', 'activity.isOverTimeFlag', 'activity.midiProperties.automationOnly'].some(p => genericUtils.getProperty(workflow, p))) return true;
    return workflow.item?.type === 'spell' && !workflow.activity?.consumption?.spellSlot;
}
/**
 * Replace a damage item's total, splitting it across temporary and real hit points.
 * @param {object} ditem Midi damage item, from workflow.damageList.
 * @param {number} damageAmount Replacement damage total.
 * @param {boolean} [adjustRaw] Also overwrite the raw damage detail, which drives the damage card.
 */
function setDamageItemDamage(ditem, damageAmount, adjustRaw = true) {
    const tempDamage = damageAmount > 0 ? Math.min(ditem.oldTempHP ?? 0, damageAmount) : 0;
    const hpDamage = damageAmount - tempDamage;
    ditem.totalDamage = damageAmount;
    ditem.hpDamage = hpDamage;
    ditem.tempDamage = tempDamage;
    ditem.newHP = ditem.oldHP - hpDamage;
    ditem.newTempHP = (ditem.oldTempHP ?? 0) - tempDamage;
    ditem.damageDetail.forEach(i => i.value = 0);
    ditem.damageDetail[0].value = damageAmount;
    if (adjustRaw) {
        ditem.rawDamageDetail.forEach(i => i.value = 0);
        ditem.rawDamageDetail[0].value = damageAmount;
    }
}
/**
 * Stash a value on the workflow under CAT's namespace, for reading in a later pass.
 * @param {MidiQOL.Workflow|object} workflow The workflow, or an options object for a synthetic roll.
 * @param {string} path Dot path below workflowOptions.cat.
 * @param {*} value Value to stash, or damage to apply.
 */
function setWorkflowProperty(workflow, path, value) {
    genericUtils.setProperty(workflow, 'workflowOptions.cat.' + path, value);
}
/**
 * Read a value stashed by {@link setWorkflowProperty}.
 * @param {MidiQOL.Workflow|object} workflow Workflow in progress.
 * @param {string} path Dot path below workflowOptions.cat.
 * @returns {*}
 */
function getWorkflowProperty(workflow, path) {
    return genericUtils.getProperty(workflow, 'workflowOptions.cat.' + path);
}
/**
 * Mark the workflow with conditions that may be applied programmatically. Used for condition resistance and vulnerability.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @param {string|string[]} conditions Condition ids to flag.
 */
function addMacroConditions(workflow, conditions) {
    const existing = getMacroConditions(workflow);
    if (typeof conditions === 'string') existing.add(conditions);
    else conditions.forEach(c => existing.add(c));
    setWorkflowProperty(workflow, 'conditions', existing);
}
/**
 * Conditions flagged by {@link addMacroConditions} as applied programmatically.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @returns {Set<string>}
 */
function getMacroConditions(workflow) {
    return new Set(getWorkflowProperty(workflow, 'conditions') ?? []);
}
/**
 * Append an extra damage roll to a workflow after its damage has been rolled.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @param {string|number} formula Formula to roll.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.ignoreCrit] Do not double the dice on a critical hit.
 * @param {string} [options.damageType] Defaults to the workflow's own damage type.
 */
async function bonusDamage(workflow, formula, {ignoreCrit = false, damageType = workflow.defaultDamageType} = {}) {
    formula = String(formula);
    if (workflow.isCritical && !ignoreCrit) formula = rollUtils.getCriticalFormula(formula, workflow.activity);
    const roll = await new CONFIG.Dice.DamageRoll(formula, workflow.activity.getRollData(), {type: damageType}).evaluate();
    workflow.damageRolls.push(roll);
    await workflow.setDamageRolls(workflow.damageRolls);
}
/**
 * Every damage type present across these rolls.
 * @param {foundry.dice.Roll[]} damageRolls Rolls to read the types from.
 * @returns {Set<string>}
 */
function getDamageTypes(damageRolls) {
    return new Set(damageRolls.map(i => i.options.type));
}
/**
 * The level this was cast at, falling back to the item's base level.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @returns {number|undefined} Undefined when no cast data is available.
 */
function getCastLevel(workflow) {
    const castData = workflow.castData ?? itemUtils.getSavedCastData(workflow.item);
    if (!castData) return;
    return Math.max(castData.castLevel ?? -1, castData.baseLevel ?? -1);
}
/**
 * Swap the workflow's activity for a modified copy, by cloning its item in memory.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @param {object} activityData Replacement data for the activity currently in use.
 */
function setActivity(workflow, activityData) {
    workflow.item = workflow.item.clone({['system.activities.' + workflow.activity.id]: activityData}, {keepId: true});
    workflow.activity = workflow.item.system.activities.get(workflow.activity.id);
}
/**
 * Add a term to the workflow's attack roll.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @param {string|number} formula Formula to roll.
 */
async function bonusAttack(workflow, formula) {
    let roll = await rollUtils.addToRoll(workflow.attackRoll, formula, {rollData: workflow.activity.getRollData()});
    await workflow.setAttackRoll(roll);
}
/**
 * Apply an already-evaluated roll as damage from a source token, with its own chat card.
 * @param {foundry.documents.TokenDocument} sourceToken Token dealing the damage.
 * @param {foundry.dice.Roll} damageRoll Evaluated roll to apply.
 * @param {string} damageType Damage type to apply it as.
 * @param {foundry.documents.TokenDocument[]} targets Tokens the use is aimed at.
 * @param {object} [options] Additional options.
 * @param {string} [options.flavor] Flavour text for the chat card.
 * @param {string} [options.itemCardId] 'new' posts a fresh card.
 * @param {Item5e} [options.sourceItem] Names and illustrates the card.
 * @returns {MidiQOL.DamageOnlyWorkflow}
 */
function applyWorkflowDamage(sourceToken, damageRoll, damageType, targets, {flavor, itemCardId = 'new', sourceItem} = {}) {
    let itemData = {};
    if (sourceItem) {
        itemData = {
            name: sourceItem.name,
            img: sourceItem.img,
            type: sourceItem.type
        };
    }
    return new MidiQOL.DamageOnlyWorkflow(sourceToken.actor, sourceToken.object, damageRoll.total, damageType, targets.map(t => t.object), damageRoll, {flavor, itemCardId, itemData});
}
/**
 * Apply damage directly to tokens, without a workflow.
 * @param {foundry.documents.TokenDocument[]|Set<foundry.documents.TokenDocument>} tokens Tokens taking the damage.
 * @param {number} value Value to stash, or damage to apply.
 * @param {string} damageType Damage type to apply it as.
 * @returns {Promise<string[]>} ChatMessage uuids
 */
async function applyDamage(tokens, value, damageType) {
    return await MidiQOL.applyTokenDamage([{damage: value, type: damageType}], value, new Set(tokens.map(t => t.object)));
}
/**
 * Replace the workflow's targets, and the user's own targeting.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @param {foundry.documents.TokenDocument[]|Set<foundry.documents.TokenDocument>} targets Tokens the use is aimed at.
 * @param {string} userId User whose targets are set. Defaults to the current user.
 */
async function updateTargets(workflow, targets, userId = game.user.id) {
    workflow.targets = new Set(targets);
    const ids = targets.map(t => t.id);
    if (userId === game.user.id) canvas.tokens?.setTargets(ids);
    else await queryUtils.query('updateTargets', userId, {ids});
}
/**
 * Rewrite a damage item so the target survives on the given hit points.
 * @param {object} ditem Midi damage item, from workflow.damageList.
 * @param {object} [options] Additional options.
 * @param {number} [options.targetHP] Hit points the target is left on.
 * @param {boolean} [options.deathOnly] Only intervene when the damage would kill outright.
 * @param {boolean} [options.killedOutright] Only intervene when the damage would not kill outright.
 * @param {Actor5e} [options.actor] Required by deathOnly and killedOutright.
 */
async function preventZeroHP(ditem, {targetHP = 1, deathOnly = false, killedOutright = false, actor} = {}) {
    if (deathOnly || killedOutright) {
        if (!actor) return;
        const resultingHP = ditem.oldHP + (ditem.oldTempHP ?? 0) - ditem.totalDamage;
        const maxHP = actor.system.attributes.hp.max;
        if (deathOnly && resultingHP > -maxHP) return;
        if (killedOutright && resultingHP <= -maxHP) return;
    }
    const hpDamage = ditem.oldHP - targetHP;
    const tempDamage = ditem.oldTempHP ?? 0;
    const totalDamage = hpDamage + tempDamage;
    ditem.totalDamage = totalDamage;
    ditem.hpDamage = hpDamage;
    ditem.tempDamage = tempDamage;
    ditem.newHP = targetHP;
    ditem.newTempHP = 0;
    ditem.damageDetail.forEach(i => i.value = 0);
    ditem.damageDetail[0].value = totalDamage;
    ditem.rawDamageDetail.forEach(i => i.value = 0);
    ditem.rawDamageDetail[0].value = totalDamage;
}

/**
 * Grant a target the given modifier for their D20 roll. This is useful: - for passing this information into synthetic item rolls - for setting modifers on particular targets during a workflow
 * @example
 * // Modern Blight Spell
 * workflowUtils.grantRollModifier(workflow, 'fail', workflow.targets.first().id, 'creature-type', 'Plant Creature');
 * // Grapple an incapacitated target
 * const options = {};
 * workflowUtils.grantRollModifier(options, 'fail', target.id, 'incapacitated', 'Incapacitated');
 * await workflowUtils.syntheticItemRoll(grappleItem, actor, [target], {options});
 * @param {object} options Options object for synthetic item rolls, or MidiQOL Workflow.
 * @param {'adv'|'dis'|'succeed'|'fail'} type Attack category to test for.
 * @param {string} tokenID Token the modifier applies to.
 * @param {string} attributionID Identifier for MidiQOL's roll attribution system.
 * @param {string} [attributionDisplay] Localized label for display on the chat card.
 */
function grantRollModifier(options, type, tokenID, attributionID, attributionDisplay = attributionID) {
    const mods = getWorkflowProperty(options, 'rollModifiers') ?? {};
    mods[tokenID] ??= [];
    mods[tokenID].push({type, identifier: attributionID, display: attributionDisplay});
    setWorkflowProperty(options, 'rollModifiers', mods);
}
export default {
    getActionType,
    isAttackType,
    completeActivityUse,
    syntheticActivityRoll,
    syntheticActivityDataRoll,
    spendScaledCost,
    completeItemUse,
    syntheticItemRoll,
    syntheticItemDataRoll,
    negateDamageItemDamage,
    modifyDamageAppliedFlat,
    setDamageItemDamage,
    isSustainedRoll,
    setWorkflowProperty,
    getWorkflowProperty,
    addMacroConditions,
    getMacroConditions,
    bonusDamage,
    getDamageTypes,
    getCastLevel,
    setActivity,
    bonusAttack,
    applyDamage,
    applyWorkflowDamage,
    updateTargets,
    preventZeroHP,
    grantRollModifier
};
