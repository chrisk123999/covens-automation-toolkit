import {documentUtils} from './_module.mjs';
import {constants} from '../lib/_module.mjs';
function getCurrentAutomation(item) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item);
    const source = documentUtils.getSource(item);
    const type = item.type === 'spell' ? 'character' : item.actor?.type ?? 'character';
    const monsterIdentifier = type === 'npc' ? documentUtils.getIdentifier(item.actor) : undefined;
    if (!identifier || !rules || !source) return;
    return constants.automations.getAutomationByIdentifier(identifier, {rules, source, monsterIdentifier});
}
// TODO: May need to improve this, went with something simple
function getAutomationStatus(item) {
    const STATUSES = {
        UNAVAILABLE: -2,
        AVAILABLE: -1,
        OUTDATED: 0,
        UP_TO_DATE: 1,
        CONFIGURABLE: 2,
        GENERIC: 3
    };
    if (item.flags.cat?.config?.generic) return STATUSES.GENERIC;
    else {
        const currentAutomation = getCurrentAutomation(item);
        if (currentAutomation) {
            if (foundry.utils.isNewerVersion(currentAutomation.version, documentUtils.getVersion(item))) return STATUSES.OUTDATED;
            if (currentAutomation.config) return STATUSES.CONFIGURABLE;
            return STATUSES.UP_TO_DATE;
        }
        if (getAvailableAutomations(document).length) return STATUSES.AVAILABLE;
    }
    return STATUSES.UNAVAILABLE;
}
function getAvailableAutomations(item) {
    const identifier = documentUtils.getIdentifier(item);
    const rules = documentUtils.getRules(item) ?? 'all';
    return constants.automations.getAutomationByIdentifier(identifier, {rules, multiple: true});
}
function getConfigValue(document, key) {
    return constants.automations?.getConfigValue(document, key);
}
export default {
    getCurrentAutomation,
    getAutomationStatus,
    getAvailableAutomations,
    getConfigValue
};