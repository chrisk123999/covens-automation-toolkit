import {checkEvents, hitDieEvents, saveEvents, skillEvents, toolEvents} from '../events/_module.mjs';
import {genericUtils, workflowUtils} from '../utilities/_module.mjs';
import {optionalBonus} from '../mechanics/_module.mjs';
import {Logging} from '../lib/_module.mjs';
function overtimeRequest(event) {
    const element = event?.target instanceof HTMLElement ? event.target : undefined;
    const link = element?.closest('.roll-link, [data-action="rollRequest"], [data-action="concentration"]');
    if (link?.dataset.midiOvertimeActorUuid) return {actorUuid: link.dataset.midiOvertimeActorUuid, rollMode: link.dataset.midiRollMode ?? link.dataset.rollMode};
    const messageId = element?.closest('[data-message-id]')?.dataset.messageId;
    const flags = messageId ? game.messages.get(messageId)?.flags['midi-qol'] : undefined;
    return {actorUuid: flags?.overtimeActorUuid, rollMode: flags?.overtimeRollMode};
}
function mergeRollOptions(config, options) {
    if (!Object.keys(options).length) return;
    const [firstRoll = {}, ...otherRolls] = config.rolls ?? [];
    config.rolls = [genericUtils.mergeObject(firstRoll, {options}, {inplace: false}), ...otherRolls];
}
async function check(wrapped, config, dialog = {}, message = {}) {
    if (!this.system.abilities) return wrapped(config, dialog, message);
    const options = {};
    if (config.ability === 'spellcasting') config = {...config, ability: this.spellcastingAbility};
    const event = config.event;
    const checkId = config.ability;
    const activity = await workflowUtils.getConfigActivity(config);
    if (activity) workflowUtils.setWorkflowProperty(config, 'activity', activity);
    await checkEvents.situational(this, {config, dialog, message, options, checkId});
    if (activity) await checkEvents.targetSituational(this, {config, dialog, message, options, checkId});
    await checkEvents.context(this, {config, dialog, message, options, checkId});
    const bonusSession = optionalBonus.rollSession();
    await optionalBonus.rollPreRoll('check', this, {config, dialog, message, options, checkId}, bonusSession);
    let overtimeActorUuid;
    const overtime = overtimeRequest(event);
    if (overtime.actorUuid) {
        overtimeActorUuid = overtime.actorUuid;
        options.rollMode = overtime.rollMode ?? options.rollMode;
    }
    let messageData;
    let rollMode;
    const messageDataFunc = (config, dialog, message) => {
        let actor = config.subject;
        let checkIdInternal = config.ability;
        if (actor.uuid !== this.uuid || checkIdInternal !== checkId) {
            Hooks.once('dnd5e.preRollAbilityCheck', messageDataFunc);
            return;
        }
        messageData = message.data;
        if (overtimeActorUuid) messageData['flags.midi-qol.overtimeActorUuid'] = overtimeActorUuid;
        rollMode = message.rollMode ?? game.settings.get('core', 'messageMode');
    };
    Hooks.once('dnd5e.preRollAbilityCheck', messageDataFunc);
    mergeRollOptions(config, options);
    config = {
        ...config,
        ...options
    };
    if (options.auto) dialog.configure = false;
    let roll = await wrapped(config, dialog, {...message, create: false});
    roll = roll?.[0];
    if (!roll) {
        await bonusSession.close();
        return;
    }
    roll.options.target ??= config.midiOptions?.target;
    const oldOptions = roll.options;
    const optional = await optionalBonus.rollResult('check', this, {config, dialog, message, options, checkId, roll}, bonusSession);
    if (optional instanceof Roll) roll = optional;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    const bonusRoll = await checkEvents.bonus(this, {config, dialog, message, options, checkId, roll});
    if (bonusRoll instanceof Roll) roll = bonusRoll;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    if (message.create !== false) {
        messageData ??= {};
        genericUtils.mergeObject(messageData, {flags: options.flags ?? {}});
        await roll.constructor.buildPost([roll], {event}, {data: messageData, rollMode: roll.options?.rollMode ?? rollMode});
    }
    await checkEvents.post(this, {config, dialog, message, options, checkId, roll});
    return [roll];
}
async function skill(wrapped, config, dialog = {}, message = {}) {
    if (!this.system.abilities) return wrapped(config, dialog, message);
    const options = {};
    const event = config.event;
    const skillId = config.skill;
    config.ability ??= this.system.skills?.[skillId]?.ability ?? CONFIG.DND5E.skills[skillId]?.ability;
    const activity = await workflowUtils.getConfigActivity(config);
    if (activity) workflowUtils.setWorkflowProperty(config, 'activity', activity);
    await skillEvents.situational(this, {config, dialog, message, options, skillId});
    if (activity) await skillEvents.targetSituational(this, {config, dialog, message, options, skillId});
    await skillEvents.context(this, {config, dialog, message, options, skillId});
    const bonusSession = optionalBonus.rollSession();
    await optionalBonus.rollPreRoll('skill', this, {config, dialog, message, options, skillId}, bonusSession);
    let overtimeActorUuid;
    const overtime = overtimeRequest(event);
    if (overtime.actorUuid) {
        overtimeActorUuid = overtime.actorUuid;
        options.rollMode = overtime.rollMode ?? options.rollMode;
    }
    let messageData;
    let rollMode;
    let messageDataFunc = (config, dialog, message) => {
        const actor = config.subject;
        const skillIdInternal = config.skill;
        if (actor.uuid !== this.uuid || skillIdInternal !== skillId) {
            Hooks.once('dnd5e.preRollSkill', messageDataFunc);
            return;
        }
        messageData = message.data;
        if (overtimeActorUuid) messageData['flags.midi-qol.overtimeActorUuid'] = overtimeActorUuid;
        rollMode = message.rollMode ?? game.settings.get('core', 'messageMode');
    };
    Hooks.once('dnd5e.preRollSkill', messageDataFunc);
    mergeRollOptions(config, options);
    config = {
        ...config,
        ...options
    };
    if (options.auto) dialog.configure = false;
    let roll = await wrapped(config, dialog, {...message, create: false});
    roll = roll?.[0];
    if (!roll) {
        await bonusSession.close();
        return;
    }
    roll.options.target ??= config.midiOptions?.target;
    const oldOptions = roll.options;
    const optional = await optionalBonus.rollResult('skill', this, {config, dialog, message, options, skillId, roll}, bonusSession);
    if (optional instanceof Roll) roll = optional;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    const bonusRoll = await skillEvents.bonus(this, {config, dialog, message, options, skillId, roll});
    if (bonusRoll instanceof Roll) roll = bonusRoll;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    if (message.create !== false) {
        messageData ??= {};
        await roll.constructor.buildPost([roll], {event}, {data: messageData, rollMode: roll.options?.rollMode ?? rollMode});
    }
    await skillEvents.post(this, {config, dialog, message, options, skillId, roll});
    return [roll];
}
async function save(wrapped, config, dialog = {}, message = {}) {
    if (!this.system.abilities) return wrapped(config, dialog, message);
    const options = {};
    if (config.ability === 'spellcasting') config = {...config, ability: this.spellcastingAbility};
    const event = config.event;
    const saveId = config.ability;
    const activity = await workflowUtils.getConfigActivity(config);
    if (activity) workflowUtils.setWorkflowProperty(config, 'activity', activity);
    await saveEvents.situational(this, {config, dialog, message, options, saveId});
    if (activity) await saveEvents.targetSituational(this, {config, dialog, message, options, saveId});
    await saveEvents.context(this, {config, dialog, message, options, saveId});
    const bonusSession = optionalBonus.rollSession();
    await optionalBonus.rollPreRoll('save', this, {config, dialog, message, options, saveId}, bonusSession);
    let overtimeActorUuid;
    const overtime = overtimeRequest(event);
    if (overtime.actorUuid) {
        overtimeActorUuid = overtime.actorUuid;
        options.rollMode = overtime.rollMode ?? options.rollMode;
    }
    let messageData;
    let rollMode;
    const messageDataFunc = (config, dialog, message) => {
        let actor = config.subject;
        let saveIdInternal = config.ability;
        if (actor.uuid !== this.uuid || saveIdInternal !== saveId) {
            Hooks.once('dnd5e.preRollSavingThrow', messageDataFunc);
            return;
        }
        messageData = message.data;
        if (overtimeActorUuid) messageData['flags.midi-qol.overtimeActorUuid'] = overtimeActorUuid;
        rollMode = message.rollMode ?? game.settings.get('core', 'messageMode');
    };
    Hooks.once('dnd5e.preRollSavingThrow', messageDataFunc);
    mergeRollOptions(config, options);
    config = {
        ...config,
        ...options
    };
    if (options.auto) dialog.configure = false;
    let roll = await wrapped(config, dialog, {...message, create: false});
    roll = roll?.[0];
    if (!roll) {
        await bonusSession.close();
        return;
    }
    roll.options.target ??= config.midiOptions?.target;
    const oldOptions = roll.options;
    const optional = await optionalBonus.rollResult('save', this, {config, dialog, message, options, saveId, roll}, bonusSession);
    if (optional instanceof Roll) roll = optional;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    const bonusRoll = await saveEvents.bonus(this, {config, dialog, message, options, saveId, roll});
    if (bonusRoll instanceof Roll) roll = bonusRoll;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    if (message.create !== false) {
        messageData ??= {};
        genericUtils.mergeObject(messageData, {flags: options.flags ?? {}});
        await roll.constructor.buildPost([roll], {event}, {data: messageData, rollMode: roll.options?.rollMode ?? rollMode});
    }
    await saveEvents.post(this, {config, dialog, message, options, saveId, roll});
    return [roll];
}
async function tool(wrapped, config, dialog = {}, message = {}) {
    if (!this.system.abilities) return wrapped(config, dialog, message);
    let options = {};
    let toolId = config.tool;
    const activity = await workflowUtils.getConfigActivity(config);
    if (activity) workflowUtils.setWorkflowProperty(config, 'activity', activity);
    await toolEvents.situational(this, {config, options, dialog, message, toolId});
    if (activity) await toolEvents.targetSituational(this, {config, dialog, message, options, toolId});
    await toolEvents.context(this, {config, options, dialog, message, toolId});
    const bonusSession = optionalBonus.rollSession();
    await optionalBonus.rollPreRoll('tool', this, {config, dialog, message, options, toolId}, bonusSession);
    let messageData;
    let rollMode;
    const messageDataFunc = (config, dialog, message) => {
        if (config.subject?.uuid !== this.uuid || config.tool !== toolId) {
            Hooks.once('dnd5e.preRollTool', messageDataFunc);
            return;
        }
        messageData = message.data;
        rollMode = message.rollMode ?? game.settings.get('core', 'messageMode');
    };
    Hooks.once('dnd5e.preRollTool', messageDataFunc);
    mergeRollOptions(config, options);
    config = {
        ...config,
        ...options
    };
    if (options.auto) dialog.configure = false;
    let roll = await wrapped(config, dialog, {...message, create: false});
    roll = roll?.[0];
    if (!roll) {
        await bonusSession.close();
        return;
    }
    roll.options.target ??= config.midiOptions?.target;
    let oldOptions = roll.options;
    const optional = await optionalBonus.rollResult('tool', this, {config, dialog, message, options, roll, toolId}, bonusSession);
    if (optional instanceof Roll) roll = optional;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    const bonusRoll = await toolEvents.bonus(this, {config, options, dialog, message, roll, toolId});
    if (bonusRoll instanceof Roll) roll = bonusRoll;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    if (message.create !== false) {
        messageData ??= {};
        genericUtils.mergeObject(messageData, {flags: options.flags ?? {}});
        await roll.constructor.buildPost([roll], {event: config.event}, {data: messageData, rollMode: roll.options?.rollMode ?? rollMode});
    }
    await toolEvents.post(this, {config, options, dialog, message, roll, toolId});
    return [roll];
}
function getHitDieClass(actor, denomination) {
    if (denomination) return actor.system.attributes.hd.classes.find(cls => cls.system.hd.denomination === denomination && cls.system.hd.value);
    return actor.system.attributes.hd.classes.find(cls => cls.system.hd.value);
}
async function rollHitDie(wrapped, config = {}, dialog = {}, message = {}) {
    const hd = this.system.attributes?.hd;
    if (!hd) return wrapped(config, dialog, message);
    const cls = this.system.isNPC ? null : getHitDieClass(this, config.denomination);
    if (this.system.isNPC ? !hd.value : !cls) return wrapped(config, dialog, message);
    config.denomination = this.system.isNPC ? 'd' + hd.denomination : cls.system.hd.denomination;
    const options = {};
    await hitDieEvents.situational(this, {config, dialog, message, options});
    const minimum = options.minimum ?? (game.settings.get('dnd5e', 'rulesVersion') === 'modern' ? 1 : 0);
    const die = options.maximize ? config.denomination.slice(1) : '1' + config.denomination;
    let formula = 'max(' + minimum + ', ' + [die, '@abilities.con.mod', ...(options.parts ?? [])].join(' + ') + ')';
    if (options.multiplier) formula = '(' + formula + ') * ' + options.multiplier;
    const rollConfig = genericUtils.deepClone(config);
    rollConfig.hookNames = [...(config.hookNames ?? []), 'hitDie'];
    rollConfig.rolls = [{parts: [formula], data: this.getRollData()}].concat(config.rolls ?? []);
    rollConfig.subject = this;
    const dialogConfig = genericUtils.mergeObject({configure: false}, dialog);
    const flavor = _loc('DND5E.HitDiceRoll');
    const messageConfig = genericUtils.mergeObject({
        rollMode: CONFIG.Dice.BasicRoll.getMessageMode(),
        data: {
            speaker: ChatMessage.implementation.getSpeaker({actor: this}),
            flavor,
            title: flavor + ': ' + this.name,
            type: 'hitDie'
        }
    }, message);
    const rolls = await CONFIG.Dice.BasicRoll.buildConfigure(rollConfig, dialogConfig, messageConfig);
    if (!rolls.length) return null;
    await CONFIG.Dice.BasicRoll.buildEvaluate(rolls, rollConfig, messageConfig);
    const bonusRoll = await hitDieEvents.bonus(this, {config, dialog, message, options, roll: rolls[0]});
    if (bonusRoll instanceof Roll) rolls[0] = bonusRoll;
    await CONFIG.Dice.BasicRoll.buildPost(rolls, rollConfig, messageConfig);
    const updates = {actor: {}, class: {}};
    if (rollConfig.modifyHitDice !== false) {
        if (cls) updates.class['system.hd.spent'] = cls.system.hd.spent + 1;
        else updates.actor['system.attributes.hd.spent'] = hd.spent + 1;
    }
    if (rollConfig.modifyHitPoints !== false) {
        const hp = this.system.attributes.hp;
        const total = rolls.reduce((sum, roll) => sum + roll.total, 0);
        const calculated = this.calculateDamage([{type: 'healing', value: total}], {invertHealing: false});
        updates.actor['system.attributes.hp.value'] = hp.value + Math.min(Math.max(0, hp.effectiveMax) - hp.value, calculated ? calculated.amount : total);
    }
    if (Hooks.call('dnd5e.rollHitDie', rolls, {subject: this, updates}) === false) return rolls;
    if (Hooks.call('dnd5e.rollHitDieV2', rolls, {subject: this, updates}) === false) return rolls;
    if (!foundry.utils.isEmpty(updates.actor)) await this.update(updates.actor);
    if (!foundry.utils.isEmpty(updates.class)) await cls.update(updates.class);
    Hooks.callAll('dnd5e.postRollHitDie', rolls, {subject: this});
    await hitDieEvents.post(this, {config, dialog, message, options, roll: rolls[0]});
    return rolls;
}

function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: CONFIG.Actor.documentClass.prototype.rollAbilityCheck');
        libWrapper.register('cat', 'CONFIG.Actor.documentClass.prototype.rollAbilityCheck', check, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: CONFIG.Actor.documentClass.prototype.rollSkill');
        libWrapper.register('cat', 'CONFIG.Actor.documentClass.prototype.rollSkill', skill, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: CONFIG.Actor.documentClass.prototype.rollSavingThrow');
        libWrapper.register('cat', 'CONFIG.Actor.documentClass.prototype.rollSavingThrow', save, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: CONFIG.Actor.documentClass.prototype.rollToolCheck');
        libWrapper.register('cat', 'CONFIG.Actor.documentClass.prototype.rollToolCheck', tool, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: CONFIG.Actor.documentClass.prototype.rollHitDie');
        libWrapper.register('cat', 'CONFIG.Actor.documentClass.prototype.rollHitDie', rollHitDie, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollAbilityCheck');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollAbilityCheck');
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollSkill');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollSkill');
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollSavingThrow');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollSavingThrow');
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollToolCheck');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollToolCheck');
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollHitDie');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollHitDie');
    }
}
export default {
    patch
};
