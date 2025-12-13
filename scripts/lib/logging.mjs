const logs = [];
const macroErrors = [];
const userErrors = [];
const registrationErrors = [];
const automationsErrors = [];
function addEntry(type = 'DEBUG', message) {
    logs.push('CAT | ' + type + ' > ' + message);
    // 'CAT' in orange, rest default, using string concatenation
    if (game.settings.get('cat', 'displayDebugLogs')) console.log('%cCAT%c | ' + type + ' > ' + message, 'color: orange; font-weight: bold;', 'color: inherit;');
    if (logs.length > 100) logs.shift();
}
function addMacroError(message) {
    console.error(message);
    macroErrors.push(message);
    if (macroErrors.length > 10) macroErrors.shift();
}
function addUserError(message) {
    console.warn(message);
    userErrors.push(message);
    if (userErrors.length > 25) userErrors.shift();
}
function addRegistrationError(data, message) {
    registrationErrors.push([JSON.stringify(data), message]);
    console.error(data, message);
}
function addAutomationError(data, message) {
    automationsErrors.push([JSON.stringify(data), message]);
    console.error(data, message);
}
export const Logging = {
    logs,
    macroErrors,
    userErrors,
    registrationErrors,
    addEntry,
    addMacroError,
    addUserError,
    addRegistrationError,
    addAutomationError
};