import {genericUtils} from '../utilities/_module.mjs';
const daeFieldBrowserFields = [];
const conditionFlags = ['CR', 'CV'];
const featureFlags = ['FF', 'FI', 'FR', 'FV'];
function catFlag(key, target) {
    return `flags.cat.${key}.${target}`;
}
function initFlags() {
    const browserFields = [];
    Object.keys(CONFIG.DND5E.conditionTypes).forEach(condition => 
        browserFields.push(...conditionFlags.map(c => catFlag(c, condition)))
    );
    browserFields.push(...featureFlags.map(f => catFlag(f, 'identifier')));
    daeFieldBrowserFields.push(...Array.from(new Set(browserFields)).sort());
}
function injectFlags() {
    for (const [condition, {name}] of Object.entries(CONFIG.DND5E.conditionTypes)) {
        for (const conditionRollMode of conditionFlags) {
            genericUtils.setProperty(game.i18n.translations, 'dae.CAT.fieldData.' + catFlag(conditionRollMode, condition), {
                name: _loc(`CAT.DAE.${conditionRollMode}.Name`, {condition: name}),
                description: _loc(`CAT.DAE.${conditionRollMode}.Description`, {condition: name})
            });
        }
    }
    for (const featureRollMode of featureFlags) {
        genericUtils.setProperty(game.i18n.translations, 'dae.CAT.fieldData.' + catFlag(featureRollMode, 'identifier'), {
            name: _loc(`CAT.DAE.${featureRollMode}.Name`),
            description: _loc(`CAT.DAE.${featureRollMode}.Description`) 
        });
    }
}
function addFlags(fieldData) {
    fieldData['CAT'] = daeFieldBrowserFields;
}
function modifySpecials(specKey, specials) {
    daeFieldBrowserFields.forEach(field => {
        specials[field] = [new foundry.data.fields.StringField(), 'CUSTOM'];
    });
}
export default {
    initFlags,
    injectFlags,
    addFlags,
    modifySpecials
};