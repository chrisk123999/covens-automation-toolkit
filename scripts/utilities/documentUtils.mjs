import {constants} from '../lib.mjs';
function getRules(document) {
    let rules = document.flags.cat?.automation?.rules;
    if (rules) return rules;
    if (document.documentName === 'Item') return document.system.source.rules;
}
function getSource(document) {
    return document.flags.cat?.automation?.source;
}
function getIdentifier(document) {
    switch (document.documentName) {
        case 'Activity': return document.midiProperties.identifier;
        case 'Item': return document.system.identifier;
        default: return this.document.flags.cat?.identifier ?? this.document.name.slugify();
    }
}
function getConfigValue(document, key) {
    return constants.automations?.getConfigValue(document, key);
}
function getVersion(document) {
    return document.flags.cat?.automation?.version;
}
export const documentUtils = {
    getRules,
    getSource,
    getIdentifier,
    getConfigValue,
    getVersion
};