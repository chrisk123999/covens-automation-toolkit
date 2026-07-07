import {genericUtils} from './_module.mjs';
/**
 * Set document rules in the correct location. Does not perform updates.
 * @param {object | foundry.abstract.Document} documentData
 * @param {'2024' | '2014'} rules 
 */
function setRules(documentData, rules) {
    genericUtils.setProperty(documentData, 'flags.cat.automation.rules', rules);
}
/**
 * Set document identifier in the correct location. Does not perform updates.
 * @param {object | foundry.abstract.Document} documentData
 * @param {string} identifier 
 */
function setIdentifier(documentData, identifier) {
    genericUtils.setProperty(documentData, 'flags.cat.identifier', identifier);
}
function buildEffectData(effectData, {macros, createAnimation, deleteAnimation, createAnimationOptions = {}, deleteAnimationOptions = {}, vae, unhideActivities} = {}) {
    if (macros?.length) {
        macros.forEach(macroGroup => {
            if (!macroGroup.macros.length) return;
            const existingMacros = effectData.flags?.cat?.macros?.[macroGroup.type] ?? [];
            const combinedMacros = [...existingMacros, ...macroGroup.macros];
            const uniqueMacros = new Map();
            combinedMacros.forEach(macro => uniqueMacros.set(macro.source + '|' + macro.identifier + '|' + macro.rules, macro));
            genericUtils.setProperty(effectData, 'flags.cat.macros.' + macroGroup.type, Array.from(uniqueMacros.values()));
        });
    }
    if (vae) genericUtils.setProperty(effectData, 'flags.cat.vae.buttons', vae);
    if (unhideActivities) genericUtils.setProperty(effectData, 'flags.cat.unhideActivities', unhideActivities);
    if (createAnimation) genericUtils.setProperty(effectData, 'flags.cat.animation.create', {...createAnimation, config: createAnimationOptions});
    if (deleteAnimation) genericUtils.setProperty(effectData, 'flags.cat.animation.delete', {...deleteAnimation, config: deleteAnimationOptions});
    return effectData;
}
export default {
    setRules,
    setIdentifier,
    buildEffectData
};