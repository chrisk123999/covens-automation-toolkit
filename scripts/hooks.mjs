import {constants} from './lib/_module.mjs';
import * as events from './events/_module.mjs';
import {queryUtils} from './utilities/_module.mjs';
import {titlebar, activities, effects} from './handlers/_module.mjs';
import {dae, vae} from './integration/_modules.mjs';
export function readyHooks() {
    // Handlers
    Hooks.on(constants.miscHookNames.itemUseActivitySelect, activities.hiddenActivities);
    // Integration
    Hooks.on(constants.miscHookNames.daeSetFieldData, dae.addFlags);
    Hooks.on(constants.miscHookNames.vaeCreateEffectButtons, vae.createEffectButton);
    // Sheet Rendering
    Hooks.on(constants.sheetHookNames.getHeaderControlsActiveEffectConfig, titlebar.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsActivitySheet, titlebar.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsActorSheetV2, titlebar.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsCompendium, titlebar.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsItemSheet5e, titlebar.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsLevelConfig, titlebar.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsRegionConfig, titlebar.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsSceneConfig, titlebar.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsTokenConfig, titlebar.appendHeaderControl);
    // Workflow Events
    Hooks.on(constants.workflowHookNames.preTargeting, events.workflowEvents.preTargeting);
    Hooks.on(constants.workflowHookNames.preItemRoll, events.workflowEvents.preItemRoll);
    Hooks.on(constants.workflowHookNames.preambleComplete, events.workflowEvents.preambleComplete);
    Hooks.on(constants.workflowHookNames.preAttackRollConfig, events.workflowEvents.attackRollConfig);
    Hooks.on(constants.workflowHookNames.postAttackRoll, events.workflowEvents.postAttackRoll);
    Hooks.on(constants.workflowHookNames.attackRollComplete, events.workflowEvents.attackRollComplete);
    Hooks.on(constants.workflowHookNames.savesComplete, events.workflowEvents.savesComplete);
    Hooks.on(constants.workflowHookNames.damageRollComplete, events.workflowEvents.damageRollComplete);
    Hooks.on(constants.workflowHookNames.utilityRollComplete, events.workflowEvents.utilityRollComplete);
    Hooks.on(constants.workflowHookNames.preTargetDamageApplication, events.workflowEvents.preTargetDamageApplication);
    Hooks.on(constants.workflowHookNames.rollFinished, events.workflowEvents.rollFinished);
    // Rest Events
    Hooks.on(constants.restHookNames.restCompleted, events.restEvents.restCompleted);
    // Item Events
    Hooks.on(constants.itemHookNames.munched, events.itemEvents.actorMunched);
    // Effect Events
    Hooks.on(constants.effectHookNames.preCreateActiveEffect, events.effectEvents.preCreateActiveEffect);
    Hooks.on(constants.effectHookNames.preDeleteActiveEffect, events.effectEvents.preDeleteActiveEffect);
    Hooks.on(constants.effectHookNames.preUpdateActiveEffect, events.effectEvents.preUpdateActiveEffect);
    Hooks.on(constants.effectHookNames.createActiveEffect, events.effectEvents.createActiveEffect);
    Hooks.on(constants.effectHookNames.deleteActiveEffect, events.effectEvents.deleteActiveEffect);
    Hooks.on(constants.effectHookNames.updateActiveEffect, events.effectEvents.updateActiveEffect);
    // Region Events
    Hooks.on(constants.regionHooksNames.preCreateRegion, events.regionEvents.preCreateRegion);
    Hooks.on(constants.regionHooksNames.preUpdateRegion, events.regionEvents.preUpdateRegion);
    Hooks.on(constants.regionHooksNames.createRegion, events.regionEvents.createRegion);
    Hooks.on(constants.regionHooksNames.updateRegion, events.regionEvents.updateRegion);
    Hooks.on(constants.regionHooksNames.deleteRegion, events.regionEvents.deleteRegion);
    Hooks.on(constants.workflowHookNames.regionPlaced, events.regionEvents.createWorkflowRegion);
    // Movement Events
    Hooks.on(constants.movementHookNames.moveToken, events.movementEvents.moveToken);
    if (queryUtils.isTheGM()) {
        // Combat Events
        Hooks.on(constants.combatHookNames.updateCombat, events.combatEvents.updateCombat);
        Hooks.on(constants.combatHookNames.combatStart, events.combatEvents.combatStart);
        Hooks.on(constants.combatHookNames.deleteCombat, events.combatEvents.deleteCombat);
        // Aura Events
        Hooks.on(constants.auraHookNames.createToken, events.auraEvents.createToken);
        Hooks.on(constants.auraHookNames.deleteToken, events.auraEvents.deleteToken);
        Hooks.on(constants.auraHookNames.canvasReady, events.auraEvents.canvasReady);
        // Item Events
        Hooks.on(constants.itemHookNames.createItem, events.itemEvents.createItem);
        Hooks.on(constants.itemHookNames.deleteItem, events.itemEvents.deleteItem);
        Hooks.on(constants.itemHookNames.updateItem, events.itemEvents.updateItem);
        // Time Events
        Hooks.on(constants.timeHookNames.updateWorldTime, events.timeEvents.updateWorldTime);
        // Actor Events
        Hooks.on(constants.actorHookNames.updateActor, events.actorEvents.updateActor);
    }
}
export function initHooks() {
    // Handlers
    Hooks.on(constants.miscHookNames.applyActiveEffect, effects.applyActiveEffect);
    // Integration
    Hooks.on(constants.miscHookNames.daeModifySpecials, dae.modifySpecials);
}