/**
 * Midi-qol workflows (`MidiQOL.Workflow`): using items and activities through midi, and changing a workflow's targets,
 * rolls and damage while it runs.
 * @module
 */
import {constants, Logging} from '../lib/_module.mjs';
import {activityUtils, actorUtils, dialogUtils, distanceUtils, documentUtils, genericUtils, itemUtils, queryUtils, rollUtils} from './_module.mjs';
/**
 * Midi workflow options that skip the attack and damage prompts.
 * @param {boolean} fast  Skip the prompts.
 * @returns {object}
 */
function fastWorkflowOptions(fast) {
    return fast ? {fastForwardDamage: true, autoFastAttack: true, autoRollAttack: true} : {};
}
/**
 * The activity's action type for the workflow's attack mode, such as `mwak` or `rsak`.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @returns {string|undefined}         Undefined when the workflow has no activity.
 * @example
 * if (workflowUtils.getActionType(workflow) !== 'mwak') return;
 */
function getActionType(workflow) {
    if (!workflow.activity) return;
    return workflow.activity.getActionType(workflow.attackMode);
}
/**
 * Whether the workflow's action type, from {@link getActionType}, falls in an attack category. False when the workflow
 * has no activity or the category is unknown.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @param {'attack'|'meleeAttack'|'rangedAttack'|'weaponAttack'|'spellAttack'|'rangedWeaponAttack'|'meleeWeaponAttack'|'rangedSpellAttack'|'meleeSpellAttack'} [type]
 *                                     Attack category to test for. Defaults to `attack`, which matches any attack.
 * @returns {boolean}
 * @example
 * if (!workflowUtils.isAttackType(workflow, 'meleeWeaponAttack')) return;
 */
function isAttackType(workflow, type = 'attack') {
    if (!workflow.activity) return false;
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
        default: return false;
    }
    return constants[field].includes(getActionType(workflow));
}
/**
 * Use an activity through `MidiQOL.completeActivityUse` without the usage dialog. The roll runs as `userId`, or as the
 * actor's first active player owner with the GM as fallback. Unless `consumeResources` is given, every consumption
 * target is spent except combat-only ones outside combat; cast activities skip this default.
 * @param {dnd5e.documents.activity.Activity} activity   Activity to use.
 * @param {foundry.documents.TokenDocument[]} [targets]  Tokens the use is aimed at.
 * @param {object} [options]                             Additional options.
 * @param {object} [options.config]                      Merged over the usage config.
 * @param {object} [options.options]                     Merged over midi's options. Its `asUser` is filled in when
 *                                                       missing.
 * @param {object} [options.dialog]                      Usage dialog configuration.
 * @param {object} [options.message]                     Chat message configuration.
 * @param {string} [options.userId]                      Id of the user the roll runs as.
 * @param {number} [options.atLevel]                     Spell level to cast at. Ignored when the actor has no
 *                                                       equivalent slot.
 * @param {boolean|number[]} [options.consumeResources]  `true` or `false` spends all or none of the activity's
 *                                                       consumption. An array of indices spends only those consumption
 *                                                       targets.
 * @param {boolean} [options.spellSlot]                  Spend a spell slot. Defaults to true.
 * @param {boolean} [options.fast]                       Skip the attack and damage prompts. Defaults to false.
 * @param {boolean} [options.autoDamage]                 Roll damage by midi's autoRollDamage setting, or on hit when
 *                                                       that setting is off. Defaults to true.
 * @returns {Promise<MidiQOL.Workflow|undefined>}        Undefined when midi declines the use.
 * @example
 * const workflow = await workflowUtils.completeActivityUse(activity, [target.document], {consumeResources: false});
 */
async function completeActivityUse(activity, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeResources, spellSlot = true, fast = false, autoDamage = true} = {}) {
    const defaultConfig = {
        consume: {
            spellSlot,
            resources: consumeResources
        }
    };
    const defaultOptions = {
        targetUuids: targets.map(i => i.uuid),
        configureDialog: false,
        workflowOptions: fastWorkflowOptions(fast)
    };
    if (activity.type !== 'cast') {
        defaultConfig.consume.resources ??= Array.from(activity.consumption.targets.entries())
            .filter(([, target]) => !target.combatOnly || activity.actor.inCombat)
            .map(([index]) => index);
    }
    if (autoDamage) {
        let autoRollDamage = MidiQOL.configSettings().autoRollDamage;
        if (!['always', 'onHit'].includes(autoRollDamage)) autoRollDamage = 'onHit';
        defaultOptions.workflowOptions.autoRollDamage = autoRollDamage;
    }
    if (atLevel) {
        const spellLabel = actorUtils.getEquivalentSpellSlotName(activity.actor, atLevel);
        if (spellLabel) defaultConfig.spell = {slot: spellLabel};
    }
    options = {...options, asUser: options.asUser || userId || queryUtils.firstOwner(activity.actor, true)};
    options = genericUtils.mergeObject(defaultOptions, options);
    config = genericUtils.mergeObject(defaultConfig, config);
    config.midiOptions = options;
    if (!config.midiOptions?.asUser && !queryUtils.hasPermission(activity.actor, game.userId)) {
        if (!config.midiOptions) config.midiOptions = {};
        config.midiOptions.asUser = queryUtils.firstOwner(activity.actor, true);
        config.midiOptions.checkGMstatus = true;
        config.midiOptions.workflowData = true;
    } else if (config.midiOptions?.asUser && config.midiOptions?.asUser !== game.userId) {
        config.midiOptions.workflowData = true;
    }
    const workflow = await MidiQOL.completeActivityUse(activity, config, dialog, message);
    return workflow?.workflow ?? workflow;
}
/**
 * {@link completeActivityUse} with `fast` defaulting to true and `autoDamage` always on.
 * @param {dnd5e.documents.activity.Activity} activity   Activity to use.
 * @param {foundry.documents.TokenDocument[]} [targets]  Tokens the use is aimed at.
 * @param {object} [options]                             Additional options.
 * @param {object} [options.config]                      Merged over the usage config.
 * @param {object} [options.options]                     Merged over midi's options.
 * @param {object} [options.dialog]                      Usage dialog configuration.
 * @param {object} [options.message]                     Chat message configuration.
 * @param {string} [options.userId]                      Id of the user the roll runs as. Defaults to the actor's first
 *                                                       owner.
 * @param {number} [options.atLevel]                     Spell level to cast at. Ignored when the actor has no
 *                                                       equivalent slot.
 * @param {boolean|number[]} [options.consumeResources]  `true` or `false` spends all or none of the activity's
 *                                                       consumption. An array of indices spends only those consumption
 *                                                       targets.
 * @param {boolean} [options.spellSlot]                  Spend a spell slot. Defaults to true.
 * @param {boolean} [options.fast]                       Skip the attack and damage prompts. Defaults to true.
 * @returns {Promise<MidiQOL.Workflow|undefined>}        Undefined when midi declines the use.
 * @example
 * const activity = itemUtils.getActivityByIdentifier(item, 'explode');
 * await workflowUtils.syntheticActivityRoll(activity, Array.from(workflow.targets));
 */
async function syntheticActivityRoll(activity, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeResources, spellSlot = true, fast = true} = {}) {
    return await completeActivityUse(activity, targets, {config, options, dialog, message, userId, atLevel, consumeResources, spellSlot, fast, autoDamage: true});
}
/**
 * {@link syntheticActivityRoll} for activity data that is not saved on the item, such as a modified copy. The activity
 * is built in memory on `item`. When the rolling user is another client, the roll runs there through a query and the
 * result's token sets are restored; with `fast` on, the query times out after midi's reaction timeout.
 * @param {object} activityData                          Activity data to roll.
 * @param {Item5e} item                                  Item the in-memory activity belongs to.
 * @param {foundry.documents.TokenDocument[]} [targets]  Tokens the use is aimed at.
 * @param {object} [options]                             Additional options.
 * @param {object} [options.config]                      Merged over the usage config.
 * @param {object} [options.options]                     Merged over midi's options.
 * @param {object} [options.dialog]                      Usage dialog configuration.
 * @param {object} [options.message]                     Chat message configuration.
 * @param {string} [options.userId]                      Id of the user the roll runs as. Defaults to the actor's first
 *                                                       owner.
 * @param {number} [options.atLevel]                     Spell level to cast at. Ignored when the actor has no
 *                                                       equivalent slot.
 * @param {boolean|number[]} [options.consumeResources]  `true` or `false` spends all or none of the activity's
 *                                                       consumption. An array of indices spends only those consumption
 *                                                       targets.
 * @param {boolean} [options.spellSlot]                  Spend a spell slot. Defaults to true.
 * @param {boolean} [options.fast]                       Skip the attack and damage prompts. Defaults to true.
 * @returns {Promise<MidiQOL.Workflow|undefined>}
 * @example
 * const activityData = activity.toObject();
 * activityData.damage.parts[0].bonus = '@mod';
 * await workflowUtils.syntheticActivityDataRoll(activityData, item, [target.document]);
 */
async function syntheticActivityDataRoll(activityData, item, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeResources, spellSlot = true, fast = true} = {}) {
    const user = userId ? game.users.get(userId) : queryUtils.firstOwner(item.actor);
    if (user && user.id !== game.user.id) {
        return MidiQOL.restoreWorkflowTokenSets(await queryUtils.query('syntheticActivityDataRoll', user, {
            activityData,
            itemUuid: item.uuid,
            targetUuids: targets.map(t => t.uuid),
            config,
            options,
            dialog,
            message,
            atLevel,
            consumeResources,
            spellSlot,
            fast
        }, fast ? MidiQOL.configSettings().reactionTimeout * 1000 : null));
    }
    const activity = activityUtils.syntheticActivity(activityData, item);
    return await syntheticActivityRoll(activity, targets, {config, options, dialog, message, userId: user?.id, atLevel, consumeResources, spellSlot, fast});
}
/**
 * Roll a cost activity of an item with its consumption scaled by `amount`, so the cost is spent through midi with no
 * targets. Shows a warning when the activity is missing.
 * @param {Item5e} item                Item holding the cost activity.
 * @param {string} activityIdentifier  Identifier of the cost activity, usually hidden.
 * @param {number} amount              Scaling amount for the consumption, passed to
 *                                     {@link activityUtils.getConsumptionModifiedActivityData}.
 * @returns {Promise<MidiQOL.Workflow|undefined>}
 * @example
 * await workflowUtils.spendScaledCost(item, 'spend-dice', diceCount);
 */
async function spendScaledCost(item, activityIdentifier, amount) {
    const activity = itemUtils.getActivityByIdentifier(item, activityIdentifier);
    const activityData = activity ? activityUtils.getConsumptionModifiedActivityData(activity, amount) : undefined;
    if (!activityData) {
        genericUtils.notify('CAT.Error.MissingCostActivity', {type: 'warn'});
        return;
    }
    return await syntheticActivityDataRoll(activityData, item, []);
}
/**
 * Use an item through `MidiQOL.completeItemUse` without the usage dialog. The roll runs as `userId`, or as the actor's
 * first active player owner with the GM as fallback.
 * @param {Item5e} item                                  Item to use.
 * @param {foundry.documents.TokenDocument[]} [targets]  Tokens the use is aimed at.
 * @param {object} [options]                             Additional options.
 * @param {object} [options.config]                      Merged over the usage config.
 * @param {object} [options.options]                     Merged over midi's options. Its `asUser` is filled in when
 *                                                       missing.
 * @param {object} [options.dialog]                      Usage dialog configuration.
 * @param {object} [options.message]                     Chat message configuration.
 * @param {string} [options.userId]                      Id of the user the roll runs as.
 * @param {number} [options.atLevel]                     Spell level to cast at. Ignored when the actor has no
 *                                                       equivalent slot.
 * @param {boolean} [options.consumeResources]           Spend the resources the activity consumes. Defaults to true.
 * @param {boolean} [options.spellSlot]                  Spend a spell slot. Defaults to true.
 * @param {boolean} [options.fast]                       Skip the attack and damage prompts. Defaults to false.
 * @param {boolean} [options.autoDamage]                 Roll damage by midi's autoRollDamage setting, or on hit when
 *                                                       that setting is off. Defaults to true.
 * @returns {Promise<MidiQOL.Workflow|undefined>}        Undefined when midi declines the use.
 * @example
 * await workflowUtils.completeItemUse(item, [target.document], {consumeResources: false, spellSlot: false});
 */
async function completeItemUse(item, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeResources = true, spellSlot = true, fast = false, autoDamage = true} = {}) {
    const defaultConfig = {
        consume: {
            resources: consumeResources,
            spellSlot
        }
    };
    const defaultOptions = {
        targetUuids: targets.map(i => i.uuid),
        configureDialog: false,
        workflowOptions: fastWorkflowOptions(fast)
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
    options = {...options, asUser: options.asUser || userId || queryUtils.firstOwner(item.actor, true)};
    options = genericUtils.mergeObject(defaultOptions, options);
    config = genericUtils.mergeObject(defaultConfig, config);
    config.midiOptions = options;
    if (!config.midiOptions?.asUser && !queryUtils.hasPermission(item.actor, game.userId)) {
        if (!config.midiOptions) config.midiOptions = {};
        config.midiOptions.asUser = queryUtils.firstOwner(item.actor, true);
        config.midiOptions.checkGMstatus = true;
        config.midiOptions.workflowData = true;
    } else if (config.midiOptions?.asUser && config.midiOptions?.asUser !== game.userId) {
        config.midiOptions.workflowData = true;
    }
    const workflow = await MidiQOL.completeItemUse(item, config, dialog, message);
    return workflow?.workflow ?? workflow;
}
/**
 * {@link completeItemUse} with `fast` defaulting to true and `autoDamage` always on.
 * @param {Item5e} item                                  Item to use.
 * @param {foundry.documents.TokenDocument[]} [targets]  Tokens the use is aimed at.
 * @param {object} [options]                             Additional options.
 * @param {object} [options.config]                      Merged over the usage config.
 * @param {object} [options.options]                     Merged over midi's options.
 * @param {object} [options.dialog]                      Usage dialog configuration.
 * @param {object} [options.message]                     Chat message configuration.
 * @param {string} [options.userId]                      Id of the user the roll runs as. Defaults to the actor's first
 *                                                       owner.
 * @param {number} [options.atLevel]                     Spell level to cast at. Ignored when the actor has no
 *                                                       equivalent slot.
 * @param {boolean} [options.consumeResources]           Spend the resources the activity consumes. Defaults to true.
 * @param {boolean} [options.spellSlot]                  Spend a spell slot. Defaults to true.
 * @param {boolean} [options.fast]                       Skip the attack and damage prompts. Defaults to true.
 * @returns {Promise<MidiQOL.Workflow|undefined>}        Undefined when midi declines the use.
 * @example
 * const workflow = await workflowUtils.syntheticItemRoll(item, [target.document]);
 * if (!workflow?.failedSaves.size) return;
 */
async function syntheticItemRoll(item, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeResources = true, spellSlot = true, fast = true} = {}) {
    return await completeItemUse(item, targets, {config, options, dialog, message, userId, atLevel, consumeResources, spellSlot, fast, autoDamage: true});
}
/**
 * {@link syntheticItemRoll} for item data that is not on the actor, such as a compendium copy. The item is built in
 * memory on `actor` and never created. When the rolling user is another client, the roll runs there through a query and
 * the result's token sets are restored; with `fast` on, the query times out after midi's reaction timeout.
 * @param {object} itemData                              Item data to roll.
 * @param {Actor5e} actor                                Actor the in-memory item belongs to.
 * @param {foundry.documents.TokenDocument[]} [targets]  Tokens the use is aimed at.
 * @param {object} [options]                             Additional options.
 * @param {object} [options.config]                      Merged over the usage config.
 * @param {object} [options.options]                     Merged over midi's options.
 * @param {object} [options.dialog]                      Usage dialog configuration.
 * @param {object} [options.message]                     Chat message configuration.
 * @param {string} [options.userId]                      Id of the user the roll runs as. Defaults to the actor's first
 *                                                       owner.
 * @param {number} [options.atLevel]                     Spell level to cast at. Ignored when the actor has no
 *                                                       equivalent slot.
 * @param {boolean} [options.consumeResources]           Spend the resources the activity consumes. Defaults to true.
 * @param {boolean} [options.spellSlot]                  Spend a spell slot. Defaults to true.
 * @param {boolean} [options.fast]                       Skip the attack and damage prompts. Defaults to true.
 * @returns {Promise<MidiQOL.Workflow|undefined>}
 * @example
 * const itemData = item.toObject();
 * itemData.name = 'Overcharged ' + item.name;
 * await workflowUtils.syntheticItemDataRoll(itemData, actor, [target.document]);
 */
async function syntheticItemDataRoll(itemData, actor, targets = [], {config = {}, options = {}, dialog = {}, message = {}, userId, atLevel, consumeResources = true, spellSlot = true, fast = true} = {}) {
    const user = userId ? game.users.get(userId) : queryUtils.firstOwner(actor);
    if (user && user.id !== game.user.id) {
        return MidiQOL.restoreWorkflowTokenSets(await queryUtils.query('syntheticItemDataRoll', user, {
            itemData,
            actorUuid: actor.uuid,
            targetUuids: targets.map(t => t.uuid),
            config,
            options,
            dialog,
            message,
            atLevel,
            consumeResources,
            spellSlot,
            fast
        }, fast ? MidiQOL.configSettings().reactionTimeout * 1000 : null));
    }
    const newItem = itemUtils.syntheticItem(itemData, actor);
    return await syntheticItemRoll(newItem, targets, {config, options, dialog, message, userId: user?.id, atLevel, consumeResources, spellSlot, fast});
}
/**
 * Use an item with every activation type set to `special`. A temporary enchantment from `sourceFeature` makes the
 * change and is deleted once the roll finishes. Rolls through {@link syntheticActivityRoll} or
 * {@link syntheticItemRoll}.
 * @param {Item5e} item                                Item to use.
 * @param {foundry.documents.TokenDocument[]} targets  Tokens the use is aimed at.
 * @param {Item5e} sourceFeature                       Feature granting the special use. Names the enchantment and is
 *                                                     its origin.
 * @param {object} [options]                           Additional options.
 * @param {dnd5e.documents.activity.Activity} [options.activity]
 *                                                     Use this activity of the item rather than the item itself.
 * @param {boolean} [options.consumeResources]         Spend the resources the use consumes. Defaults to false.
 * @param {boolean} [options.spellSlot]                Spend a spell slot. Defaults to true.
 * @returns {Promise<MidiQOL.Workflow|undefined>}
 * @example
 * await workflowUtils.specialItemUse(weapon, [target.document], item, {activity: weapon.system.activities.contents[0]});
 */
async function specialItemUse(item, targets, sourceFeature, {activity, consumeResources = false, spellSlot = true} = {}) {
    const changes = Object.keys(CONFIG.DND5E.activityTypes).map(type => ({
        key: 'activities[' + type + '].activation.type',
        type: 'override',
        value: 'special',
        priority: 20
    }));
    changes.push({key: 'system.activation.type', type: 'override', value: 'special', priority: 20});
    const effectData = documentUtils.getBaseEffectData(sourceFeature, {
        name: sourceFeature.name,
        img: constants.tempConditionIcon,
        origin: sourceFeature.uuid,
        changes,
        duration: {value: 1, units: 'seconds'}
    });
    const effect = await itemUtils.enchantItem(item, effectData);
    const workflow = activity ? await syntheticActivityRoll(item.system.activities.get(activity.id), targets, {consumeResources, spellSlot}) : await syntheticItemRoll(item, targets, {consumeResources, spellSlot});
    if (effect) await documentUtils.deleteDocument(effect);
    return workflow;
}
/**
 * Replace a damage item's raw damage entries, keeping only the first value.
 * @param {object} ditem         Midi damage item, from workflow.damageList.
 * @param {number} [firstValue]  Value for the first entry; the rest are zeroed.
 */
function setRawDamageValues(ditem, firstValue = 0) {
    ditem.damages = ditem.damages.map((entry, index) => ({...entry, value: index ? 0 : firstValue}));
}
/**
 * Zero every damage entry on a damage item and recalculate it, so the target takes no damage.
 * @param {object} ditem  Midi damage item, from `workflow.damageList`.
 * @example
 * const ditem = workflow.damageList.find(i => i.actorUuid === actor.uuid);
 * workflowUtils.negateDamageItemDamage(ditem);
 */
function negateDamageItemDamage(ditem) {
    ditem.calculatedDamages.forEach(i => i.value = 0);
    setRawDamageValues(ditem);
    recalculateHP(ditem);
}
/**
 * Add or subtract a flat amount of damage on one target and recalculate its resulting hit points. Use in the
 * `damageFlatReductions` or `damagePercentReductions` macro passes. A reduction with no `type` is spread across the
 * damage types the target actually takes, in order, and never drops below zero.
 * @param {object} ditem                        Midi damage item, from `workflow.damageList`.
 * @param {number} modificationAmount           Damage to add. Negative to reduce damage.
 * @param {object} [options]                    Additional options.
 * @param {string} [options.type]               Damage type of the modification. Defaults to `none`.
 * @param {number|'auto'} [options.multiplier]  Multiplier for the modification. `'auto'` applies the target's save
 *                                              multiplier, immunity, resistance and vulnerability. Defaults to 1.
 * @example
 * // Reduce the damage by 3
 * workflowUtils.modifyDamageAppliedFlat(ditem, -3);
 * // Add radiant damage, adjusted by the target's defenses
 * workflowUtils.modifyDamageAppliedFlat(ditem, roll.total, {type: 'radiant', multiplier: 'auto'});
 */
function modifyDamageAppliedFlat(ditem, modificationAmount, {type = 'none', multiplier = 1} = {}) {
    if (modificationAmount < 0 && type === 'none') {
        const amounts = {};
        let pool = Math.abs(modificationAmount);
        const damages = genericUtils.deepClone(ditem.calculatedDamages);
        for (const dmg of damages) {
            const mult = dmg.active?.multiplier ?? 1;
            if (dmg.active?.type?.immunity || mult === 0 || dmg.value === 0) continue;
            if (amounts[dmg.type]) amounts[dmg.type].damage += dmg.damage;
            else amounts[dmg.type] = {damage: dmg.damage, mult, active: dmg.active};
        }
        for (const [type, {damage, mult, active}] of Object.entries(amounts)) {
            if (damage <= 0) continue;
            const distributedReduction = Math.min(damage, pool);
            addDamageDetail(ditem, -distributedReduction, type, mult, active);
            pool -= distributedReduction;
            if (pool <= 0) break;
        }
    } else addDamageDetail(ditem, modificationAmount, type, multiplier);
    recalculateHP(ditem);
}
/**
 * Push a damage entry onto a damage item's calculated and raw damages. Negative non-healing values are capped at the
 * damage dealt.
 * @param {object} ditem              Midi damage item, from workflow.damageList.
 * @param {number} damage             Damage before the multiplier.
 * @param {string} type               Damage type.
 * @param {number|'auto'} multiplier  'auto' applies the target's immunity, resistance and vulnerability.
 * @param {object} [active]           Active modifiers record to copy onto the entry.
 */
function addDamageDetail(ditem, damage, type, multiplier, active) {
    active ??= {type: {}};
    if (ditem.saved) active.type.saved = true;
    if (multiplier === 'auto') {
        const {damageImmunityMultiplier, damageResistanceMultiplier, damageVulnerabilityMultiplier} = MidiQOL.configSettings();
        const midiOptions = ditem.options?.midi;
        multiplier = midiOptions?.saved ? (midiOptions?.saveMultiplier ?? 1) : 1;
        if (type === 'healing' && ditem.options?.invertHealing) multiplier *= -1;
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
    let value = Math.trunc(damage * multiplier);
    if (value < 0 && type !== 'healing') value = Math.max(value, -ditem.totalDamage);
    ditem.calculatedDamages.push({active, potential: {}, type, value, damage, properties: new Set()});
    ditem.damages.push({damage, value: damage, type, properties: new Set()});
}
/**
 * Refund what a use consumed, from the deltas the system recorded on its usage card. The deltas are then cleared from
 * the card so the refund cannot repeat.
 * @param {MidiQOL.Workflow} workflow  Workflow whose use is refunded.
 * @returns {Promise<boolean>}         False when the card has no deltas or the workflow has no activity.
 * @example
 * if (!workflow.targets.size) await workflowUtils.refundUse(workflow);
 */
async function refundUse(workflow) {
    const message = workflow.chatCard ?? game.messages.get(workflow.itemCardId);
    const deltas = message?.system?.deltas;
    if (!deltas || !workflow.activity) return false;
    await workflow.activity.refund(deltas);
    await documentUtils.update(message, {'system.deltas': null});
    return true;
}
/**
 * Clear the bonus action or reaction a use marked as spent, when the actor still had it before the use started.
 * @param {MidiQOL.Workflow} workflow  Workflow whose action economy is restored.
 * @returns {Promise<void>}
 * @example
 * await workflowUtils.restoreActionEconomy(workflow);
 */
async function restoreActionEconomy(workflow) {
    const usedBefore = getWorkflowProperty(workflow, 'usedBefore');
    if (!usedBefore || !workflow.actor) return;
    if (workflow.itemUsesBonusAction && !usedBefore.bonus && MidiQOL.hasUsedBonusAction(workflow.actor)) await MidiQOL.removeBonusActionUsed(workflow.actor, true);
    if (workflow.itemUsesReaction && !usedBefore.reaction && MidiQOL.hasUsedReaction(workflow.actor)) await MidiQOL.removeReactionUsed(workflow.actor, true);
}
/**
 * Whether the workflow continues an earlier use rather than starting a fresh one. True for over time rolls,
 * automation-only activities and spell activities that spend no slot. Always false after {@link setNotSustainedRoll}.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @returns {boolean}
 * @example
 * if (workflowUtils.isSustainedRoll(workflow)) return;
 */
function isSustainedRoll(workflow) {
    if (getWorkflowProperty(workflow, 'allowSustainedRoll')) return false;
    if (['workflowOptions.isOverTime', 'activity.isOverTimeFlag', 'activity.midiProperties.automationOnly'].some(p => genericUtils.getProperty(workflow, p))) return true;
    return workflow.item?.type === 'spell' && !workflow.activity?.consumption?.spellSlot;
}
/**
 * Mark the workflow as a fresh use, so {@link isSustainedRoll} returns false for it.
 * @param {MidiQOL.Workflow|object} workflow  Workflow in progress, or an options object for a synthetic roll.
 * @example
 * const options = {};
 * workflowUtils.setNotSustainedRoll(options);
 * await workflowUtils.syntheticItemRoll(item, [target.document], {options});
 */
function setNotSustainedRoll(workflow) {
    setWorkflowProperty(workflow, 'allowSustainedRoll', true);
}
/**
 * Replace the damage a target takes with a single total, then recalculate its resulting hit points and temporary hit
 * points. The total goes on the first damage entry and every other entry is zeroed.
 * @param {object} ditem         Midi damage item, from `workflow.damageList`.
 * @param {number} damageAmount  Replacement damage total.
 * @param {boolean} [adjustRaw]  Also overwrite the raw damage entries shown on the damage card. Defaults to true.
 * @example
 * workflowUtils.setDamageItemDamage(ditem, Math.floor(ditem.totalDamage / 2));
 */
function setDamageItemDamage(ditem, damageAmount, adjustRaw = true) {
    const entries = ditem.calculatedDamages;
    entries.forEach(i => i.value = 0);
    entries[0].value = damageAmount;
    if (adjustRaw) setRawDamageValues(ditem, damageAmount);
    recalculateHP(ditem);
}
/**
 * Store a value on the workflow at `workflowOptions.cat.<path>`, for reading in a later pass with
 * {@link getWorkflowProperty}. Passing an options object for a synthetic roll carries the value into that roll's
 * workflow.
 * @param {MidiQOL.Workflow|object} workflow  Workflow in progress, or an options object for a synthetic roll.
 * @param {string} path                       Dot path below `workflowOptions.cat`.
 * @param {*} value                           Value to store.
 * @example
 * workflowUtils.setWorkflowProperty(workflow, 'divineSmite.used', true);
 */
function setWorkflowProperty(workflow, path, value) {
    genericUtils.setProperty(workflow, 'workflowOptions.cat.' + path, value);
}
/**
 * Read a value stored by {@link setWorkflowProperty}.
 * @param {MidiQOL.Workflow|object} workflow  Workflow in progress, or a roll config carrying `workflowOptions`.
 * @param {string} path                       Dot path below `workflowOptions.cat`.
 * @returns {*}                               Undefined when nothing is stored at the path.
 * @example
 * if (workflowUtils.getWorkflowProperty(workflow, 'divineSmite.used')) return;
 */
function getWorkflowProperty(workflow, path) {
    return genericUtils.getProperty(workflow, 'workflowOptions.cat.' + path);
}
/**
 * Flag conditions a macro may apply during the workflow. CAT reads the flags for condition resistance and
 * vulnerability. Adds to any conditions already flagged.
 * @param {MidiQOL.Workflow|object} workflow  Workflow in progress, or an options object for a synthetic roll.
 * @param {string|string[]} conditions        Condition ids to flag.
 * @example
 * workflowUtils.addMacroConditions(workflow, ['prone', 'restrained']);
 */
function addMacroConditions(workflow, conditions) {
    const existing = getMacroConditions(workflow);
    if (typeof conditions === 'string') existing.add(conditions);
    else conditions.forEach(c => existing.add(c));
    setWorkflowProperty(workflow, 'conditions', Array.from(existing));
}
/**
 * Conditions flagged by {@link addMacroConditions}.
 * @param {MidiQOL.Workflow|object} workflow  Workflow in progress, or a roll config carrying `workflowOptions`.
 * @returns {Set<string>}                     Condition ids. Empty when none are flagged.
 * @example
 * if (workflowUtils.getMacroConditions(workflow).has('frightened')) return;
 */
function getMacroConditions(workflow) {
    return new Set(getWorkflowProperty(workflow, 'conditions') ?? []);
}
/**
 * The activity, item and actor that requested a saving throw, read from the save roll config. Checks CAT's stored
 * activity, then midi's workflow, then midi's save activity and item uuids.
 * @param {object} config  Save roll config.
 * @returns {{activity: Activity|undefined, item: Item5e, actor: foundry.documents.Actor}|undefined}
 *                         Undefined when no source actor is found.
 * @example
 * const source = workflowUtils.getSaveSource(config);
 * if (source?.item.type !== 'spell') return;
 */
function getSaveSource(config) {
    const {workflowId, saveItemUuid, saveActivityUuid} = config.midiOptions ?? {};
    const activity = getWorkflowProperty(config, 'activity') ?? (workflowId ? MidiQOL.Workflow.getWorkflow(workflowId)?.activity : undefined) ?? (saveActivityUuid ? fromUuidSync(saveActivityUuid, {strict: false}) : undefined);
    const item = activity?.item ?? (saveItemUuid ? fromUuidSync(saveItemUuid, {strict: false}) : undefined);
    const actor = item?.actor;
    if (!actor) return;
    return {activity, item, actor};
}
/**
 * The tokens an activity is about to target, for use in a pre-targeting pass. Returns midi's requested `targetUuids`
 * when the config has any, otherwise the current user's targets.
 * @param {object} config                        Activity use config.
 * @returns {foundry.documents.TokenDocument[]}  Uuids that no longer resolve are dropped.
 * @example
 * const targets = workflowUtils.getPreTargetingTargets(config);
 */
function getPreTargetingTargets(config) {
    const targetUuids = config?.midiOptions?.targetUuids;
    if (targetUuids?.length) return targetUuids.map(uuid => fromUuidSync(uuid, {strict: false})).filter(Boolean);
    return Array.from(game.user.targets, token => token.document);
}
/**
 * The activity that requested a roll, loaded by uuid from CAT's stored `activityUuid` or midi's `saveActivityUuid`.
 * @param {object} config                  Roll configuration.
 * @returns {Promise<Activity|undefined>}  Undefined when the config holds neither uuid.
 * @example
 * const activity = await workflowUtils.getConfigActivity(config);
 */
async function getConfigActivity(config) {
    const uuid = getWorkflowProperty(config, 'activityUuid') ?? config.midiOptions?.saveActivityUuid;
    if (uuid) return await fromUuid(uuid);
}
/**
 * Roll an extra damage roll and append it to the workflow's damage rolls. Use after the workflow's damage has been
 * rolled. On a critical hit the formula is made critical with {@link rollUtils.getCriticalFormula} unless `ignoreCrit`
 * is set.
 * @param {MidiQOL.Workflow} workflow     Workflow in progress.
 * @param {string|number} formula         Formula to roll, using the activity's roll data.
 * @param {object} [options]              Additional options.
 * @param {boolean} [options.ignoreCrit]  Skip the critical formula on a critical hit.
 * @param {string} [options.damageType]   Damage type of the roll. Defaults to the workflow's default damage type.
 * @param {string} [options.source]       What granted this damage, shown as attribution on manual rolls.
 * @example
 * await workflowUtils.bonusDamage(workflow, '2d8', {damageType: 'radiant', source: item.name});
 */
async function bonusDamage(workflow, formula, {ignoreCrit = false, damageType = workflow.defaultDamageType, source} = {}) {
    formula = String(formula);
    if (workflow.isCritical && !ignoreCrit) formula = rollUtils.getCriticalFormula(formula, workflow.activity);
    const roll = await new CONFIG.Dice.DamageRoll(formula, workflow.activity.getRollData(), {type: damageType, cat: {source}}).evaluate();
    workflow.damageRolls.push(roll);
    await workflow.setDamageRolls(workflow.damageRolls);
}
/**
 * Every damage type across a set of damage rolls, read from each roll's `options.type`.
 * @param {foundry.dice.Roll[]} damageRolls  Rolls to read the types from.
 * @returns {Set<string>}
 * @example
 * if (!workflowUtils.getDamageTypes(workflow.damageRolls).has('fire')) return;
 */
function getDamageTypes(damageRolls) {
    return new Set(damageRolls.map(i => i.options.type));
}
/**
 * The spell level the workflow's item was cast at, from the workflow's cast data or the item's saved cast data. Returns
 * the higher of the cast level and the base level.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @returns {number|undefined}         Undefined when no cast data or cast level is available.
 * @example
 * const extraDice = workflowUtils.getCastLevel(workflow) - 1;
 */
function getCastLevel(workflow) {
    const castData = workflow.castData ?? itemUtils.getSavedCastData(workflow.item);
    if (!castData) return;
    const level = Math.max(castData.castLevel ?? -1, castData.baseLevel ?? -1);
    return level < 0 ? undefined : level;
}
/**
 * The workflow's range in feet, converted from midi's `rangeDetails.range` using the activity's range units. Touch
 * activities return the item's reach.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @returns {number|undefined}         Range in feet. Midi's value is returned unconverted when the workflow has no
 *                                     activity, and undefined when midi measured no range.
 * @example
 * const range = workflowUtils.getRange(workflow);
 * const nearby = tokenUtils.findNearby(workflow.token.document, range, {disposition: 'enemy'});
 */
function getRange(workflow) {
    const range = workflow.rangeDetails?.range;
    if (!range || !workflow.activity) return range;
    const units = workflow.activity.range?.units;
    const sceneUnits = workflow.token?.document.parent.grid.units?.toLowerCase();
    if (units === 'touch') return itemUtils.getRange(workflow.item).reach ?? distanceUtils.toFeet(workflow.token.document.parent, range);
    if (units === 'mi' && ['feet', 'ft'].includes(sceneUnits)) return range;
    if (units === 'mi' && ['yards', 'yd', 'yds'].includes(sceneUnits)) return range * 3;
    if (units === 'km' && ['meter', 'm', 'meters', 'metre', 'metres'].includes(sceneUnits)) return dnd5e.utils.convertLength(range, 'm', {to: 'ft', legacy: false}).value;
    return dnd5e.utils.convertLength(range, units, {to: 'ft', legacy: false}).value;
}
/**
 * Swap the workflow's item for a modified copy in memory. The workflow's activity is replaced with the copy's activity
 * of the same id.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @param {Item5e} item                Replacement item, holding an activity with the current activity's id.
 * @example
 * const clone = workflow.item.clone({'system.properties': ['mgc']}, {keepId: true});
 * workflowUtils.setItem(workflow, clone);
 */
function setItem(workflow, item) {
    workflow.item = item;
    workflow.activity = item.system.activities.get(workflow.activity.id);
}
/**
 * Swap the workflow's activity for a modified copy. The item is cloned in memory with the new activity data and passed
 * to {@link setItem}.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @param {object} activityData        Replacement data for the activity in use.
 * @example
 * const activityData = workflow.activity.toObject();
 * activityData.damage.parts[0].types = ['force'];
 * workflowUtils.setActivity(workflow, activityData);
 */
function setActivity(workflow, activityData) {
    setItem(workflow, workflow.item.clone({['system.activities.' + workflow.activity.id]: activityData}, {keepId: true}));
}
/**
 * Add a formula to the workflow's attack roll after it has been rolled, through {@link rollUtils.addToRoll}. Any dice
 * in the formula are rolled.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @param {string|number} formula      Formula to add, using the activity's roll data.
 * @example
 * await workflowUtils.bonusAttack(workflow, '1d4');
 */
async function bonusAttack(workflow, formula) {
    let roll = await rollUtils.addToRoll(workflow.attackRoll, formula, {rollData: workflow.activity.getRollData()});
    await workflow.setAttackRoll(roll);
}
/**
 * Queue a part for the workflow's attack roll formula, applied when the attack is rolled. Use before the attack roll;
 * {@link bonusAttack} changes a roll already made.
 * @param {MidiQOL.Workflow|object} workflow  Workflow in progress, or an options object for a synthetic roll.
 * @param {string|number} formula             Formula to add, such as `'-1d4'`.
 * @example
 * workflowUtils.addAttackRollPart(workflow, '-1d4');
 */
function addAttackRollPart(workflow, formula) {
    const parts = getWorkflowProperty(workflow, 'attackRollParts') ?? [];
    parts.push(String(formula));
    setWorkflowProperty(workflow, 'attackRollParts', parts);
}
/**
 * Reroll chosen damage dice of the workflow in place and post the new results to chat. Each chosen die keeps its new
 * result. Manual rolls are resolved through {@link rollUtils.resolveManualRolls}.
 * @param {MidiQOL.Workflow} workflow  Workflow whose damage rolls change.
 * @param {string[]} selection         Die keys from {@link dialogUtils.selectDie}. Keys that don't resolve are skipped.
 * @param {Item5e} document            Item that supplies roll data and names the reroll.
 * @example
 * const selection = await dialogUtils.selectDie(workflow.damageRolls, item.name, 'Reroll which dice?', {max: 2});
 * if (selection) await workflowUtils.rerollDamageDice(workflow, selection, item);
 */
async function rerollDamageDice(workflow, selection, document) {
    const rollData = document.getRollData();
    const rerolls = [];
    const changed = new Set();
    for (const key of selection) {
        const result = genericUtils.getProperty(workflow.damageRolls, key);
        if (!result) continue;
        const parts = key.split('.');
        const term = genericUtils.getProperty(workflow.damageRolls, parts.slice(0, -2).join('.'));
        if (!term) continue;
        rerolls.push({result, faces: term.faces, original: result.result});
        changed.add(workflow.damageRolls[parts[0]]);
    }
    if (!rerolls.length) return;
    const groups = rerolls.reduce((accumulator, reroll) => {
        const group = accumulator.get(reroll.faces) ?? [];
        group.push(reroll);
        return accumulator.set(reroll.faces, group);
    }, new Map());
    const rolls = Array.from(groups, ([faces, group]) => new Roll(group.length + 'd' + faces, rollData));
    const resolved = await rollUtils.resolveManualRolls(rolls, workflow.actor, document.name, {rollClass: Roll});
    if (resolved === rolls) await Promise.all(rolls.map(async roll => await roll.evaluate()));
    Array.from(groups.values()).forEach((group, groupIndex) => {
        const results = resolved[groupIndex].terms[0].results;
        group.forEach((reroll, index) => reroll.result.result = results[index].result);
    });
    const messageData = {
        speaker: ChatMessage.implementation.getSpeaker({actor: workflow.actor}),
        flavor: _loc('CAT.Generic.Rerolled', {dice: rerolls.map(reroll => 'd' + reroll.faces + ' (' + reroll.original + ')').join(', ')}),
        rolls: resolved
    };
    ChatMessage.implementation.applyMode(messageData, CONFIG.Dice.BasicRoll.getMessageMode());
    await ChatMessage.implementation.create(messageData);
    changed.forEach(roll => roll._total = roll._evaluateTotal());
    await workflow.setDamageRolls(workflow.damageRolls);
}
/**
 * Roll the workflow's damage rolls a second time and keep one set. With `keep` empty, the current user picks a set in a
 * dialog. The discarded dice stay on the kept rolls, marked as discarded.
 * @param {MidiQOL.Workflow} workflow   Workflow whose damage rolls change.
 * @param {Item5e} document             Item that names the reroll and the dialog.
 * @param {object} [options]            Additional options.
 * @param {'higher'|''} [options.keep]  `'higher'` keeps the higher total without asking. Defaults to `''`.
 * @param {number} [options.count]      Only reroll this many rolls from the start of the damage rolls. Defaults to all.
 * @returns {Promise<boolean>}          True when the second set was kept. False when the rolls have no dice.
 * @example
 * await workflowUtils.rerollKeepDamage(workflow, item, {keep: 'higher'});
 */
async function rerollKeepDamage(workflow, document, {keep = '', count} = {}) {
    const originals = workflow.damageRolls?.slice(0, count ?? workflow.damageRolls.length) ?? [];
    if (!originals.some(roll => roll.dice.length)) return false;
    const rolls = originals.map(roll => new roll.constructor(roll.formula, roll.data, roll.options));
    const rerolls = await rollUtils.resolveManualRolls(rolls, workflow.actor, document.name);
    if (rerolls === rolls) await Promise.all(rolls.map(async roll => await roll.evaluate()));
    const firstTotal = originals.reduce((total, roll) => total + roll.total, 0);
    const secondTotal = rerolls.reduce((total, roll) => total + roll.total, 0);
    let useSecond = secondTotal > firstTotal;
    if (keep !== 'higher') {
        const selection = await dialogUtils.buttonDialog(document.name, 'CAT.Dialog.RerollKeep.Choose', [
            [_loc('CAT.Dialog.RerollKeep.First', {total: firstTotal}), 'first'],
            [_loc('CAT.Dialog.RerollKeep.Second', {total: secondTotal}), 'second']
        ]);
        useSecond = selection === 'second';
    }
    const kept = useSecond ? rerolls : originals;
    const discarded = useSecond ? originals : rerolls;
    kept.forEach((roll, rollIndex) => roll.terms.forEach((term, termIndex) => {
        if (term.isDeterministic) return;
        const results = discarded[rollIndex].terms[termIndex].results.map(result => ({...result, active: false, discarded: true}));
        term.results.push(...results);
    }));
    await workflow.setDamageRolls([...kept, ...workflow.damageRolls.slice(originals.length)]);
    return useSecond;
}
/**
 * Remove one source of disadvantage midi added to the workflow's attack roll, such as `range` or `nearbyFoe`. Does
 * nothing when that source is not present. Use before the attack is rolled.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @param {string} source              Midi's attribution key for the source.
 * @example
 * workflowUtils.removeAttackDisadvantage(workflow, 'nearbyFoe');
 */
function removeAttackDisadvantage(workflow, source) {
    const tracker = workflow.tracker;
    if (!tracker.attribution.DIS?.[source]) return;
    delete tracker.attribution.DIS[source];
    tracker.legacyAttribution.delete('DIS:' + source);
    const disadvantage = tracker.disadvantage;
    disadvantage.restore({...disadvantage.get, count: disadvantage.count - 1});
}
/**
 * Raise a target's AC against the workflow's attack only, by editing the AC stored on the usage card's targets in
 * memory. Use before midi checks hits. Does nothing when the card has no AC for that actor.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @param {Actor5e} actor              Targeted actor.
 * @param {number} amount              AC to add. Negative to lower it.
 * @example
 * workflowUtils.addTargetAC(workflow, target.actor, 5);
 */
function addTargetAC(workflow, actor, amount) {
    const descriptors = workflow.chatCard?.toObject().system.targets;
    const descriptor = descriptors?.find(target => target.actor === actor.uuid);
    if (descriptor?.ac == null) return;
    descriptor.ac += amount;
    workflow.chatCard.updateSource({'system.targets': descriptors});
    workflow.targetDescriptors = descriptors;
}
/**
 * Lower the critical threshold of the workflow's attack roll. Use before the attack is rolled. Repeated calls stack.
 * @param {MidiQOL.Workflow|object} workflow  Workflow in progress, or an options object for a synthetic roll.
 * @param {number} [amount]                   How far to lower the threshold. Defaults to 1.
 * @example
 * // Crit on 19 or 20
 * workflowUtils.expandAttackCriticalRange(workflow);
 */
function expandAttackCriticalRange(workflow, amount = 1) {
    setWorkflowProperty(workflow, 'attackCriticalRange', (getWorkflowProperty(workflow, 'attackCriticalRange') ?? 0) + amount);
}
/**
 * Apply an evaluated roll as damage from a token through a midi `DamageOnlyWorkflow`, outside any item use.
 * @param {foundry.documents.TokenDocument} sourceToken  Token dealing the damage.
 * @param {foundry.dice.Roll} damageRoll                 Evaluated roll to apply. Its total is the damage.
 * @param {string} damageType                            Damage type to apply it as.
 * @param {foundry.documents.TokenDocument[]|Set<foundry.documents.TokenDocument>} targets
 *                                                       Tokens taking the damage.
 * @param {object} [options]                             Additional options.
 * @param {string} [options.flavor]                      Flavor text for the chat card.
 * @param {string} [options.itemCardUuid]                Chat card to add the damage to. Defaults to `'new'`, which
 *                                                       posts a fresh card.
 * @param {Item5e} [options.sourceItem]                  Item whose name, image and type the card shows.
 * @returns {MidiQOL.DamageOnlyWorkflow}
 * @example
 * const roll = await new CONFIG.Dice.DamageRoll('2d6', {}, {type: 'fire'}).evaluate();
 * workflowUtils.applyWorkflowDamage(token, roll, 'fire', [target.document], {sourceItem: item});
 */
function applyWorkflowDamage(sourceToken, damageRoll, damageType, targets, {flavor, itemCardUuid = 'new', sourceItem} = {}) {
    let itemData = {};
    if (sourceItem) {
        itemData = {
            name: sourceItem.name,
            img: sourceItem.img,
            type: sourceItem.type
        };
    }
    return new MidiQOL.DamageOnlyWorkflow(sourceToken.actor, sourceToken.object, damageRoll.total, damageType, Array.from(targets), damageRoll, {flavor, itemCardUuid, itemData});
}
/**
 * Hit points and temporary hit points the workflow's damage removed, summed across its damage list. Healing counts as
 * zero.
 * @param {MidiQOL.Workflow} workflow                Workflow whose damage has been applied.
 * @param {foundry.documents.TokenDocument} [token]  Only count damage to this token's actor.
 * @returns {number}                                 `0` when the workflow has no damage list.
 * @example
 * const dealt = workflowUtils.getDamageDealt(workflow, target.document);
 */
function getDamageDealt(workflow, token) {
    const entries = (workflow.damageList ?? []).filter(entry => !token || entry.actorUuid === token.actor?.uuid);
    return entries.reduce((total, entry) => total + Math.max(0, entry.hpDamage ?? 0) + Math.max(0, entry.tempDamage ?? 0), 0);
}
/**
 * Apply a flat amount of damage to tokens through `MidiQOL.applyTokenDamage`, without a workflow or roll.
 * @param {foundry.documents.TokenDocument[]|Set<foundry.documents.TokenDocument>} tokens
 *                                         Tokens taking the damage.
 * @param {number} value                   Damage to apply.
 * @param {string} damageType              Damage type to apply it as.
 * @param {object} [options]               Additional options.
 * @param {string[]} [options.properties]  Damage properties, such as `mgc`.
 * @returns {Promise<string[]>}            ChatMessage uuids.
 * @example
 * await workflowUtils.applyDamage([target.document], 10, 'bludgeoning');
 */
async function applyDamage(tokens, value, damageType, {properties = []} = {}) {
    return await MidiQOL.applyTokenDamage([{value, type: damageType, properties: new Set(properties)}], value, tokens);
}
/**
 * Replace the workflow's targets and set the same tokens as a user's canvas targets. Another user's targets are set on
 * their client through a query.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @param {foundry.documents.TokenDocument[]|Set<foundry.documents.TokenDocument>} targets
 *                                     New targets.
 * @param {string} [userId]            Id of the user whose canvas targets are set. Defaults to the current user.
 * @example
 * await workflowUtils.updateTargets(workflow, [target.document]);
 */
async function updateTargets(workflow, targets, userId = game.user.id) {
    workflow.targets = new Set(targets);
    const ids = Array.from(targets, t => t.id);
    if (userId === game.user.id) canvas.tokens?.setTargets(ids);
    else await queryUtils.query('updateTargets', game.users.get(userId), {ids});
}
/**
 * Drop tokens from the workflow's targets through {@link updateTargets}, which also resets the user's canvas targets.
 * @param {MidiQOL.Workflow} workflow                 Workflow in progress.
 * @param {foundry.documents.TokenDocument[]} tokens  Tokens to drop.
 * @param {string} [userId]                           Id of the user whose canvas targets are set. Defaults to the
 *                                                    current user.
 * @example
 * await workflowUtils.removeTargets(workflow, [workflow.token.document]);
 */
async function removeTargets(workflow, tokens, userId = game.user.id) {
    await updateTargets(workflow, workflow.targets.difference(new Set(tokens)).documents, userId);
}
/**
 * Rewrite a damage item so the target ends on `targetHP` hit points. A target above `targetHP` also loses all its
 * temporary hit points. A target below `targetHP` is healed up to it. Killing outright means the damage leaves the
 * target at or below its negative maximum hit points.
 * @param {object} ditem                      Midi damage item, from `workflow.damageList`.
 * @param {object} [options]                  Additional options.
 * @param {number} [options.targetHP]         Hit points the target is left on. Defaults to 1.
 * @param {boolean} [options.deathOnly]       Only intervene when the damage would kill outright.
 * @param {boolean} [options.killedOutright]  Only intervene when the damage would not kill outright.
 * @param {Actor5e} [options.actor]           Damaged actor. Required by `deathOnly` and `killedOutright`; without it
 *                                            nothing changes.
 * @example
 * if (ditem.newHP > 0) return;
 * workflowUtils.preventZeroHP(ditem);
 */
function preventZeroHP(ditem, {targetHP = 1, deathOnly = false, killedOutright = false, actor} = {}) {
    if (deathOnly || killedOutright) {
        if (!actor) return;
        const resultingHP = ditem.oldHP + (ditem.oldTempHP ?? 0) - ditem.totalDamage;
        const maxHP = actor.system.attributes.hp.effectiveMax;
        if (deathOnly && resultingHP > -maxHP) return;
        if (killedOutright && resultingHP <= -maxHP) return;
    }
    const hpDamage = ditem.oldHP - targetHP;
    const totalDamage = hpDamage + (ditem.oldTempHP ?? 0);
    const entries = ditem.calculatedDamages;
    entries.forEach(i => i.value = 0);
    if (hpDamage < 0) addDamageDetail(ditem, hpDamage, 'healing', 1);
    else entries[0].value = totalDamage;
    setRawDamageValues(ditem, hpDamage < 0 ? hpDamage : totalDamage);
    recalculateHP(ditem);
}
/**
 * Recompute a damage item's totals and resulting hit points from its calculated damages, mirroring midi-qol.
 * @param {object} ditem  Midi damage item, from workflow.damageList.
 */
function recalculateHP(ditem) {
    const hp = fromUuidSync(ditem.actorUuid)?.system.attributes.hp;
    if (!hp) return;
    let amount = 0;
    let temp = 0;
    let healing = 0;
    let tempMax = 0;
    for (const entry of ditem.calculatedDamages) {
        if (entry.type === 'temphp') temp += entry.value;
        else if (entry.type === 'maximum') tempMax += entry.value;
        else if (entry.type === 'healing' || entry.active?.absorption || entry.active?.type?.absorption) healing += entry.value;
        else if (!['midi-none', 'vitality'].includes(entry.type)) amount += entry.value;
    }
    tempMax = Math.trunc(tempMax);
    const totalDamage = Math.max(0, amount);
    let change = totalDamage + healing;
    change = change > 0 ? Math.floor(change) : Math.ceil(change);
    const oldTemp = hp.temp ?? 0;
    const tempDamage = change > 0 ? Math.min(oldTemp, change) : 0;
    const hpDamage = Math.clamp(change - tempDamage, -hp.damage + tempMax, hp.value - tempMax);
    Object.assign(ditem, {totalDamage, hpDamage, tempDamage, newHP: hp.value - hpDamage, newTempHP: Math.max(oldTemp - tempDamage, temp)});
}

/**
 * Give one target a modifier on the d20 roll it makes during the workflow, with attribution shown on the chat card.
 * Pass an options object to carry the modifier into a synthetic roll.
 * @param {MidiQOL.Workflow|object} options    Workflow in progress, or an options object for a synthetic roll.
 * @param {'adv'|'dis'|'succeed'|'fail'} type  Modifier to grant.
 * @param {string} tokenID                     Id of the token the modifier applies to.
 * @param {string} attributionID               Key for midi's roll attribution.
 * @param {string} [attributionDisplay]        Localized label shown on the chat card. Defaults to `attributionID`.
 * @example
 * // Blight on a plant creature
 * workflowUtils.grantRollModifier(workflow, 'fail', workflow.targets.documents[0].id, 'creature-type', 'Plant Creature');
 * // Grapple an incapacitated target
 * const options = {};
 * workflowUtils.grantRollModifier(options, 'fail', target.id, 'incapacitated', 'Incapacitated');
 * await workflowUtils.syntheticItemRoll(grappleItem, [target], {options});
 */
function grantRollModifier(options, type, tokenID, attributionID, attributionDisplay = attributionID) {
    const mods = getWorkflowProperty(options, 'rollModifiers') ?? {};
    mods[tokenID] ??= {};
    mods[tokenID][type + '-' + attributionID] = {type, identifier: attributionID, display: attributionDisplay};
    setWorkflowProperty(options, 'rollModifiers', mods);
}
/** @typedef {import('../events/workflow.mjs').HitData} HitData */
/**
 * Change a target's AC against the attack, with an optional icon on the chat card. Use only in the `bonusAC` or
 * `changeHit` macro passes. No icon is added when no `document`, `icon`, `img` or `tooltip` is given; a tooltip alone
 * gets a bolt icon.
 * @param {MidiQOL.Workflow} workflow                         Workflow in progress.
 * @param {HitData} hitData                                   Hit data for one target, from the `bonusAC` or `changeHit`
 *                                                            macro pass.
 * @param {number} value                                      Amount added to the target's AC. Negative to lower it.
 * @param {object} [attribution]                              Chat card attribution.
 * @param {foundry.abstract.Document} [attribution.document]  Supplies `img` and a tooltip of its name and the bonus,
 *                                                            unless those are given.
 * @param {string} [attribution.icon]                         CSS class of a Font Awesome icon.
 * @param {string} [attribution.img]                          Image path for the icon.
 * @param {string} [attribution.tooltip]                      Localized tooltip on the icon.
 * @example
 * workflowUtils.bonusAC(workflow, hitData, 5, {document: item});
 */
function bonusAC(workflow, hitData, value, {document, icon, img, tooltip} = {}) {
    hitData.ac += value;
    if (document) {
        img ||= document.img ?? document.texture.src;
        tooltip ||= `${document.name} ${Math.sign(value) < 0 ? '' : '+'}${value}`;
    }
    if (!icon && !img && !tooltip) return;
    const attributions = getWorkflowProperty(workflow, 'acAttributions') ?? {};
    const attribution = {icon, img, tooltip};
    if (tooltip && !icon && !img) icon = 'fas fa-bolt';
    if (icon) attribution.cssClass = 'midi-qol-ac-icon-fa';
    else if (img) attribution.cssClass = 'midi-qol-ac-icon-img cat-ac-icon';
    attributions[hitData.target.uuid] ??= [];
    attributions[hitData.target.uuid].push(attribution);
    setWorkflowProperty(workflow, 'acAttributions', attributions);
}
/**
 * Force the attack to hit or miss a target, with an optional icon on the chat card. Use only in the `bonusAC` or
 * `changeHit` macro passes. No icon is added when no `document`, `icon`, `img` or `tooltip` is given; a tooltip alone
 * gets a bolt icon.
 * @param {MidiQOL.Workflow} workflow                         Workflow in progress.
 * @param {HitData} hitData                                   Hit data for one target, from the `bonusAC` or `changeHit`
 *                                                            macro pass.
 * @param {boolean} value                                     True for a hit, false for a miss.
 * @param {object} [attribution]                              Chat card attribution.
 * @param {foundry.abstract.Document} [attribution.document]  Supplies `img` and a tooltip of its name and the result,
 *                                                            unless those are given.
 * @param {string} [attribution.icon]                         CSS class of a Font Awesome icon.
 * @param {string} [attribution.img]                          Image path for the icon.
 * @param {string} [attribution.tooltip]                      Localized tooltip on the icon.
 * @example
 * workflowUtils.changeHit(workflow, hitData, false, {document: item});
 */
function changeHit(workflow, hitData, value, {document, icon, img, tooltip} = {}) {
    hitData.isHit = value;
    if (document) {
        img ||= document.img ?? document.texture.src;
        tooltip ||= `${document.name}: ${_loc(value ? 'CAT.Macros.AC.Hit' : 'CAT.Macros.AC.Miss')}`;
    }
    if (!icon && !img && !tooltip) return;
    const attributions = getWorkflowProperty(workflow, 'acAttributions') ?? {};
    const attribution = {icon, img, tooltip};
    if (tooltip && !icon && !img) icon = 'fas fa-bolt';
    if (icon) attribution.cssClass = 'midi-qol-ac-icon-fa';
    else if (img) attribution.cssClass = 'midi-qol-ac-icon-img cat-ac-icon';
    attributions[hitData.target.uuid] ??= [];
    attributions[hitData.target.uuid].push(attribution);
    setWorkflowProperty(workflow, 'acAttributions', attributions);
}
/**
 * A spell duration that grows with cast level: one hour per unit at levels 1 and 2, eight hours at levels 3 and 4, and
 * 24 hours above. The unit count is the item's `system.duration.value`, and the result is capped at 24 hours.
 * @param {MidiQOL.Workflow} workflow  Workflow in progress.
 * @returns {number}                   Duration in seconds.
 * @example
 * // Cast at level 3 with a duration value of 1
 * workflowUtils.getScaledDuration(workflow); // 28800
 */
function getScaledDuration(workflow) {
    const castDurations = {1: 3600, 2: 3600, 3: 28800, 4: 28800};
    const seconds = castDurations[getCastLevel(workflow)] ?? 86400;
    return Math.min(seconds * workflow.item.system.duration.value, 86400);
}
/**
 * Use the item or activity a roll bonus is configured to roll. `config.rollItem` uses the whole item through
 * {@link completeItemUse}. Otherwise `config.rollActivity` names an activity id on the item, used through
 * {@link completeActivityUse} with `config.consume` as `consumeResources`.
 * @param {RollBonus} bonus                        Bonus carrying the source document or activity.
 * @param {object} config                          Generic macro config, supplying `rollItem`, `rollActivity` and
 *                                                 `consume`.
 * @param {Token5e[]} [targets]                    Targets the use is rolled against.
 * @returns {Promise<MidiQOL.Workflow|undefined>}  The workflow, or undefined when nothing was rolled.
 * @example
 * await workflowUtils.rollConfiguredSource(bonus, config, [token]);
 */
async function rollConfiguredSource(bonus, config, targets = []) {
    const item = bonus.document.documentName === 'Item' ? bonus.document : bonus.activity?.item;
    if (!item) return;
    if (config.rollItem) return await completeItemUse(item, targets);
    if (!config.rollActivity) return;
    const activity = item.system.activities.get(config.rollActivity);
    if (activity) return await completeActivityUse(activity, targets, {consumeResources: config.consume});
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
    specialItemUse,
    negateDamageItemDamage,
    modifyDamageAppliedFlat,
    setDamageItemDamage,
    isSustainedRoll,
    refundUse,
    restoreActionEconomy,
    setWorkflowProperty,
    getWorkflowProperty,
    addMacroConditions,
    getMacroConditions,
    getSaveSource,
    getConfigActivity,
    getPreTargetingTargets,
    bonusDamage,
    getDamageTypes,
    getDamageDealt,
    getCastLevel,
    getRange,
    setActivity,
    setItem,
    bonusAttack,
    addAttackRollPart,
    expandAttackCriticalRange,
    addTargetAC,
    removeAttackDisadvantage,
    rerollDamageDice,
    rerollKeepDamage,
    applyDamage,
    applyWorkflowDamage,
    updateTargets,
    removeTargets,
    preventZeroHP,
    grantRollModifier,
    bonusAC,
    changeHit,
    getScaledDuration,
    rollConfiguredSource,
    setNotSustainedRoll
};
