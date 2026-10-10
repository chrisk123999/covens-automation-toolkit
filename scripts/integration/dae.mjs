import {genericUtils} from '../utilities/_module.mjs';
const daeBrowserFields = {
    'CAT.CR': new Set(),
    'CAT.CV': new Set(),
    'CAT.OTHER': new Set(),
    'CAT.FeatureRollModes': new Set()
};
const conditionFlags = ['CR', 'CV'];
const featureFlags = ['FF', 'FI', 'FR', 'FV'];
function catFlag(key, target) {
    return `flags.cat.${key}.${target}`;
}
function initFlags() {
    Object.keys(CONFIG.DND5E.conditionTypes).forEach(condition => {
        daeBrowserFields['CAT.CR'].add(catFlag('CR', condition));
        daeBrowserFields['CAT.CV'].add(catFlag('CV', condition));
    });
    featureFlags.forEach(f => daeBrowserFields['CAT.FeatureRollModes'].add(catFlag(f, 'identifier')));
    daeBrowserFields['CAT.OTHER'].add('flags.cat.ignoreDifficultTerrain.tokens');
}
function injectFlags() {
    for (const conditionRollMode of conditionFlags) {
        genericUtils.setProperty(
            game.i18n.translations,
            `dae.fieldData.fieldCategories.CAT.${conditionRollMode}`,
            _loc(`CAT.DAE.${conditionRollMode}.Category`)
        );
        for (const [condition, {name}] of Object.entries(CONFIG.DND5E.conditionTypes)) {
            genericUtils.setProperty(game.i18n.translations, `dae.CAT.${conditionRollMode}.fieldData.${catFlag(conditionRollMode, condition)}`, {
                name: _loc(`CAT.DAE.${conditionRollMode}.Name`, {condition: name}),
                description: _loc(`CAT.DAE.${conditionRollMode}.Description`, {condition: name})
            });
        }
    }
    genericUtils.setProperty(
        game.i18n.translations,
        'dae.fieldData.fieldCategories.CAT.FeatureRollModes',
        _loc('CAT.DAE.FeatureRollModes')
    );
    for (const featureRollMode of featureFlags) {
        genericUtils.setProperty(game.i18n.translations, `dae.CAT.FeatureRollModes.fieldData.${catFlag(featureRollMode, 'identifier')}`, {
            name: _loc(`CAT.DAE.${featureRollMode}.Name`),
            description: _loc(`CAT.DAE.${featureRollMode}.Description`) 
        });
    }
    genericUtils.setProperty(game.i18n.translations, 'dae.fieldData.fieldCategories.CAT.OTHER', _loc('CAT.DAE.Other'));
    genericUtils.setProperty(game.i18n.translations, 'dae.CAT.OTHER.fieldData.flags.cat.ignoreDifficultTerrain.tokens', {
        name: _loc('CAT.DAE.IgnoreDifficultTerrainTokens.Name'),
        description: _loc('CAT.DAE.IgnoreDifficultTerrainTokens.Description')
    });
}
function addFlags(fieldData) {
    for (const [category, fields] of Object.entries(daeBrowserFields))
        fieldData[category] = Array.from(fields);
}
// TODO define a combobox field for CR/CV flags
function modifySpecials(specKey, specials) {
    for (const fieldset of Object.values(daeBrowserFields))
        for (const field of fieldset)
            specials[field] = (console.log(field), [new foundry.data.fields.StringField(), 'custom']);
}
export default {
    initFlags,
    injectFlags,
    addFlags,
    modifySpecials
};