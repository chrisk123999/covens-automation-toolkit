import {Macros} from './macros.mjs';
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