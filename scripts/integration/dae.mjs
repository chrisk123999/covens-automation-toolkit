import {genericUtils} from '../utilities/_module.mjs';
const daeBrowserFields = {
    'CAT.CR': new Set(),
    'CAT.CV': new Set(),
    'CAT.SR': new Set(),
    'CAT.SV': new Set(),
    'CAT.OTHER': new Set(),
    'CAT.FeatureRollModes': new Set()
};
const targetedFlags = [
    {keys: ['CR', 'CV'], targets: () => Object.entries(CONFIG.DND5E.conditionTypes).map(([key, {name}]) => [key, {condition: name}])},
    {keys: ['SR', 'SV'], targets: () => Object.entries(CONFIG.DND5E.spellSchools).map(([key, {label}]) => [key, {school: label}])}
];
const featureFlags = ['FF', 'FI', 'FR', 'FV'];
const otherFlags = {
    'flags.cat.ignoreDifficultTerrain.tokens': {key: 'IgnoreDifficultTerrainTokens'},
    'flags.cat.grappleShove.sizeBonus': {key: 'GrappleShoveSizeBonus', number: true},
    'flags.cat.grappleDrag.freeSizeOffset': {key: 'GrappleDragFreeSizeOffset', number: true}
};
function catFlag(key, target) {
    return `flags.cat.${key}.${target}`;
}
function initFlags() {
    for (const {keys, targets} of targetedFlags)
        for (const key of keys)
            for (const [target] of targets()) daeBrowserFields[`CAT.${key}`].add(catFlag(key, target));
    featureFlags.forEach(f => daeBrowserFields['CAT.FeatureRollModes'].add(catFlag(f, 'identifier')));
    Object.keys(otherFlags).forEach(flag => daeBrowserFields['CAT.OTHER'].add(flag));
}
function injectFlags() {
    for (const {keys, targets} of targetedFlags) {
        for (const key of keys) {
            genericUtils.setProperty(game.i18n.translations, `dae.fieldData.fieldCategories.CAT.${key}`, _loc(`CAT.DAE.${key}.Category`));
            for (const [target, data] of targets()) {
                DAE.localizationMap[catFlag(key, target)] = {
                    name: _loc(`CAT.DAE.${key}.Name`, data),
                    description: _loc(`CAT.DAE.${key}.Description`, data)
                };
            }
        }
    }
    genericUtils.setProperty(game.i18n.translations, 'dae.fieldData.fieldCategories.CAT.FeatureRollModes', _loc('CAT.DAE.FeatureRollModes'));
    for (const featureRollMode of featureFlags) {
        DAE.localizationMap[catFlag(featureRollMode, 'identifier')] = {
            name: _loc(`CAT.DAE.${featureRollMode}.Name`),
            description: _loc(`CAT.DAE.${featureRollMode}.Description`) 
        };
    }
    genericUtils.setProperty(game.i18n.translations, 'dae.fieldData.fieldCategories.CAT.OTHER', _loc('CAT.DAE.Other'));
    for (const [flag, {key}] of Object.entries(otherFlags)) {
        DAE.localizationMap[flag] = {
            name: _loc(`CAT.DAE.${key}.Name`),
            description: _loc(`CAT.DAE.${key}.Description`)
        };
    }
}
function addFlags(fieldData) {
    for (const [category, fields] of Object.entries(daeBrowserFields))
        fieldData[category] = Array.from(fields);
}
// TODO define a combobox field for CR/CV and feature roll mode
function modifySpecials(specKey, specials) {
    for (const fieldset of Object.values(daeBrowserFields))
        for (const field of fieldset)
            specials[field] = otherFlags[field]?.number ? [new foundry.data.fields.NumberField(), ''] : [new foundry.data.fields.StringField(), 'custom'];
}
export default {
    initFlags,
    injectFlags,
    addFlags,
    modifySpecials
};