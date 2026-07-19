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
function getSpellActivities(item) {
    return item.flags.cat?.spellActivities;
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
async function setActivitiesHidden(item, identifiers, hidden, {favorite = false} = {}) {
    const uuid = item.uuid;
    const currentPromise = activityVisibilityLocks.get(uuid) ?? Promise.resolve();
    const nextPromise = (async () => {
        await currentPromise.catch(() => {});
        const updates = {};
        const activities = [];
        identifiers.forEach(identifier => {
            const activity = getActivityByIdentifier(item, identifier);
            if (!activity) return;
            updates['system.activities.' + activity.id + '.flags.cat.hidden'] = hidden;
            activities.push(activity);
        });
        if (!activities.length) return;
        const result = await documentUtils.update(item, updates);
        if (favorite && item.actor) {
            for (const activity of activities) {
                const favoriteId = foundry.utils.buildRelativeUuid(item, item.actor) + '.Activity.' + activity.id;
                if (!hidden && !item.actor.system.hasFavorite?.(favoriteId)) await item.actor.system.addFavorite?.({type: 'activity', id: favoriteId});
                else if (hidden && item.actor.system.hasFavorite?.(favoriteId)) await item.actor.system.removeFavorite?.(favoriteId);
            }
        }
        return result;
    })();
    activityVisibilityLocks.set(uuid, nextPromise);
    try {
        return await nextPromise;
    } finally {
        if (activityVisibilityLocks.get(uuid) === nextPromise) activityVisibilityLocks.delete(uuid);
    }
}
async function unhideActivities(item, identifiers, {favorite = false} = {}) {
    return await setActivitiesHidden(item, identifiers, false, {favorite});
}
async function rehideActivities(item, identifiers = [], {favorite = false} = {}) {
    return await setActivitiesHidden(item, identifiers, true, {favorite});
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
    getSpellActivities,
    syntheticItem,
    enchantItem,
    unhideActivities,
    rehideActivities,
    getSourceClassIdentifier,
    getEquipmentState,
    getSourceClass,
    getItemDamageTypes,
    getDependencies,
    canCast
};