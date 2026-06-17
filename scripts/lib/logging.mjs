const logs = [];
const macroErrors = {};
const embeddedMacroErrors = {};
const registrationErrors = {};
function addEntry(type = 'DEBUG', message, {force = false} = {}) {
    logs.push('CAT | ' + type + ' > ' + message);
    if (force || game.settings.get('cat', 'displayDebugLogs')) console.log('%cCAT%c | ' + type + ' > ' + message, 'color: orange; font-weight: bold;', 'color: inherit;');
    if (logs.length > 100) logs.shift();
}
function addMacroError(trigger, error) {
    const key = trigger.macroClass.identifier + '-' + trigger.macroClass.source + '-' + trigger.macroClass.rules;
    macroErrors[key] ??= [];
    macroErrors[key].push({
        message: error.message,
        stack: error.stack,
        trigger,
        time: Date.now()
    });
    if (macroErrors[key].length > 10) macroErrors[key].shift();
    console.error('%cCAT%c | ERROR > Execution error in macro: ' + key + '\n', 'color: red; font-weight: bold;', 'color: inherit;', error);
}
function addEmbeddedMacroError(trigger, error) {
    const key = trigger.document.uuid;
    embeddedMacroErrors[key] ??= [];
    embeddedMacroErrors[key].push({
        message: error.message,
        stack: error.stack,
        trigger,
        time: Date.now(),
        name: trigger.macroClass.identifier
    });
    if (embeddedMacroErrors[key].length > 10) embeddedMacroErrors[key].shift();
    console.error('%cCAT%c | ERROR > Execution error in embedded macro: ' + key + '\n', 'color: red; font-weight: bold;', 'color: inherit;', error);
}
function addRegistrationError(data, type, message) {
    registrationErrors.push([JSON.stringify(data), message]);
    if (!registrationErrors[type]) registrationErrors[type] = [];
    console.error(data, message);
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
    registrationErrors,
    addEntry,
    addMacroError,
    addEmbeddedMacroError,
    addRegistrationError,
    group,
    groupEnd
};