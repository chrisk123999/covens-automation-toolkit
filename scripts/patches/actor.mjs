import {checkEvents, hitDieEvents, saveEvents, skillEvents, toolEvents} from '../events/_module.mjs';
import {genericUtils, workflowUtils} from '../utilities/_module.mjs';
import {optionalBonus} from '../mechanics/_module.mjs';
import {Logging} from '../lib/_module.mjs';
async function check(wrapped, config, dialog = {}, message = {}) {
    const options = {};
    const event = config.event;
    const checkId = config.ability;
    const activity = await fromUuid(workflowUtils.getWorkflowProperty(config, 'activityUuid'));
    if (activity) workflowUtils.setWorkflowProperty(config, 'activity', activity);
    await checkEvents.situational(this, {config, dialog, message, options, checkId});
    if (activity) await checkEvents.targetSituational(this, {config, dialog, message, options, checkId});
    await checkEvents.context(this, {config, dialog, message, options, checkId});
    const bonusSession = optionalBonus.rollSession();
    await optionalBonus.rollPreRoll('check', this, {config, dialog, message, options, checkId}, bonusSession);
    let overtimeActorUuid;
    if (event) {
        let target = event.target?.closest('.roll-link, [data-action="rollRequest"], [data-action="concentration"]');
        if (target?.dataset?.midiOvertimeActorUuid) {
            overtimeActorUuid = target.dataset.midiOvertimeActorUuid;
            options.rollMode = target.dataset.midiRollMode ?? target.dataset.rollMode ?? options.rollMode;
        }
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
        rollMode = message.rollMode ?? game.settings.get('core', 'rollMode');
    };
    Hooks.once('dnd5e.preRollAbilityCheck', messageDataFunc);
    if (Object.entries(options).length) config.rolls = [{options}];
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
    const oldOptions = roll.options;
    const bonusRoll = await checkEvents.bonus(this, {config, dialog, message, options, checkId, roll});
    if (bonusRoll instanceof Roll) roll = bonusRoll;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    const optional = await optionalBonus.rollResult('check', this, {config, dialog, message, options, checkId, roll}, bonusSession);
    if (optional instanceof Roll) roll = optional;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    if (message.create !== false) {
        messageData ??= {};
        const messageId = event?.target.closest('[data-message-id]')?.dataset.messageId;
        if (messageId) genericUtils.mergeObject(messageData, {'flags.dnd5e.originatingMessage': messageId});
        genericUtils.mergeObject(messageData, {flags: options.flags ?? {}});
        //genericUtils.setProperty(messageData, 'flags.midi-qol.lmrtfy.requestId', options.flags?.lmrtfy?.data?.requestId);
        messageData.template = 'modules/midi-qol/templates/roll-base.html';
        await roll.toMessage(messageData, {rollMode: roll.options?.rollMode ?? rollMode});
    }
    await checkEvents.post(this, {config, dialog, message, options, checkId, roll});
    return [roll];
}
async function skill(wrapped, config, dialog = {}, message = {}) {
    const options = {};
    const event = config.event;
    const skillId = config.skill;
    const activity = await fromUuid(workflowUtils.getWorkflowProperty(config, 'activityUuid'));
    if (activity) workflowUtils.setWorkflowProperty(config, 'activity', activity);
    await skillEvents.situational(this, {config, dialog, message, options, skillId});
    if (activity) await skillEvents.targetSituational(this, {config, dialog, message, options, skillId});
    await skillEvents.context(this, {config, dialog, message, options, skillId});
    const bonusSession = optionalBonus.rollSession();
    await optionalBonus.rollPreRoll('skill', this, {config, dialog, message, options, skillId}, bonusSession);
    let overtimeActorUuid;
    if (event) {
        let target = event.target?.closest('.roll-link, [data-action="rollRequest"], [data-action="concentration"]');
        if (target?.dataset?.midiOvertimeActorUuid) {
            overtimeActorUuid = target.dataset.midiOvertimeActorUuid;
            options.rollMode = target.dataset.midiRollMode ?? target.dataset.rollMode ?? options.rollMode;
        }
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
        rollMode = message.rollMode ?? game.settings.get('core', 'rollMode');
    };
    Hooks.once('dnd5e.preRollSkill', messageDataFunc);
    if (Object.entries(options).length) config.rolls = [{options}];
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
    const oldOptions = roll.options;
    const bonusRoll = await skillEvents.bonus(this, {config, dialog, message, options, skillId, roll});
    if (bonusRoll instanceof Roll) roll = bonusRoll;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    const optional = await optionalBonus.rollResult('skill', this, {config, dialog, message, options, skillId, roll}, bonusSession);
    if (optional instanceof Roll) roll = optional;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    if (message.create !== false) {
        messageData ??= {};
        let messageId = event?.target.closest('[data-message-id]')?.dataset.messageId;
        if (messageId) genericUtils.mergeObject(messageData, {'flags.dnd5e.originatingMessage': messageId});
        await roll.toMessage(messageData, {rollMode: roll.options?.rollMode ?? rollMode});
    }
    await skillEvents.post(this, {config, dialog, message, options, skillId, roll});
    return [roll];
}
async function save(wrapped, config, dialog = {}, message = {}) {
    const options = {};
    const event = config.event;
    const saveId = config.ability;
    const activity = await fromUuid(workflowUtils.getWorkflowProperty(config, 'activityUuid'));
    if (activity) workflowUtils.setWorkflowProperty(config, 'activity', activity);
    await saveEvents.situational(this, {config, dialog, message, options, saveId});
    if (activity) await saveEvents.targetSituational(this, {config, dialog, message, options, saveId});
    await saveEvents.context(this, {config, dialog, message, options, saveId});
    const bonusSession = optionalBonus.rollSession();
    await optionalBonus.rollPreRoll('save', this, {config, dialog, message, options, saveId}, bonusSession);
    let overtimeActorUuid;
    if (event) {
        let target = event.target?.closest('.roll-link, [data-action="rollRequest"], [data-action="concentration"]');
        if (target?.dataset?.midiOvertimeActorUuid) {
            overtimeActorUuid = target.dataset.midiOvertimeActorUuid;
            options.rollMode = target.dataset.midiRollMode ?? target.dataset.rollMode ?? options.rollMode;
        }
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
        rollMode = message.rollMode ?? game.settings.get('core', 'rollMode');
    };
    Hooks.once('dnd5e.preRollSavingThrow', messageDataFunc);
    if (Object.entries(options).length) config.rolls = [{options}];
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
    const oldOptions = roll.options;
    const bonusRoll = await saveEvents.bonus(this, {config, dialog, message, options, saveId, roll});
    if (bonusRoll instanceof Roll) roll = bonusRoll;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    const optional = await optionalBonus.rollResult('save', this, {config, dialog, message, options, saveId, roll}, bonusSession);
    if (optional instanceof Roll) roll = optional;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    if (message.create !== false) {
        messageData ??= {};
        let messageId = event?.target.closest('[data-message-id]')?.dataset.messageId;
        if (messageId) genericUtils.mergeObject(messageData, {'flags.dnd5e.originatingMessage': messageId});
        genericUtils.mergeObject(messageData, {flags: options.flags ?? {}});
        //genericUtils.setProperty(messageData, 'flags.midi-qol.lmrtfy.requestId', options.flags?.lmrtfy?.data?.requestId);
        messageData.template = 'modules/midi-qol/templates/roll-base.html';
        await roll.toMessage(messageData, {rollMode: roll.options?.rollMode ?? rollMode});
    }
    await saveEvents.post(this, {config, dialog, message, options, saveId, roll});
    return [roll];
}
async function tool(wrapped, config, dialog, message) {
    let options = {};
    let toolId = config.tool;
    const activity = await fromUuid(workflowUtils.getWorkflowProperty(config, 'activityUuid'));
    if (activity) workflowUtils.setWorkflowProperty(config, 'activity', activity);
    await toolEvents.situational(this, {config, options, dialog, message, toolId});
    if (activity) await toolEvents.targetSituational(this, {config, dialog, message, options, toolId});
    await toolEvents.context(this, {config, options, dialog, message, toolId});
    const bonusSession = optionalBonus.rollSession();
    await optionalBonus.rollPreRoll('tool', this, {config, dialog, message, options, toolId}, bonusSession);
    if (options.auto) dialog.configure = false;
    let roll = await wrapped(config, dialog, {...message, create: false});
    roll = roll?.[0];
    if (!roll) {
        await bonusSession.close();
        return;
    }
    let oldOptions = roll.options;
    const bonusRoll = await toolEvents.bonus(this, {config, options, dialog, message, roll, toolId});
    if (bonusRoll instanceof Roll) roll = bonusRoll;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    const optional = await optionalBonus.rollResult('tool', this, {config, dialog, message, options, roll, toolId}, bonusSession);
    if (optional instanceof Roll) roll = optional;
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    await toolEvents.post(this, {config, options, dialog, message, roll, toolId});
    return [roll];
}
async function rollHitDie(wrapped, config, dialog, message) {




    await hitDieEvents.situational(this, {config, dialog, message});
    await hitDieEvents.context(this, {config, dialog, message});
    let hookId;

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
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollAbilityCheck');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollAbilityCheck');
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollSkill');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollSkill');
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollSavingThrow');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollSavingThrow');
        Logging.addEntry('DEBUG', 'Unpatching: CONFIG.Actor.documentClass.prototype.rollToolCheck');
        libWrapper.unregister('cat', 'CONFIG.Actor.documentClass.prototype.rollToolCheck');
    }
}
export default {
    patch
};
