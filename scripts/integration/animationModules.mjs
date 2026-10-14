import {constants} from '../lib/_module.mjs';
import {automationUtils} from '../utilities/_module.mjs';
function hasSelectedAnimation(document, config, options) {
    return Object.entries(config ?? {}).some(([key, entry]) => entry.type === 'selectAnimation' && automationUtils.getResolvedAnimation(document, key, options).animation);
}
function hasGenericAnimation(document, generics) {
    return Object.values(document.flags.cat.macros).flat().some(({source, identifier}) => {
        const generic = generics.find(macro => macro.source === source && macro.identifier === identifier);
        return hasSelectedAnimation(document, generic?.genericConfig, {source, identifier});
    });
}
function hasAnimation(item) {
    if (hasSelectedAnimation(item, automationUtils.getCurrentAutomation(item)?.config)) return true;
    if (item.effects?.some(effect => effect.flags.cat?.animation)) return true;
    const documents = [item, ...(item.system.activities ?? [])].filter(document => document.flags?.cat?.macros);
    if (!documents.length) return false;
    const generics = constants.macros.getAllMacros({genericOnly: true});
    return documents.some(document => hasGenericAnimation(document, generics));
}
function workflowStart(data) {
    if (game.settings.get('cat', 'animationPriority') !== 'cat' || !data.item?.system) return;
    if (hasAnimation(data.item)) data.stopWorkflow = true;
}
/**
 * Turn off Boss Loot FX auto-recognition, in memory, for the activities of an item that plays a CAT animation.
 * @param {Activity} activity The activity being used.
 */
function preUseActivity(activity) {
    const item = activity.item;
    if (game.settings.get('cat', 'animationPriority') !== 'cat' || !item?.system) return;
    if (!game.modules.get('boss-loot-assets-premium')?.active || !hasAnimation(item)) return;
    const bossLootFlags = item.flags['boss-loot-assets-premium'] ??= {};
    for (const {id} of item.system.activities) bossLootFlags[id] ??= {autoRec: {enabled: false}};
}
export default {
    workflowStart,
    preUseActivity
};
