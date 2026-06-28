/** @import Item5e from "../../dnd5e/module/documents/item.mjs" */

import {Logging} from '../lib/_module.mjs';
import {activityUtils, documentUtils, effectUtils, genericUtils} from './_module.mjs';
const activityVisibilityLocks = new Map();

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
function syntheticItem(itemData, actor) {
    const item = new CONFIG.Item.documentClass(itemData, {parent: actor});
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
    const uuid = item.uuid;
    const currentPromise = activityVisibilityLocks.get(uuid) ?? Promise.resolve();
    const nextPromise = (async () => {
        await currentPromise.catch(() => {});
        let effect = documentUtils.getEffectByIdentifier(item, 'catHiddenActivities');
        const changes = [];
        identifiers.forEach(identifier => {
            const activity = getActivityByIdentifier(item, identifier);
            if (activity) {
                changes.push({
                    key: 'system.activities.' + activity.id + '.flags.cat.hidden',
                    type: 'override',
                    value: false
                });
            }
        });
        if (!changes.length) return;
        if (effect) {
            const currentChanges = effect.toObject().system.changes;
            let needsUpdate = false;
            changes.forEach(newChange => {
                const exists = currentChanges.some(c => c.key === newChange.key);
                if (!exists) {
                    currentChanges.push(newChange);
                    needsUpdate = true;
                }
            });
            if (needsUpdate) await documentUtils.update(effect, {'system.changes': currentChanges});
        } else {
            const effectData = {
                name: 'Unhidden Activities',
                img: item.img,
                origin: item.actor.uuid, 
                system: {
                    changes
                }
            };
            genericUtils.setProperty(effectData, 'flags.cat.identifier', 'catHiddenActivities');
            effect = (await enchantItem(item, effectData))?.[0];
        }
        return effect;
    })();
    activityVisibilityLocks.set(uuid, nextPromise);
    try {
        return await nextPromise;
    } finally {
        if (activityVisibilityLocks.get(uuid) === nextPromise) activityVisibilityLocks.delete(uuid);
    }
}
async function rehideActivities(item, identifiers = [], {all = false} = {}) {
    const uuid = item.uuid;
    const currentPromise = activityVisibilityLocks.get(uuid) ?? Promise.resolve();
    const nextPromise = (async () => {
        await currentPromise.catch(() => {});
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
        const currentChanges = effect.toObject().system.changes;
        const remainingChanges = currentChanges.filter(c => !keysToRemove.includes(c.key));
        if (remainingChanges.length === currentChanges.length) return effect; 
        if (!remainingChanges.length) {
            await documentUtils.deleteDocument(effect);
            return; 
        }
        await documentUtils.update(effect, {'system.changes': remainingChanges});
        return effect;
    })();
    activityVisibilityLocks.set(uuid, nextPromise);
    try {
        return await nextPromise;
    } finally {
        if (activityVisibilityLocks.get(uuid) === nextPromise) activityVisibilityLocks.delete(uuid);
    }
}
function getSourceClassIdentifier(item, {subclass = false} = {}) {
    if (!item?.actor?.classes) return;
    if (item.system.sourceItem && item.system.sourceItem.indexOf('class:') === 0) return item.system.sourceItem.split(':')[1];
    if (item.system.advancementRootItem) {
        let rootItem = item.system.advancementRootItem;
        if (!subclass && rootItem.type === 'subclass' && rootItem.class) rootItem = rootItem.class;
        if (['subclass', 'class'].includes(rootItem.type)) return rootItem.identifier;
    }
}
function getEquipmentState(item) {
    if (item.system.equipped === undefined) return true;
    if (!item.system.equipped) return false;
    if (item.system.attunement === 'required' && !item.system.attuned) return false;
    return true;
}
function getSourceClass(item, {subclass = false} = {}) {
    const sourceClassIdentifier = getSourceClassIdentifier(item, {subclass});
    if (!sourceClassIdentifier) return;
    return item.actor.classes[sourceClassIdentifier];
}
function getDependencies(item) {
    const dependencies = new Set();
    if (!item.system.activities) return dependencies;
    item.system.activities.forEach(activity => activityUtils.getDependencies(activity).forEach(depId => dependencies.add(depId)));
    return dependencies;
}
export default {
    getSaveDC,
    getSavedCastData,
    getActivityByIdentifier,
    syntheticItem,
    enchantItem,
    unhideActivities,
    rehideActivities,
    getSourceClassIdentifier,
    getEquipmentState,
    getSourceClass,
    getDependencies
};