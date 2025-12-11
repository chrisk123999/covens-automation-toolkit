import {constants} from './lib.mjs';
export const api = {
    registerFnMacro: (...args) => constants.registeredMacros?.registerFnMacro(...args),
    registerFnMacros: (...args) => constants.registeredMacros?.registerFnMacros(...args),
    registerAutomation: (...args) => constants.automations?.registerAutomation(...args),
    registerAutomations: (...args) => constants.automations?.registerAutomations(...args),
    registerAutomationCompendium: (...args) => constants.automations?.registerCompendium(...args),
    registerAutomationModule: (...args) => constants.automations?.registerModule(...args)
};