import {constants} from './lib/_module.mjs';
import * as events from './events/_module.mjs';
import {queryUtils} from './utilities/_module.mjs';
import dnd5e from './integration/dnd5e.mjs';
export function registerHooks() {
    // Sheet Rendering
    Hooks.on(constants.sheetHookNames.getHeaderControlsActiveEffectConfig, dnd5e.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsActorSheetV2, dnd5e.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsItemSheet5e, dnd5e.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsRegionConfig, dnd5e.appendHeaderControl);
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
    Hooks.on(constants.regionHooksNames.createRegion, events.regionEvents.createRegion);
    Hooks.on(constants.regionHooksNames.updateRegion, events.regionEvents.updateRegion);
    Hooks.on(constants.regionHooksNames.deleteRegion, events.regionEvents.deleteRegion);
    Hooks.on(constants.workflowHookNames.regionPlaced, events.regionEvents.createWorkflowRegion);
    if (queryUtils.isTheGM()) {
        // Movement Events
        Hooks.on(constants.movementHookNames.moveToken, events.movementEvents.moveToken);
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
    }
}