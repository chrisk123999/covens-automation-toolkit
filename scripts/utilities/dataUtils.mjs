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
/**
 * @typedef {object} MacroEntry
 * @property {string} identifier
 * @property {string} rules
 * @property {string} source
 */
/**
 * @typedef {object} MacroGroup
 * @property {string} type
 * @property {MacroEntry[]} macros
 */
/**
 * @typedef {object} AnimationEntry
 * @property {string} identifier
 * @property {string} source
 */
/**
 * @typedef {object} VaeEntry
 * @property {'use'} type 
 * @property {string} name
 * @property {string} itemIdentifier
 * @property {string} [activityIdentifier]
 */
/**
 * @typedef {object} CatEffectData
 * @property {MacroGroup[]} macros Merge the list into existing macros.
 * @property {MacroGroup[]} removeMacros Remove macros that match all provided {@link MacroEntry} properties.
 * @property {AnimationEntry} createAnimation
 * @property {AnimationEntry} deleteAnimation
 * @property {object} createAnimationOptions Options specific to a particular animation, such as color. If absent, defaults are fetched from the registered animation.
 * @property {object} deleteAnimationOptions Options specific to a particular animation, such as color. If absent, defaults are fetched from the registered animation.
 * @property {string[]} specialDuration Deletes effect.
 * @property {string[]} disableCondition Disables effect.
 * @property {string[]} unhideActivities
 * @property {VaeEntry[]} vae
 * @property {'2014'|'2024'|'all'} rules
 * @property {object} copyConfigs Duplicate macro configurations from another document onto this effect.
 */
/**
 * Attach CAT data to an effect before creation.
 * @param {object} effectData 
 * @param {CatEffectData} [options]
 * @returns {object} Modified effectData.
 */
function buildEffectData(effectData, {macros, removeMacros, createAnimation, deleteAnimation, createAnimationOptions = {}, deleteAnimationOptions = {}, rules, specialDuration, disableCondition, vae, unhideActivities, copyConfigs} = {}) {
    if (removeMacros?.length) {
        removeMacros.forEach(macroGroup => {
            if (!macroGroup.macros?.length) return;
            const existingMacros = effectData.flags?.cat?.macros?.[macroGroup.type] ?? [];
            const remaining = existingMacros.filter(e =>
                !macroGroup.macros.some(m => {
                    if (m.source && m.source !== e.source) return;
                    if (m.identifier && m.identifier !== e.identifier) return;
                    if (m.rules && m.rules !== 'all' && e.rules !== 'all' && m.rules !== e.rules) return;
                    return true;
                })
            );
            if (existingMacros.length > 0 && remaining.length === 0) delete effectData.flags.cat.macros[macroGroup.type];
            else genericUtils.setProperty(effectData, 'flags.cat.macros.' + macroGroup.type, remaining);
        });
    }
    if (macros?.length) {
        macros.forEach(macroGroup => {
            if (!macroGroup.macros?.length) return;
            const existingMacros = effectData.flags?.cat?.macros?.[macroGroup.type] ?? [];
            const combinedMacros = [...existingMacros, ...macroGroup.macros];
            const uniqueMacros = new Map();
            combinedMacros.forEach(macro => uniqueMacros.set(macro.source + '|' + macro.identifier + '|' + macro.rules, macro));
            genericUtils.setProperty(effectData, 'flags.cat.macros.' + macroGroup.type, Array.from(uniqueMacros.values()));
        });
    }
    if (rules) setRules(effectData, rules);
    if (specialDuration) genericUtils.setProperty(effectData, 'flags.cat.specialDuration', specialDuration);
    if (disableCondition) genericUtils.setProperty(effectData, 'flags.cat.disableCondition', disableCondition);
    if (vae) genericUtils.setProperty(effectData, 'flags.cat.vae.buttons', vae);
    if (unhideActivities) genericUtils.setProperty(effectData, 'flags.cat.unhideActivities', unhideActivities);
    if (createAnimation) genericUtils.setProperty(effectData, 'flags.cat.animation.create', {...createAnimation, config: createAnimationOptions});
    if (deleteAnimation) genericUtils.setProperty(effectData, 'flags.cat.animation.delete', {...deleteAnimation, config: deleteAnimationOptions});
    if (copyConfigs) genericUtils.setProperty(effectData, 'flags.cat.config', genericUtils.mergeObject(effectData.flags.cat?.config ?? {}, copyConfigs));
    return effectData;
}
export default {
    setRules,
    setIdentifier,
    buildEffectData
};