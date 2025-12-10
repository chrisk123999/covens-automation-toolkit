import {constants} from './lib.mjs';
export const api = {
    registerFnMacro: (...args) => constants.registeredMacros?.registerFnMacro(...args),
    registerFnMacros: (...args) => constants.registeredMacros?.registerFnMacros(...args)
};