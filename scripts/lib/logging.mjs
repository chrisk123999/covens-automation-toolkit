import {genericUtils, queryUtils} from '../utilities/_module.mjs';
const logs = [];
const macroErrors = {};
const macroWarnings = {};
const embeddedMacroErrors = {};
const registrationErrors = {};
const attributeErrors = {};
const COLORS = {
    DEFAULT: 'orange',
    DEBUG: 'orange',
    ERROR: 'red',
    GROUP: 'orange',
    INFO: 'cyan',
    WARNING: 'yellow'
};
function log(type, message, ...args) {
    const msg = type === 'GROUP' ?
        '%cCAT%c | ' + message :
        '%cCAT%c | ' + type + ' > ' + message;
    const params = [msg, `color: ${COLORS[type] ?? COLORS.DEFAULT}; font-weight: bold;`, 'color: inherit;', ...args];
    switch (type) {
        case 'ERROR': return console.error(...params);
        case 'WARNING': return console.warn(...params);
        case 'GROUP': return console.groupCollapsed(...params);
        case 'DEBUG':
        case 'INFO':
        default: return console.log(...params);
    }
}
function isVerbose(log) {
    return ['DEBUG', 'INFO'].includes(log.type);
}
function addEntry(type = 'DEBUG', message, {force = false} = {}) {
    const entry = {type, message};
    logs.push(entry);
    if (force || game.settings.get('cat', 'displayDebugLogs')) log(type, message);
    if (logs.length > 100) logs.splice(Math.max(logs.findIndex(isVerbose), 0), 1);
    if (!isVerbose(entry)) Hooks.callAll('catLogEntry', entry);
}
function logMacroException(trigger, error) {
    const key = trigger.macroClass.identifier + '-' + trigger.macroClass.source + '-' + trigger.macroClass.rules;
    macroErrors[key] ??= [];
    macroErrors[key].push({
        message: error.message,
        stack: error.stack,
        trigger,
        time: Date.now(),
        source: trigger.macroClass.source,
        identifier: trigger.macroClass.identifier,
        rules: trigger.macroClass.rules
    });
    if (macroErrors[key].length > 10) macroErrors[key].shift();
    log('ERROR', 'Execution error in macro: ' + key + '\n', error);
}
function addMacroWarning(source, identifier, message, {notify, format, user} = {}) {
    message = _loc(message, format);
    const key = source + '-' + identifier;
    macroWarnings[key] ??= [];
    macroWarnings[key].push({
        message,
        source: source,
        identifier,
        user,
        time: Date.now()
    });
    addEntry('WARNING', key + ':\n' + message + (user ? ' (' + user + ')' : ''));
    if (notify && !user) genericUtils.notify(message, {type: notify === true ? 'warn' : notify, localize: false});
    const gm = queryUtils.gmUser();
    if (!user && gm && !gm.isSelf) queryUtils.query('macroWarning', gm, {source, identifier, message, user: game.user.name}).catch(() => {});
}
function addEmbeddedMacroError(trigger, error) {
    const key = trigger.document.uuid;
    embeddedMacroErrors[key] ??= [];
    embeddedMacroErrors[key].push({
        message: error.message,
        stack: error.stack,
        trigger,
        time: Date.now(),
        identifier: trigger.macroClass.identifier,
        source: trigger.macroClass.source,
        rules: trigger.macroClass.rules
    });
    if (embeddedMacroErrors[key].length > 10) embeddedMacroErrors[key].shift();
    log('ERROR', 'Execution error in embedded macro: ' + key + '\n', error);
}
function convertValidationError(error) {
    const v = error instanceof foundry.data.validation.DataModelValidationError;
    if (!v) return error;
    error.message = error.toString();
    return error;
}
function addRegistrationError(data, type, error) {
    error = convertValidationError(error);
    registrationErrors[type] ??= [];
    registrationErrors[type].push({
        message: error.message,
        stack: error.stack,
        data: JSON.stringify(data),
        time: Date.now()
    });
    log('ERROR', 'Validation error for ' + type + ' registry:\n', error.message);
}
function addAttributeError(document, attribute, error) {
    error = convertValidationError(error);
    const key = document?.uuid ?? 'unparented';
    attributeErrors[key] ??= [];
    attributeErrors[key].push({
        message: error.message,
        stack: error.stack,
        document: JSON.stringify(document ?? 'unparented'),
        attribute: JSON.stringify(attribute),
        time: Date.now()
    });
    if (attributeErrors[key].length > 10) attributeErrors[key].shift();
    log('ERROR', 'Validation error on attribute from document: ' +  key + '\n', error.message);
}
function group(label = 'Group', {force = false} = {}) {
    if (force || game.settings.get('cat', 'displayDebugLogs')) log('GROUP', label);
}
function groupEnd({force = false} = {}) {
    if (force || game.settings.get('cat', 'displayDebugLogs')) console.groupEnd();
}
export default {
    logs,
    macroErrors,
    attributeErrors,
    macroWarnings,
    registrationErrors,
    embeddedMacroErrors,
    addEntry,
    isVerbose,
    logMacroException,
    addAttributeError,
    addEmbeddedMacroError,
    addRegistrationError,
    group,
    groupEnd,
    addMacroWarning,
    log
};
