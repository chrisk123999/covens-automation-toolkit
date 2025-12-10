const logs = [];
const macroErrors = [];
const userErrors = [];
const registrationErrors = [];
function addEntry(type = 'DEBUG', message) {
    logs.push('CAT | ' + type + ': ' + message);
    console.log(logs[logs.length - 1]); // Change this check a setting for displaying logs.
    if (logs.length > 50) logs.shift();
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
export const Logging = {
    logs,
    macroErrors,
    userErrors,
    registrationErrors,
    addEntry,
    addMacroError,
    addUserError,
    addRegistrationError
};