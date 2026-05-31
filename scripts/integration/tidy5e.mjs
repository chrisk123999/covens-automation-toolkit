import * as applications from '../applications/_module.mjs';
import {automationUtils} from '../utilities/_module.mjs';
import {constants} from '../lib/_module.mjs';
function headerControls(api) {
    const headerLabel = _loc('CAT.MEDKIT.HeaderLabel');
    api.registerItemHeaderControls({
        controls: [
            {
                icon: 'fa-solid fa-shield-cat cat-medkit-item',
                label: headerLabel,
                position: 'header',
                onClickAction() {
                    new applications.ItemMedkit({document: this.document}).render({force: true});
                }
            }
        ]
    });
    api.registerActorHeaderControls({
        controls: [
            {
                icon: 'fa-solid fa-shield-cat cat-medkit-actor',
                label: headerLabel,
                position: 'header',
                onClickAction() {
                    new applications.ActorMedkit({document: this.document}).render({force: true});
                }
            }
        ]
    });
}
async function renderTidySheet(app, elem, options) {
    const document = app.document;
    if (!document) return;
    const selector = document.documentName === 'Item' ? '.cat-medkit-item' : '.cat-medkit-actor';
    const headerIcon = elem.querySelector(selector);
    if (!headerIcon) return;
    let medkitStatus;
    switch (automationUtils.getAutomationStatus(document)) {
        case -2:
            medkitStatus = constants.MEDKIT_STATUSES.UNKNOWN;
            break;
        case -1:
            medkitStatus = constants.MEDKIT_STATUSES.AVAILABLE;
            break;
        case 0:
            medkitStatus = constants.MEDKIT_STATUSES.OUTDATED;
            break;
        case 1:
            medkitStatus = constants.MEDKIT_STATUSES.UP_TO_DATE;
            break;
        case 2:
        case 3:
            medkitStatus = constants.MEDKIT_STATUSES.CONFIGURABLE;
            break;
    }
    if (medkitStatus) headerIcon.dataset.medkitStatus = medkitStatus;
}
export default {
    headerControls,
    renderTidySheet
};