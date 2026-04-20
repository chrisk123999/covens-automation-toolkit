import {constants} from './lib/_module.mjs';
export function buildApi() {
    const registeredMacros = constants.registeredMacros;
    const automations = constants.automations;
    console.log(automations);
    const registeredScales = constants.registeredScales;
    console.log(registeredScales);
    return {
        registerFnMacro: registeredMacros.registerFnMacro.bind(registeredMacros),
        registerFnMacros: registeredMacros.registerFnMacros.bind(registeredMacros),
        registerAutomation: automations.registerAutomation.bind(automations),
        registerAutomations: automations.registerAutomations.bind(automations),
        registerAutomationCompendium: automations.registerAutomationCompendium.bind(automations),
        registerAutomationModule: automations.registerAutomationModule.bind(automations),
        registerScale: registeredScales.registerScale.bind(registeredScales),
        registerScales: registeredScales.registerScales.bind(registeredScales)
    };
};