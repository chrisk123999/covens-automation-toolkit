import {constants} from './lib/_module.mjs';
import * as events from './events/_module.mjs';
import {documentUtils, queryUtils} from './utilities/_module.mjs';
import * as applications from './applications/_module.mjs';
export function registerHooks() {
    // Sheet Rendering
    Hooks.on(constants.sheetHookNames.getHeaderControlsActiveEffectConfig, appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsActorSheetV2, appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsItemSheet5e, appendHeaderControl);
    Hooks.on(constants.sheetHookNames.getHeaderControlsRegionConfig, appendHeaderControl);
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

// TODO: where should we put this
function appendHeaderControl(app, controls) {
    if (app.classList.contains('tidy5e-sheet')) return;
    if (app instanceof foundry.applications.sidebar.apps.Compendium) {
        const validTypes = ['ActiveEffect', 'Actor', 'Item'];
        if (!validTypes.includes(app.collection.metadata.type)) return;
    }
    const embeddedOnlyTypes = ['Region'];
    const documentType = app.document?.documentName;
    const headerLabel = _loc('CAT.MEDKIT.HeaderLabel');
    if (embeddedOnlyTypes.includes(documentType)) {
        controls.push({
            label: headerLabel,
            icon: 'fa-solid fa-kit-medical',
            onClick: () => {} // TODO: Embedded Macros
        });
        return;
    }
    controls.push({
        label: headerLabel,
        icon: 'fa-solid fa-kit-medical',
        onClick: () => {
            if (app instanceof foundry.applications.sidebar.apps.Compendium) {
                // TODO: Compendium Medkit
            } else {
                // TODO: This properly
                if (documentType === 'Item') new applications.ItemMedkit({document: app.document}).render({force: true});
            }
        }
    });
    // TODO: See whether we can color-code some other way
    if (documentType === 'Item') {
        setTimeout(async () => {
            const parentWindow = foundry.applications.detached.windows.get(app.window.windowId)?.window?.document ?? document;
            const contextItems = parentWindow.querySelectorAll('nav#context-menu .context-item');
            const headerButton = Array.from(contextItems).find(i => i.innerText.includes(headerLabel))?.querySelector('i');
            if (!headerButton) return;
            const item = app.document;
            if (!item) return;
            const updated = 1; // TODO: isUpToDate
            const source = documentUtils.getSource(item);
            const sources = [
                'chris-premades',
                'gambits-premades',
                'midi-item-showcase-community',
                'automated-crafted-creations'
            ];
            const STATUSES = constants.MEDKIT_STATUSES;
            if (!sources.includes(source) && source) {
                headerButton.dataset.medkitStatus = STATUSES.UNKNOWN;
                return;
            }
            const identifier = documentUtils.getIdentifier(item);
            let medkitStatus;
            switch (updated) {
                case 0:
                    medkitStatus = STATUSES[`OUTDATED_${source === 'chris-premades' ? 'CPR' : 'OTHER'}`];
                    break;
                case 1:
                    if (source === 'chris-premades') {
                        if (constants.automations.getAutomationByIdentifier(identifier)?.config) {
                            medkitStatus = STATUSES.CONFIGURABLE;
                        } else {
                            medkitStatus = STATUSES.UP_TO_DATE_CPR;
                        }
                    } else {
                        medkitStatus = STATUSES.UP_TO_DATE_OTHER;
                    }
                    break;
                
                case -1:
                    // TODO: preferred item, not any
                    if (constants.automations.getAutomationByIdentifier(identifier)) medkitStatus = STATUSES.AVAILABLE;
                    break;
                
                case 2:
                    medkitStatus = STATUSES.CONFIGURABLE;
            }
            if (medkitStatus) headerButton.dataset.medkitStatus = medkitStatus;
        }, 100);
    }
}