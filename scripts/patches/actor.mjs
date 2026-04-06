import {checkEvents, saveEvents, skillEvents, toolEvents} from '../events/_module.mjs';
import {constants, Logging} from '../lib/_module.mjs';
import {genericUtils} from '../utilities/_module.mjs';
async function check(wrapped, config, dialog = {}, message = {}) {
    const event = config.event;
    const checkId = config.ability;
    const options = {};
    await checkEvents.situational(this, {config, dialog, message, options, checkId});
    await checkEvents.context(this, {config, dialog, message, options, checkId});
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
    let roll = await wrapped(config, dialog, {...message, create: false});
    roll = roll?.[0];
    if (!roll) return;
    const oldOptions = roll.options;
    await checkEvents.bonus(this, {config, dialog, message, options, checkId, roll});
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
    const event = config.event;
    const skillId = config.skill;
    const options = {};
    await skillEvents.situational(this, {config, dialog, message, skillId});
    await skillEvents.context(this, {config, dialog, message, skillId});
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
    let roll = await wrapped(config, dialog, {...message, create: false});
    roll = roll?.[0];
    if (!roll) return;
    const oldOptions = roll.options;
    await skillEvents.bonus(this, {config, dialog, message, skillId, roll});
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    if (message.create !== false) {
        messageData ??= {};
        let messageId = event?.target.closest('[data-message-id]')?.dataset.messageId;
        if (messageId) genericUtils.mergeObject(messageData, {'flags.dnd5e.originatingMessage': messageId});
        await roll.toMessage(messageData, {rollMode: roll.options?.rollMode ?? rollMode});
    }
    await skillEvents.post(this, {config, dialog, message, skillId, roll});
    return [roll];
}
async function save(wrapped, config, dialog = {}, message = {}) {
    const event = config.event;
    const saveId = config.ability;
    let activityUuid;
    let activity;
    if (config.midiOptions?.saveItemUuid) {
        activityUuid = game.messages.contents.toReversed().find(i => i.flags.dnd5e?.item?.uuid === config.midiOptions.saveItemUuid)?.flags.dnd5e.activity.uuid;
        if (activityUuid) genericUtils.setProperty(config, 'cat.activityUuid', activityUuid);
    }
    const options = {};
    await saveEvents.situational(this, {config, dialog, message, saveId});
    if (activityUuid) activity = await fromUuid(activityUuid);
    if (activity) await saveEvents.targetSituational(this, {config, dialog, message, saveId});
    await saveEvents.context(this, {config, dialog, message});
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
    let roll = await wrapped(config, dialog, {...message, create: false});
    roll = roll?.[0];
    if (!roll) return;
    const oldOptions = roll.options;
    await saveEvents.bonus(this, {config, dialog, message, saveId, roll});
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
    await saveEvents.post(this, {config, dialog, message, saveId, roll});
    return [roll];
}
async function tool(wrapped, config, dialog, message) {
    let options = {};
    let toolId = config.tool;
    await toolEvents.situational(this, {config, options, dialog, message, toolId});
    await toolEvents.context(this, {config, options, dialog, message, toolId});
    let roll = await wrapped(config, dialog, {...message, create: false});
    roll = roll?.[0];
    if (!roll) return;
    let oldOptions = roll.options;
    await toolEvents.bonus(this, {config, options, dialog, message, roll, toolId});
    if (roll.options) genericUtils.mergeObject(roll.options, oldOptions);
    await toolEvents.post(this, {config, options, dialog, message, roll, toolId});
    return [roll];
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