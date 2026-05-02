import * as applications from '../applications/_module.mjs';
import {documentUtils} from '../utilities/_module.mjs';
import {constants} from '../lib/_module.mjs'; 
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
            icon: 'fa-solid fa-cat',
            onClick: () => {} // TODO: Embedded Macros
        });
        return;
    }
    controls.push({
        label: headerLabel,
        icon: 'fa-solid fa-cat',
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
            const source = documentUtils.getSource(item);
            const sources = [
                'chris-premades',
                'gambits-premades',
                'midi-item-showcase-community',
                'automated-crafted-creations'
            ];
            if (!sources.includes(source) && source) {
                headerButton.dataset.medkitStatus = constants.MEDKIT_STATUSES.UNKNOWN;
                return;
            }
            const statusSuffix = source === 'chris-premades' ? 'CPR' : 'OTHER';
            let medkitStatus;
            switch (documentUtils.getAutomationStatus(item)) {
                case -1:
                    medkitStatus = constants.MEDKIT_STATUSES.AVAILABLE;
                    break;
                case 0:
                    medkitStatus = constants.MEDKIT_STATUSES[`OUTDATED_${statusSuffix}`];
                    break;
                case 1:
                    medkitStatus = constants.MEDKIT_STATUSES[`UP_TO_DATE_${statusSuffix}`];
                    break;
                case 2:
                case 3:
                    medkitStatus = constants.MEDKIT_STATUSES.CONFIGURABLE;
            }
            if (medkitStatus) headerButton.dataset.medkitStatus = medkitStatus;
        }, 100);
    }
}
export default {
    appendHeaderControl
};