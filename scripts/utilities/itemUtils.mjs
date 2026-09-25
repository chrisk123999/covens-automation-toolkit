/** @import Item5e from "../../dnd5e/module/documents/item.mjs" */

import {Logging} from '../lib/_module.mjs';
import {activityUtils, actorUtils, documentUtils, effectUtils, genericUtils} from './_module.mjs';
const activityVisibilityLocks = new Map();

/**
 * Returns the DC of the first Save activity on an item, otherwise the save DC of the appropriate ability on the item, otherwise 10
 * @param {Item5e} item Item to read from.
 * @returns {number}
 */
function getSaveDC(item) {
    if (item.hasSave) return item.system.activities.getByType('save')[0].save.dc.value;
    return item.actor?.system?.abilities?.[item.abilityMod]?.dc ?? item?.actor?.system?.attributes?.spell?.dc ?? 10;
}
/**
 * Get the cast data stashed on this item, with its current save DC.
 * @param {Item5e} item Item to read from.
 * @returns {{castLevel: number, baseLevel: number, saveDC: number, school: string|undefined}} Levels are -1 when nothing is stashed.
 */
function getSavedCastData(item) {
    return {
        castLevel: item.flags.cat?.castData?.castLevel ?? -1,
        baseLevel: item.flags.cat?.castData?.baseLevel ?? -1,
        saveDC: getSaveDC(item),
        school: item.flags.cat?.castData?.school
    };
}
/**
 * Find one of this item's activities by its identifier, which midi derives from
 * `midiProperties.identifier`, falling back to a slug of the activity name.
 * @param {Item5e} item Item to read from.
 * @param {string} identifier Activity identifier to match.
 * @returns {Activity|undefined}
 */
function getActivityByIdentifier(item, identifier) {
    return item.system.activities.find(activity => activity.identifier === identifier);
}
/**
 * Build a prepared, unsaved item owned by an actor, for handing a modified copy to a workflow.
 * @param {object} itemData Item data to build an in-memory item from.
 * @param {foundry.documents.Actor} actor Actor the items belong to.
 * @returns {Item5e}
 */
function syntheticItem(itemData, actor) {
    const item = new CONFIG.Item.documentClass(itemData, {parent: actor});
    item.prepareData();
    item.prepareFinalAttributes();
    item.applyActiveEffects();
    return item;
}
/**
 * Apply an enchantment to an item. The effect data must carry an origin.
 * @param {Item5e} item Item to read from.
 * @param {object} effectData Coerced to an enchantment; `transfer` is forced off.
 * @param {object} [options] Additional options.
 * @param {object[]} [options.effects] Additional effects created on the actor, dependent on the enchantment.
 * @param {object[]} [options.items] Additional items created on the actor, dependent on the enchantment.
 * @param {object} [options.effectOptions] Passed to the creation when it goes through a GM.
 * @param {boolean} [options.forceGM] Create through a GM even when the user has permission.
 * @returns {Promise<ActiveEffect[]|undefined>}
 */
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
/**
 * Create items on an actor, optionally favoriting them and tying their lifetime to a parent document.
 * @param {foundry.documents.Actor} actor Actor the items belong to.
 * @param {object[]} itemDatas Item data to create.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.favorite] Add the created items to the actor's favorites.
 * @param {foundry.abstract.Document} [options.parentEntity] Delete the created items when this document is deleted.
 * @returns {Promise<foundry.documents.Item[]>}
 */
async function createItems(actor, itemDatas, {favorite = false, parentEntity} = {}) {
    const items = await documentUtils.createEmbeddedDocuments(actor, 'Item', itemDatas);
    if (parentEntity) await documentUtils.makeDependent(parentEntity, items);
    if (favorite) await actorUtils.addFavorites(actor, items);
    return items;
}
/**
 * Reveal activities hidden by `flags.cat.hidden`, through a `catHiddenActivities` enchantment on the item.
 * @param {Item5e} item Item to read from.
 * @param {string[]} identifiers Activity identifiers to act on.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.ids] Treat {@link identifiers} as activity ids rather than identifiers.
 * @param {boolean} [options.favorite] Also add the revealed activities to the actor's favorites.
 * @returns {Promise<ActiveEffect|undefined>} The enchantment holding the overrides.
 */
async function unhideActivities(item, identifiers, {ids = false, favorite = false} = {}) {
    const uuid = item.uuid;
    const currentPromise = activityVisibilityLocks.get(uuid) ?? Promise.resolve();
    const nextPromise = (async () => {
        await currentPromise.catch(() => {});
        let effect = documentUtils.getEffectByIdentifier(item, 'catHiddenActivities');
        const changes = [];
        const revealed = [];
        identifiers.forEach(identifier => {
            const activity = ids ? item.system.activities.get(identifier) : getActivityByIdentifier(item, identifier);
            if (activity) {
                revealed.push(activity);
                changes.push({
                    key: 'system.activities.' + activity.id + '.flags.cat.hidden',
                    type: 'override',
                    value: false
                });
            }
        });
        if (!changes.length) return;
        if (favorite) await actorUtils.addFavorites(item.actor, revealed);
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
/**
 * Undo {@link unhideActivities}, dropping the whole enchantment once nothing is left revealed.
 * @param {Item5e} item Item to read from.
 * @param {string[]} [identifiers] Activity identifiers to act on.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.all] Re-hide everything, ignoring {@link identifiers}.
 * @param {boolean} [options.favorite] Also drop the re-hidden activities from the actor's favorites.
 * @returns {Promise<void>}
 */
async function rehideActivities(item, identifiers = [], {all = false, favorite = false} = {}) {
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
        if (favorite) await actorUtils.removeFavorites(item.actor, identifiers.map(identifier => getActivityByIdentifier(item, identifier)).filter(activity => activity));
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
/**
 * Fetch a key representing the class, race, feat, etc. that granted an item ('type:identifier').
 * @param {Item5e} item Item to read from.
 * @returns {string|undefined}
 */
function getAdvancementSourceKey(item) {
    if (!item.actor) return item.flags.cat?.automation?.sourceType;
    if (item.system?.sourceItem) return item.system.sourceItem;
    let rootItem = item.system?.advancementRootItem ?? item.actor.items.get(item.flags.dnd5e?.advancementOrigin);
    if (rootItem) return `${rootItem.type}:${rootItem.identifier}`;
}
/**
 * Fetch the class, race, feat, etc. that granted an item. Works on actor items only.
 * @param {Item5e} item Item to read from.
 * @param {*} [options] Passed through to dnd5e's advancement lookup.
 * @param {boolean} [options.subclass] If true and the advancement source resolves to a subclass, return the base class instead. Default false.
 * @returns {Item5e|undefined}
 */
function getAdvancementSourceItem(item, {subclass = false} = {}) {
    if (!item.actor) return;
    const key = getAdvancementSourceKey(item);
    if (!key) return;
    let [type, identifier] = key.split(':');
    if (!identifier) {
        identifier = type;
        type = undefined;
    }
    const source = actorUtils.getItemByIdentifier(item.actor, identifier, {type});
    if (!source) return;
    if (type === 'subclass' && !subclass && source.class) return source.class;
    return source;
}
/**
 * Whether this item is currently active: equipped, and attuned when attunement is required.
 * @param {Item5e} item Item to read from.
 * @returns {boolean} True for items that cannot be equipped at all.
 */
function getEquipmentState(item) {
    if (item.system.equipped === undefined) return true;
    if (!item.system.equipped) return false;
    if (item.system.attunement === 'required' && !item.system.attuned) return false;
    return true;
}
/**
 * Get every damage type an item can deal across its attack, damage and save activities, including flavor-declared types.
 * @param {Item5e} item Item to read from.
 * @returns {Set<string>}
 */
function getItemDamageTypes(item) {
    const activities = Array.from(item.system.activities?.getByTypes('attack', 'damage', 'save') ?? []);
    const flavorTypes = new Set(activities.flatMap(activity => activity.damage.parts.flatMap(part => new Roll(part.formula).terms.map(term => term.flavor).filter(flavor => flavor))));
    const declaredTypes = new Set(activities.flatMap(activity => activity.damage.parts.flatMap(part => Array.from(part.types))));
    return flavorTypes.union(declaredTypes);
}
/**
 * Remove CAT's generated description block from an item description.
 * @param {string} html Description html to work on.
 * @returns {string}
 */
function stripDescriptionBlock(html) {
    if (!html?.includes('cat-description')) return html;
    const wrapper = globalThis.document.createElement('div');
    wrapper.innerHTML = html;
    wrapper.querySelectorAll(':scope > .cat-description').forEach(block => block.remove());
    return wrapper.innerHTML;
}
/**
 * Bake an item's damage and save data into bare enrichers so a kept description still resolves after its activities are replaced.
 * @param {string} html Description html to work on.
 * @param {Item5e} item The item the description currently belongs to.
 * @returns {string}
 */
function resolveDescriptionEnrichers(html, item) {
    if (!html?.includes('[[/')) return html;
    const activities = item.system?.activities;
    if (!activities) return html;
    if (html.includes('[[/damage]]')) {
        const parts = activities.find(entry => entry.damage?.parts?.length)?.damage.parts ?? [];
        const config = parts.map(part => {
            const types = Array.from(part.types ?? []).join('|');
            return [part.formula, types ? 'type=' + types : ''].filter(Boolean).join(' ');
        }).filter(Boolean).join(' & ');
        if (config) html = html.replaceAll('[[/damage]]', '[[/damage ' + config + ']]');
    }
    if (html.includes('[[/save]]')) {
        const save = activities.find(entry => entry.save?.ability?.size)?.save;
        const abilities = Array.from(save?.ability ?? []).join('|');
        if (abilities) {
            const dc = save.dc.calculation === 'spellcasting' ? '@attributes.spell.dc'
                : save.dc.calculation in CONFIG.DND5E.abilities ? '@abilities.' + save.dc.calculation + '.dc'
                    : save.dc.formula;
            const config = ['ability=' + abilities, dc ? 'dc=' + dc : ''].filter(Boolean).join(' ');
            html = html.replaceAll('[[/save]]', '[[/save ' + config + ']]');
        }
    }
    return html;
}
/**
 * Replace CAT's generated description block on an item, skipping the update when nothing changed.
 * @param {Item5e} item Item to read from.
 * @param {string} content Empty removes the block.
 * @returns {Promise<void>}
 */
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
/**
 * Collect the ids every activity on this item depends on.
 * @param {Item5e} item Item to read from.
 * @returns {Set<string>}
 */
function getDependencies(item) {
    const dependencies = new Set();
    if (!item.system.activities) return dependencies;
    item.system.activities.forEach(activity => activityUtils.getDependencies(activity).forEach(depId => dependencies.add(depId)));
    return dependencies;
}
/**
 * Whether this spell could be cast right now, accounting for preparation, casting method and anything its linked activity would consume.
 * @param {Item5e} item Item to read from.
 * @returns {boolean} False for anything that is not a spell.
 */
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
/**
 * The spell attack bonus this item's owner rolls with, including their ranged spell attack bonus.
 * @param {Item5e} item Item to read from.
 * @returns {number}
 */
function getSpellAttackBonus(item) {
    const actor = item.actor;
    const ability = item.system.ability || actor.system.attributes.spellcasting || 'int';
    const bonus = dnd5e.utils.simplifyBonus(actor.system.bonuses?.rsak?.attack, actor.getRollData());
    return actor.system.attributes.prof + (actor.system.abilities[ability]?.mod ?? 0) + bonus;
}
/**
 * Append a bonus to the first damage part of every activity in this item's data, in place.
 * @param {object} itemData Item source data to modify.
 * @param {string|number} bonus Formula appended to each part.
 */
function addDamageBonus(itemData, bonus) {
    Object.values(itemData.system.activities).forEach(activityData => {
        const part = activityData.damage?.parts?.[0];
        if (!part) return;
        part.bonus = part.bonus ? part.bonus + ' + ' + bonus : String(bonus);
    });
}
export default {
    getSaveDC,
    getSavedCastData,
    getActivityByIdentifier,
    syntheticItem,
    enchantItem,
    createItems,
    unhideActivities,
    rehideActivities,
    getAdvancementSourceKey,
    getAdvancementSourceItem,
    getEquipmentState,
    getItemDamageTypes,
    stripDescriptionBlock,
    resolveDescriptionEnrichers,
    setDescriptionBlock,
    getDependencies,
    canCast,
    getSpellAttackBonus,
    addDamageBonus
};
