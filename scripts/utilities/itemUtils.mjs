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
        saveDC: getSaveDC(item),
        school: item.flags.cat?.castData?.school
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
    return await effectUtils.createEffects(item, [effectData], {effectOptions, forceGM});
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
/**
 * Get every damage type an item can deal across its attack, damage and save activities, including flavor-declared types.
 * @param {Item5e} item
 * @returns {Set<string>}
 */
function getItemDamageTypes(item) {
    const activities = Array.from(item.system.activities?.getByTypes('attack', 'damage', 'save') ?? []);
    const flavorTypes = new Set(activities.flatMap(activity => activity.damage.parts.flatMap(part => new Roll(part.formula).terms.map(term => term.flavor).filter(flavor => flavor))));
    const declaredTypes = new Set(activities.flatMap(activity => activity.damage.parts.flatMap(part => Array.from(part.types))));
    return flavorTypes.union(declaredTypes);
}
function stripDescriptionBlock(html) {
    if (!html?.includes('cat-description')) return html;
    const wrapper = globalThis.document.createElement('div');
    wrapper.innerHTML = html;
    wrapper.querySelectorAll(':scope > .cat-description').forEach(block => block.remove());
    return wrapper.innerHTML;
}
async function setDescriptionBlock(item, content) {
    const current = item.system.description?.value ?? '';
    const wrapper = globalThis.document.createElement('div');
    wrapper.innerHTML = current;
    wrapper.querySelectorAll(':scope > .cat-description').forEach(block => block.remove());
    if (content) {
        const block = globalThis.document.createElement('div');
        block.className = 'cat-description';
        block.innerHTML = content;
        wrapper.append(block);
    }
    const updated = wrapper.innerHTML;
    if (updated === current) return;
    await documentUtils.update(item, {'system.description.value': updated});
}
function getDependencies(item) {
    const dependencies = new Set();
    if (!item.system.activities) return dependencies;
    item.system.activities.forEach(activity => activityUtils.getDependencies(activity).forEach(depId => dependencies.add(depId)));
    return dependencies;
}
function canCast(item) {
    if (item.type !== 'spell') return false;
    const actor = item.actor;
    if (!actor) return false;
    const system = item.system;
    const linkedActivity = system.linkedActivity;
    const effectiveMethod = linkedActivity ? 'innate' : system.method;
    if (effectiveMethod === 'spell' && system.level !== 0 && !system.prepared) return false;
    if (system.hasLimitedUses && !system.uses.value) return false;
    if (!['atwill', 'innate'].includes(effectiveMethod)) {
        const maxSlot = Math.max(...Object.values(actor.system.spells).filter(i => i.value).map(j => j.level), 0);
        if (maxSlot < system.level) return false;
    }
    if (!linkedActivity) return true;
    const targets = linkedActivity.consumption?.targets ?? [];
    for (const target of targets) {
        if (target.type === 'itemUses') {
            let targetItem;
            if (!target.target || !target.target.length) {
                targetItem = linkedActivity.item;
            } else {
                targetItem = actor.items.get(target.target);
            }
            if (Number(targetItem?.system.uses.value ?? 0) < Number(target.value ?? 0)) return false;
            
        } else if (target.type === 'activityUses') {
            if (Number(linkedActivity.uses.value ?? 0) < Number(target.value ?? 0)) return false;
            
        } else if (target.type === 'material') {
            if (Number(actor.items.get(target.target)?.system.quantity ?? 0) < Number(target.value ?? 0)) return false;
        }
    }
    return true;
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
    getItemDamageTypes,
    stripDescriptionBlock,
    setDescriptionBlock,
    getDependencies,
    canCast
};