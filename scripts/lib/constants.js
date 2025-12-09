import {Macros} from './macros.js';
let _registeredMacros;
function init() {
    _registeredMacros = new Macros.RegisteredMacros();
}
function registeredMacros() {
    return _registeredMacros;
}
export const constants = {
    registeredMacros,
    init
};