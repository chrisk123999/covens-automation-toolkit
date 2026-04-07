import {constants} from './lib/_module.mjs';
export function buildApi() {
    const registeredMacros = constants.registeredMacros;
    const automations = constants.automations;
    return {
        registerFnMacro: registeredMacros.registerFnMacro.bind(registeredMacros),
        registerFnMacros: registeredMacros.registerFnMacros.bind(registeredMacros),
        registerAutomation: automations.registerAutomation.bind(automations),
        registerAutomations: automations.registerAutomations.bind(automations),
        registerAutomationCompendium: automations.registerAutomationCompendium.bind(automations),
        registerAutomationModule: automations.registerAutomationModule.bind(automations)
    };
};