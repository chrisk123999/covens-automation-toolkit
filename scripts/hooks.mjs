import * as events from './events/_module.mjs';
import {activities, combat, conditionResistanceAndVulnerability, contextmenu, customMacros, effects, quickConditions, summon, troubleshooter, welcome} from './handlers/_module.mjs';
import {animationModules, dae, macroautocomplete, tidy5e, vae} from './integration/_modules.mjs';
import {constants} from './lib/_module.mjs';
import {dialogUtils, queryUtils} from './utilities/_module.mjs';
export function readyHooks() {
    // Handlers
    Hooks.on(constants.miscHookNames.itemUseActivitySelect, activities.hiddenActivities);
    Hooks.on('dnd5e.determineOccupiedGridSpaceDifficult', effects.difficultTerrain);
    Hooks.on(constants.miscHookNames.preUseActivity, summon.preUseActivity);
    Hooks.on('dnd5e.preSummon', summon.preSummon);
    Hooks.on(constants.workflowHookNames.rollFinished, summon.rollFinished);
    Hooks.on('deleteActiveEffect', summon.deleteActiveEffect);
    Hooks.on('preCreateMacro', customMacros.preCreateMacro);
    Hooks.on('createMacro', customMacros.changed);
    Hooks.on('updateMacro', customMacros.changed);
    Hooks.on('deleteMacro', customMacros.changed);
    Hooks.on('renderMacroConfig', customMacros.renderMacroConfig);
    // Integration
    Hooks.on(constants.miscHookNames.daeSetFieldData, dae.addFlags);
    Hooks.on(constants.miscHookNames.vaeCreateEffectButtons, vae.createEffectButton);
    Hooks.on(constants.miscHookNames.aaWorkflowStart, animationModules.workflowStart);
    Hooks.on(constants.miscHookNames.preUseActivity, animationModules.preUseActivity);
    // Sheet Rendering
    Hooks.on(constants.sheetHookNames.getHeaderControlsActiveEffectConfig, contextmenu.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsActivitySheet, contextmenu.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.renderActivitySheet, quickConditions.onRender);
    Hooks.on(constants.sheetHookNames.getHeaderControlsActorSheetV2, contextmenu.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsCompendium, contextmenu.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsItemSheet5e, contextmenu.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.renderItemSheet5e, activities.markHiddenActivities);
    Hooks.on(constants.sheetHookNames.renderBaseActorSheet, activities.markHiddenActivities);
    Hooks.on(constants.sheetHookNames.getHeaderControlsLevelConfig, contextmenu.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsRegionConfig, contextmenu.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsSceneConfig, contextmenu.appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsTokenConfig, contextmenu.appendHeaderControl);
    // Combat Rendering
    Hooks.on(constants.miscHookNames.renderCombatTracker, combat.renderCombatTracker);
    // Workflow Events
    Hooks.on(constants.workflowHookNames.preTargeting, events.workflowEvents.preTargeting);
    Hooks.on(constants.workflowHookNames.preItemRoll, events.workflowEvents.preItemRoll);
    Hooks.on(constants.workflowHookNames.preambleComplete, events.workflowEvents.preambleComplete);
    Hooks.on(constants.workflowHookNames.preAttackRollConfig, events.workflowEvents.attackRollConfig);
    Hooks.on(constants.workflowHookNames.preRollAttack, events.workflowEvents.preRollAttack);
    Hooks.on(constants.workflowHookNames.postAttackRoll, events.workflowEvents.postAttackRoll);
    Hooks.on(constants.workflowHookNames.attackRollComplete, events.workflowEvents.attackRollComplete);
    Hooks.on(constants.workflowHookNames.savesComplete, events.workflowEvents.savesComplete);
    Hooks.on(constants.workflowHookNames.damageRollComplete, events.workflowEvents.damageRollComplete);
    Hooks.on(constants.workflowHookNames.utilityRollComplete, events.workflowEvents.utilityRollComplete);
    Hooks.on(constants.workflowHookNames.preTargetDamageApplication, events.workflowEvents.preTargetDamageApplication);
    Hooks.on(constants.workflowHookNames.rollFinished, events.workflowEvents.rollFinished);
    // Condition Resistance / Vulnerability
    Hooks.on(constants.workflowHookNames.preTargetSave, conditionResistanceAndVulnerability);
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
    Hooks.on(constants.effectHookNames.suppressionChanged, events.effectEvents.suppressionChanged);
    // Region Events
    Hooks.on(constants.regionHooksNames.preCreateRegion, events.regionEvents.preCreateRegion);
    Hooks.on(constants.regionHooksNames.preUpdateRegion, events.regionEvents.preUpdateRegion);
    Hooks.on(constants.regionHooksNames.createRegion, events.regionEvents.createRegion);
    Hooks.on(constants.regionHooksNames.updateRegion, events.regionEvents.updateRegion);
    Hooks.on(constants.regionHooksNames.deleteRegion, events.regionEvents.deleteRegion);
    Hooks.on(constants.workflowHookNames.regionPlaced, events.regionEvents.createWorkflowRegion);
    // Movement Events
    Hooks.on(constants.movementHookNames.moveToken, events.movementEvents.moveToken);
    // Token Events
    Hooks.on(constants.tokenHookNames.preDeleteToken, events.tokenEvents.preDeleteToken);
    Hooks.on(constants.tokenHookNames.preCreateToken, events.tokenEvents.preCreateToken);
    // Actor Events
    Hooks.on(constants.actorHookNames.preDeleteActor, events.actorEvents.preDeleteActor);
    // Combat Events
    Hooks.on(constants.combatHookNames.preUpdateCombatant, events.combatEvents.preUpdateCombatant);
    Hooks.on(constants.combatHookNames.deleteCombat, combat => dialogUtils.clearRemembered(combat.id));
    // Item Events
    Hooks.on(constants.itemHookNames.preUpdateItem, events.itemEvents.preUpdateItem);
    if (queryUtils.isTheGM()) {
        // Combat Events
        Hooks.on(constants.combatHookNames.preUpdateCombat, events.combatEvents.preUpdateCombat);
        Hooks.on(constants.combatHookNames.deleteCombat, events.combatEvents.deleteCombat);
        Hooks.on(constants.combatHookNames.updateCombatant, events.combatEvents.updateCombatant);
        Hooks.once(constants.auraHookNames.catReady, events.auraEvents.catReady);
        Hooks.once(constants.auraHookNames.catReady, troubleshooter.startup);
        Hooks.on(constants.auraHookNames.canvasReady, events.auraEvents.canvasReady);
        Hooks.on(constants.auraHookNames.createScene, events.auraEvents.createScene);
        Hooks.on(constants.auraHookNames.deleteScene, events.auraEvents.deleteScene);
        Hooks.on(constants.auraHookNames.updateScene, events.auraEvents.updateScene);
        Hooks.on(constants.auraHookNames.updateCombat, events.auraEvents.updateCombat);
        Hooks.on(constants.auraHookNames.deleteCombat, events.auraEvents.combatChanged);
        Hooks.on(constants.auraHookNames.createToken, events.auraEvents.createToken);
        Hooks.on(constants.auraHookNames.updateToken, events.auraEvents.updateToken);
        Hooks.on(constants.auraHookNames.moveToken, events.auraEvents.moveToken);
        Hooks.on(constants.auraHookNames.deleteToken, events.auraEvents.deleteToken);
        Hooks.on(constants.auraHookNames.createItem, events.auraEvents.itemChanged);
        Hooks.on(constants.auraHookNames.updateItem, events.auraEvents.updateItem);
        Hooks.on(constants.auraHookNames.deleteItem, events.auraEvents.itemChanged);
        Hooks.on(constants.auraHookNames.createActiveEffect, events.auraEvents.effectChanged);
        Hooks.on(constants.auraHookNames.updateActiveEffect, events.auraEvents.effectChanged);
        Hooks.on(constants.auraHookNames.deleteActiveEffect, events.auraEvents.effectChanged);
        Hooks.on(constants.auraHookNames.updateActor, events.auraEvents.updateActor);
        Hooks.on(constants.auraHookNames.deleteActor, events.auraEvents.deleteActor);
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
    // Context Menus
    Hooks.on(constants.contextMenuHookNames.getActorContextOptions, contextmenu.appendEntryOption);
    Hooks.on(constants.contextMenuHookNames.getItemContextOptions, contextmenu.appendEntryOption);
    Hooks.on(constants.contextMenuHookNames.getSceneContextOptions, contextmenu.appendEntryOption);
    Hooks.on(constants.contextMenuHookNames.getCompendiumContextOptions, contextmenu.appendPackOption);
    Hooks.on(constants.contextMenuHookNames.getSheetItemContextOptions, contextmenu.appendDocumentOption);
    Hooks.on(constants.contextMenuHookNames.getSheetEffectContextOptions, contextmenu.appendDocumentOption);
    Hooks.on(constants.contextMenuHookNames.getSheetActivityContextOptions, contextmenu.appendActivityOption);
    // Handlers
    Hooks.on(constants.miscHookNames.applyActiveEffect, effects.applyActiveEffect);
    Hooks.on(constants.miscHookNames.renderChatMessageHTML, customMacros.renderWarningCard);
    Hooks.on(constants.miscHookNames.renderChatMessageHTML, troubleshooter.onRenderChatMessage);
    Hooks.on(constants.miscHookNames.renderChatMessageHTML, welcome.onRenderChatMessage);
    // Integration
    Hooks.on(constants.miscHookNames.daeModifySpecials, dae.modifySpecials);
    Hooks.once(constants.miscHookNames.tidyReady, tidy5e.headerControls);
    Hooks.on(constants.miscHookNames.renderTidy5eItemSheetQuadrone, tidy5e.renderTidySheet);
    Hooks.on(constants.miscHookNames.renderTidy5eItemSheetQuadrone, activities.markHiddenActivities);
    Hooks.on(constants.miscHookNames.renderTidy5eCharacterSheetQuadrone, tidy5e.renderTidySheet);
    Hooks.on(constants.miscHookNames.renderTidy5eCharacterSheetQuadrone, activities.markHiddenActivities);
    Hooks.on(constants.miscHookNames.renderTidy5eNpcSheetQuadrone, activities.markHiddenActivities);
    Hooks.on(constants.miscHookNames.tidyGetActivitiesForPlay, activities.tidyActivitiesForPlay);
    Hooks.once(constants.miscHookNames.macroautocomplete, macroautocomplete.registerCAT);
}
