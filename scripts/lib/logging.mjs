import {genericUtils, queryUtils} from '../utilities/_module.mjs';
const logs = [];
const macroErrors = {};
const macroWarnings = {};
const embeddedMacroErrors = {};
const registrationErrors = {};
const attributeErrors = {};
function isVerbose(log) {
    return ['DEBUG', 'INFO'].includes(log.type);
}
function addEntry(type = 'DEBUG', message, {force = false} = {}) {
    const entry = {type, message};
    logs.push(entry);
    if (force || game.settings.get('cat', 'displayDebugLogs')) console.log('%cCAT%c | ' + type + ' > ' + message, 'color: orange; font-weight: bold;', 'color: inherit;');
    if (logs.length > 100) logs.splice(Math.max(logs.findIndex(isVerbose), 0), 1);
    if (!isVerbose(entry)) Hooks.callAll('catLogEntry', entry);
}
function addMacroError(trigger, error) {
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
    console.error('%cCAT%c | ERROR > Execution error in macro: ' + key + '\n', 'color: red; font-weight: bold;', 'color: inherit;', error);
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
    addEntry('WARNING', key + ': ' + message + (user ? ' (' + user + ')' : ''));
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
    console.error('%cCAT%c | ERROR > Execution error in embedded macro: ' + key + '\n', 'color: red; font-weight: bold;', 'color: inherit;', error);
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
    console.error('%cCAT%c | ERROR > Validation error for ' + type + ' registry:\n', 'color: red; font-weight: bold;', 'color: inherit;', error.message);
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
    console.error('%cCAT%c | ERROR > Validation error on attribute from document: ' +  key + '\n', 'color: red; font-weight: bold;', 'color: inherit;', error.message);
}
function group(label = 'Group', {force = false} = {}) {
    if (force || game.settings.get('cat', 'displayDebugLogs')) {
        console.groupCollapsed('%cCAT%c | ' + label, 'color: orange; font-weight: bold;', 'color: inherit;');
    }
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
    addMacroError,
    addAttributeError,
    addEmbeddedMacroError,
    addRegistrationError,
    group,
    groupEnd,
    addMacroWarning
};
