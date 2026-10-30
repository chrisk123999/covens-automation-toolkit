import {constants} from './lib/_module.mjs';
export function buildApi(handlers) {
    const registeredMacros = constants.macros;
    const automations = constants.automations;
    const registeredScales = constants.scales;
    const registeredAnimations = constants.animations;
    const troubleshooter = constants.troubleshooter;
    return {
        registerFnMacro: registeredMacros.registerFnMacro.bind(registeredMacros),
        registerFnMacros: registeredMacros.registerFnMacros.bind(registeredMacros),
        registerAutomation: automations.registerAutomation.bind(automations),
        registerAutomations: automations.registerAutomations.bind(automations),
        registerAutomationCompendium: automations.registerAutomationCompendium.bind(automations),
        registerAutomationModule: automations.registerAutomationModule.bind(automations),
        registerSourceName: automations.registerSourceName.bind(automations),
        registerScale: registeredScales.registerScale.bind(registeredScales),
        registerScales: registeredScales.registerScales.bind(registeredScales),
        registerAnimation: registeredAnimations.registerAnimation.bind(registeredAnimations),
        registerAnimations: registeredAnimations.registerAnimations.bind(registeredAnimations),
        registerTroubleshooterCheck: troubleshooter.registerTroubleshooterCheck.bind(troubleshooter),
        registerTroubleshooterChecks: troubleshooter.registerTroubleshooterChecks.bind(troubleshooter),
        registerMastery: handlers.weapon.registerMastery,
        postWelcome: handlers.welcome.postWelcome
    };
};
