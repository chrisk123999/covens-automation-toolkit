import {genericUtils} from '../utilities/_module.mjs';
const daeFieldBrowserFields = [];
function initFlags() {
    const browserFields = [];
    Object.keys(CONFIG.DND5E.conditionTypes).forEach(condition => {
        browserFields.push('flags.cat.CR.' + condition);
        browserFields.push('flags.cat.CV.' + condition);
    });
    daeFieldBrowserFields.push(...Array.from(new Set(browserFields)).sort());
}
function injectFlags() {
    Object.entries(CONFIG.DND5E.conditionTypes).forEach(([condition, {name}]) => {
        genericUtils.setProperty(game.i18n.translations, 'dae.CAT.fieldData.flags.cat.CR.' + condition, {
            name: _loc('CAT.DAE.CR.Name', {condition: name}),
            description: _loc('CAT.DAE.CR.Description', {condition: name})
        });
        genericUtils.setProperty(game.i18n.translations, 'dae.CAT.fieldData.flags.cat.CV.' + condition, {
            name: _loc('CAT.DAE.CV.Name', {condition: name}),
            description: _loc('CAT.DAE.CV.Description', {condition: name})
        });
    });
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