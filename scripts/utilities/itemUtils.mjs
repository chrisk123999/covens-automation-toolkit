/** @import Item5e from "../../dnd5e/module/documents/item.mjs" */

import {Logging} from '../lib/_module.mjs';
import {documentUtils, effectUtils, genericUtils} from './_module.mjs';

/**
 * Returns the DC of the first Save activity on an item, otherwise the save DC of the appropriate ability on the item, otherwise 10
 * @param {Item5e} item 
 * @returns {number}
 */
function getSaveDC(item) {
    if (item.hasSave) return item.system.activities.getByType('save')[0].save.dc.value;
    return item.actor?.system?.abilities?.[item.abilityMod]?.dc ?? item?.actor?.system?.attributes?.spell?.dc ?? 10;
}
function getSavedCastData(item) {
    return {
        castLevel: item.flags.cat?.castData?.castLevel ?? -1,
        baseLevel: item.flags.cat?.castData?.baseLevel ?? -1,
        saveDC: getSaveDC(item)
    };
}
function getActivityByIdentifier(item, identifier) {
    return item.system.activities.find(activity => activity.identifier === identifier);
}
async function syntheticItem(itemData, actor) {
    let item = new CONFIG.Item.documentClass(itemData, {parent: actor});
    item.prepareData();
    item.prepareFinalAttributes();
    item.applyActiveEffects();
    return item;
}
async function enchantItem(item, effectData, {effects = [], items = [], effectOptions, forceGM} = {}) {
    if (!effectData.origin) {
        Logging.addMacroError('Enchantments must have an origin!');
        return;
    }
    genericUtils.setProperty(effectData, 'type', 'enchantment');
    effectData.transfer = false;
    genericUtils.setProperty(effectData, 'flags.dnd5e.enchantment', {
        level: {
            min: null,
            max: null
        },
        riders: {
            effect: effects,
            item: items
        }
    });
    return await effectUtils.createEffects(item, [effectData], effectOptions, {forceGM});
}
async function unhideActivities(item, identifiers) {
    let effect = documentUtils.getEffectByIdentifier(item, 'catHiddenActivities');
    const changes = [];
    identifiers.forEach(identifier => {
        const activity = getActivityByIdentifier(item, identifier);
        if (activity) {
            changes.push({
                key: 'system.activities.' + activity.id + '.flags.cat.hidden',
                mode: 5,
                value: 'false'
            });
        }
    });
    if (!changes.length) return;
    if (effect) {
        const currentChanges = effect.toObject().changes;
        let needsUpdate = false;
        changes.forEach(newChange => {
            const exists = currentChanges.some(c => c.key === newChange.key);
            if (!exists) {
                currentChanges.push(newChange);
                needsUpdate = true;
            }
        });
        if (needsUpdate) await documentUtils.update(effect, {changes: currentChanges});
    } else {
        const effectData = {
            name: 'Unhidden Activities',
            origin: item.uuid, 
            changes
        };
        genericUtils.setProperty(effectData, 'flags.cat.identifier', 'catHiddenActivities');
        effect = (await enchantItem(item, effectData))?.[0];
    }
    return effect;
}
async function rehideActivities(item, identifiers = [], {all = false} = {}) {
    const effect = documentUtils.getEffectByIdentifier(item, 'catHiddenActivities');
    if (!effect) return; 
    if (all) {
        await documentUtils.deleteDocument(effect);
        return;
    }
    if (!identifiers.length) return effect;
    const keysToRemove = [];
    identifiers.forEach(identifier => {
        const activity = getActivityByIdentifier(item, identifier);
        if (activity) keysToRemove.push('system.activities.' + activity.id + '.flags.cat.hidden');
    });
    if (!keysToRemove.length) return effect;
    const currentChanges = effect.toObject().changes;
    const remainingChanges = currentChanges.filter(c => !keysToRemove.includes(c.key));
    if (remainingChanges.length === currentChanges.length) return effect; 
    if (!remainingChanges.length) {
        await documentUtils.deleteDocument(effect);
        return; 
    }
    await documentUtils.update(effect, {changes: remainingChanges});
    return effect;
}
export default {
    getSaveDC,
    getSavedCastData,
    getActivityByIdentifier,
    syntheticItem,
    enchantItem,
    unhideActivities,
    rehideActivities
};