/**
 * Item lookups, creation, enchantments, hidden activities and CAT description blocks. Ranges come back in feet.
 * @module
 */
/** @import Item5e from "../../dnd5e/module/documents/item.mjs" */

import {constants, Logging} from '../lib/_module.mjs';
import {activityUtils, actorUtils, distanceUtils, documentUtils, effectUtils, genericUtils, queryUtils} from './_module.mjs';
const activityVisibilityLocks = new Map();

/**
 * Get an item's save DC. Uses the DC of its first save activity, then the owner's DC for the item's ability, then the
 * owner's spell save DC, then `10`.
 * @param {Item5e} item  Item to read from.
 * @returns {number}
 * @example
 * const dc = itemUtils.getSaveDC(item);
 */
function getSaveDC(item) {
    if (item.hasSave) return item.system.activities.getByType('save')[0].save.dc.value;
    return item.actor?.system?.abilities?.[item.abilityMod]?.dc ?? item?.actor?.system?.attributes?.spell?.dc ?? 10;
}
/**
 * Read the cast data CAT stored in the item's `flags.cat.castData`, with the item's current save DC from
 * {@link getSaveDC}.
 * @param {Item5e} item  Item to read from.
 * @returns {{castLevel: number, baseLevel: number, saveDC: number, school: string|undefined}}
 *                       Levels are `-1` when nothing is stored.
 * @example
 * const {castLevel, saveDC} = itemUtils.getSavedCastData(item);
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
 * Find one of an item's activities by its identifier. Midi-qol reads the identifier from `midiProperties.identifier`,
 * falling back to a slug of the activity name.
 * @param {Item5e} item        Item to read from.
 * @param {string} identifier  Activity identifier to match.
 * @returns {Activity|undefined}
 * @example
 * const activity = itemUtils.getActivityByIdentifier(item, 'dismiss');
 */
function getActivityByIdentifier(item, identifier) {
    return item.system.activities.find(activity => activity.identifier === identifier);
}
/**
 * Build an unsaved item owned by an actor, with its data prepared and active effects applied. Nothing is created in the
 * world.
 * @param {object} itemData                Item data to build from.
 * @param {foundry.documents.Actor} actor  Actor that owns the item.
 * @returns {Item5e}
 * @example
 * const itemData = item.toObject();
 * itemData.system.damage.base.number = 2;
 * const modifiedItem = itemUtils.syntheticItem(itemData, actor);
 */
function syntheticItem(itemData, actor) {
    const item = new CONFIG.Item.documentClass(itemData, {parent: actor});
    item.prepareData();
    item.prepareFinalAttributes();
    item.applyActiveEffects();
    return item;
}
/**
 * Create an enchantment on an item through {@link effectUtils.createEffects}. `effectData` is modified in place into an
 * applied enchantment, with `transfer` on and `disabled` off. Logs an error and creates nothing when `effectData` has
 * no `origin`.
 * @param {Item5e} item                             Item to enchant.
 * @param {object} effectData                       Enchantment effect data. Must have an `origin`.
 * @param {object} [options]                        Additional options.
 * @param {Array<object|string>} [options.effects]  Rider effects. Objects are created on `item` and deleted with the
 *                                                  enchantment. Strings are stored as dnd5e enchantment effect riders.
 * @param {Array<object|string>} [options.items]    Rider items. Objects are created on the item's actor and deleted
 *                                                  with the enchantment. Strings are stored as dnd5e enchantment item
 *                                                  riders.
 * @param {object} [options.effectOptions]          Passed to the enchantment's creation.
 * @param {boolean} [options.forceGM]               Create through a GM even when the user has permission.
 * @param {boolean} [options.favoriteItems]         Add created rider items to the actor's favorites.
 * @returns {Promise<ActiveEffect|undefined>}       The enchantment, or undefined when nothing was created.
 * @example
 * const effectData = {name: item.name, img: item.img, origin: item.uuid, system: {changes: [{key: 'name', type: 'override', value: 'Flaming Sword'}]}};
 * await itemUtils.enchantItem(weapon, effectData);
 */
async function enchantItem(item, effectData, {effects = [], items = [], effectOptions, forceGM, favoriteItems} = {}) {
    if (!effectData.origin) {
        Logging.addMacroWarning('cat', 'enchant-item', 'Enchantments must have an origin!', {notify: 'error'});
        return;
    }
    effectData.transfer = true;
    effectData.disabled = false;
    effectData.type = 'enchantment';
    genericUtils.setProperty(effectData, 'flags.dnd5e.enchantment', {
        level: {
            min: null,
            max: null
        },
        riders: {
            effect: effects.filter(e => typeof e === 'string'),
            item: items.filter(e => typeof e === 'string')
        }
    });
    const enchantment = (await effectUtils.createEffects(item, [effectData], {effectOptions, forceGM}))?.[0];
    if (enchantment) {
        const riderEffects = effects.filter(e => typeof e === 'object');
        const riderItems = items.filter(i => typeof i === 'object').map(i => (genericUtils.setProperty(i, 'flags.dnd5e.enchantment.origin', enchantment.uuid), i));
        if (riderEffects.length) await effectUtils.createEffects(item, riderEffects, {forceGM, parentEntity: enchantment});
        if (riderItems.length) await createItems(item.actor, riderItems, {favorite: favoriteItems, parentEntity: enchantment});
    }
    return enchantment;
}
/**
 * Create items on an actor through {@link documentUtils.createEmbeddedDocuments}.
 * @param {foundry.documents.Actor} actor                     Actor to receive the items.
 * @param {object[]} itemDatas                                Item data to create.
 * @param {object} [options]                                  Additional options.
 * @param {boolean} [options.favorite]                        Add the created items to the actor's favorites. Defaults
 *                                                            to false.
 * @param {foundry.abstract.Document} [options.parentEntity]  Delete the created items when this document is deleted.
 * @returns {Promise<foundry.documents.Item[]>}
 * @example
 * const [created] = await itemUtils.createItems(actor, [itemData], {favorite: true, parentEntity: effect});
 */
async function createItems(actor, itemDatas, {favorite = false, parentEntity} = {}) {
    const items = await documentUtils.createEmbeddedDocuments(actor, 'Item', itemDatas);
    if (parentEntity) await documentUtils.makeDependent(parentEntity, items);
    if (favorite) await actorUtils.addFavorites(actor, items);
    return items;
}
/**
 * Find every item in the world whose flag strictly equals a value. Searches sidebar items, items on world actors and
 * items added to unlinked tokens. Compendium items are not searched.
 * @param {string} scope  Flag scope, such as a module id.
 * @param {string} key    Dot-separated flag path inside the scope.
 * @param {*} value       Value the flag must equal.
 * @returns {Item5e[]}
 * @example
 * const copies = itemUtils.getWorldItemsByFlag('cat', 'sourceUuid', item.uuid);
 */
function getWorldItemsByFlag(scope, key, value) {
    const matches = flags => genericUtils.getProperty(flags ?? {}, scope + '.' + key) === value;
    const unlinkedTokens = game.scenes.contents.flatMap(scene => scene.tokens.filter(token => !token.actorLink && token._source.delta?.items?.some(item => matches(item.flags))));
    const tokenItems = unlinkedTokens.flatMap(token => token.actor?.items.filter(item => token.delta.items.manages(item.id)) ?? []);
    const items = [...game.items.contents, ...game.actors.contents.flatMap(actor => actor.items.contents), ...tokenItems];
    return items.filter(item => matches(item.flags));
}
/**
 * Delete every item found by {@link getWorldItemsByFlag}. Non-GM users route the deletion through a GM query that waits
 * up to 30 seconds.
 * @param {string} scope         Flag scope, such as a module id.
 * @param {string} key           Dot-separated flag path inside the scope.
 * @param {*} value              Value the flag must equal.
 * @returns {Promise<string[]>}  Uuids of the deleted items. Empty when the GM query fails.
 * @example
 * await itemUtils.deleteWorldItemsByFlag('cat', 'sourceUuid', item.uuid);
 */
async function deleteWorldItemsByFlag(scope, key, value) {
    if (!game.user.isGM) return await queryUtils.query('deleteItemsByFlag', queryUtils.gmUser(), {scope, key, value}, 30000) ?? [];
    const items = getWorldItemsByFlag(scope, key, value);
    await Promise.all(Array.from(Map.groupBy(items, item => item.parent), ([parent, group]) => {
        const ids = group.map(item => item.id);
        return parent ? parent.deleteEmbeddedDocuments('Item', ids) : Item.implementation.deleteDocuments(ids);
    }));
    return items.map(item => item.uuid);
}
/**
 * Reveal activities hidden by `flags.cat.hidden`. The overrides live on one `catHiddenActivities` enchantment on the
 * item, created through {@link enchantItem} or updated when it exists. Calls for the same item run one at a time.
 * @param {Item5e} item                        Item with the hidden activities.
 * @param {string[]} identifiers               Activity identifiers to reveal. Unknown ones are skipped.
 * @param {object} [options]                   Additional options.
 * @param {boolean} [options.ids]              Treat `identifiers` as activity ids. Defaults to false.
 * @param {boolean} [options.favorite]         Also add the revealed activities to the actor's favorites. Defaults to
 *                                             false.
 * @returns {Promise<ActiveEffect|undefined>}  The enchantment holding the overrides, or undefined when no activity
 *                                             matched.
 * @example
 * await itemUtils.unhideActivities(item, ['dismiss'], {favorite: true});
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
            genericUtils.setProperty(effectData, 'flags.cat.noAnimation', true);
            effect = await enchantItem(item, effectData);
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
 * Hide activities revealed by {@link unhideActivities} again. The `catHiddenActivities` enchantment is deleted once
 * nothing is left revealed. Calls for the same item run one at a time.
 * @param {Item5e} item                        Item with the revealed activities.
 * @param {string[]} [identifiers]             Activity identifiers to hide.
 * @param {object} [options]                   Additional options.
 * @param {boolean} [options.all]              Delete the enchantment, hiding everything and ignoring `identifiers`.
 *                                             Defaults to false.
 * @param {boolean} [options.favorite]         Also remove the hidden activities from the actor's favorites. Ignored
 *                                             with `all`. Defaults to false.
 * @returns {Promise<ActiveEffect|undefined>}  The remaining enchantment, or undefined when it was deleted or never
 *                                             existed.
 * @example
 * await itemUtils.rehideActivities(item, ['dismiss'], {favorite: true});
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
 * Get a `type:identifier` key for the item that granted this one, such as `class:wizard`. Reads `system.sourceItem`
 * first, then the root of the item's advancement origin. Items not on an actor return their
 * `flags.cat.automation.sourceType` instead.
 * @param {Item5e} item         Item to read from.
 * @returns {string|undefined}  Undefined when no source is found.
 * @example
 * if (itemUtils.getAdvancementSourceKey(item) !== 'class:wizard') return;
 */
function getAdvancementSourceKey(item) {
    if (!item.actor) return item.flags.cat?.automation?.sourceType;
    if (item.system?.sourceItem) return item.system.sourceItem;
    let rootItem = item.system?.advancementRootItem ?? item.actor.items.get(item.flags.dnd5e?.advancementOrigin?.split('.')[0]);
    if (rootItem) return `${rootItem.type}:${rootItem.identifier}`;
}
/**
 * Get the item on the same actor that granted this one, found from {@link getAdvancementSourceKey}. A subclass source
 * returns its class unless `subclass` is true.
 * @param {Item5e} item                 Item to read from.
 * @param {object} [options]            Additional options.
 * @param {boolean} [options.subclass]  Return a subclass source as the subclass rather than its class. Defaults to
 *                                      false.
 * @returns {Item5e|undefined}          Undefined for items not on an actor or with no source found.
 * @example
 * const classItem = itemUtils.getAdvancementSourceItem(item);
 * const subclassItem = itemUtils.getAdvancementSourceItem(item, {subclass: true});
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
 * Whether an item is in effect. It must be equipped, attuned when attunement is required, and have its magic available
 * when it has the magical property.
 * @param {Item5e} item  Item to read from.
 * @returns {boolean}    True for item types that can't be equipped.
 * @example
 * if (!itemUtils.getEquipmentState(item)) return;
 */
function getEquipmentState(item) {
    if (item.system.equipped === undefined) return true;
    if (!item.system.equipped) return false;
    if (item.system.attunement === 'required' && !item.system.attuned) return false;
    if (item.system.properties?.has('mgc') && item.system.magicAvailable === false) return false;
    return true;
}
/**
 * Get every damage type in the damage parts of an item's attack, damage and save activities. Includes types written as
 * roll flavor in a formula, such as `1d6[fire]`.
 * @param {Item5e} item    Item to read from.
 * @returns {Set<string>}  Empty for items without activities.
 * @example
 * if (itemUtils.getItemDamageTypes(item).has('fire')) return;
 */
function getItemDamageTypes(item) {
    const activities = Array.from(item.system.activities?.getByTypes('attack', 'damage', 'save') ?? []);
    const flavorTypes = new Set(activities.flatMap(activity => activity.damage.parts.flatMap(part => new Roll(part.formula).terms.map(term => term.flavor).filter(flavor => flavor))));
    const declaredTypes = new Set(activities.flatMap(activity => activity.damage.parts.flatMap(part => Array.from(part.types))));
    return flavorTypes.union(declaredTypes);
}
/**
 * Remove CAT's generated `cat-description` blocks from description HTML. Does not update any document.
 * @param {string} html  Description HTML.
 * @returns {string}     The HTML without the blocks, or `html` unchanged when it has none.
 * @example
 * const description = itemUtils.stripDescriptionBlock(item.system.description.value);
 */
function stripDescriptionBlock(html) {
    if (!html?.includes('cat-description')) return html;
    return replaceDescriptionBlock(html, '');
}
/**
 * Fill bare `[[/damage]]` and `[[/save]]` enrichers in description HTML with the item's damage parts and save ability
 * and DC. A kept description then still resolves after the item's activities are replaced. Uses the first activity with
 * damage parts and the first with a save ability.
 * @param {string} html  Description HTML.
 * @param {Item5e} item  Item the description belongs to.
 * @returns {string}     The updated HTML. Does not update any document.
 * @example
 * const description = itemUtils.resolveDescriptionEnrichers(item.system.description.value, item);
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
 * Replace CAT's generated `cat-description` block at the end of an item's description, then update the item. Skips the
 * update when nothing changed.
 * @param {Item5e} item     Item to update.
 * @param {string} content  HTML for the block. Empty removes the block.
 * @returns {Promise<void>}
 * @example
 * await itemUtils.setDescriptionBlock(item, '<p>Automated by CAT.</p>');
 */
async function setDescriptionBlock(item, content) {
    const current = item.system.description?.value ?? '';
    const updated = replaceDescriptionBlock(current, content);
    if (updated === current) return;
    await documentUtils.update(item, {'system.description.value': updated});
}
/**
 * Replace CAT's generated `cat-description` block at the end of description HTML. Produces the same HTML as
 * {@link setDescriptionBlock} without updating any document.
 * @param {string} html     Description HTML.
 * @param {string} content  HTML for the block. Empty removes the block.
 * @returns {string}        The updated HTML.
 * @example
 * const description = itemUtils.replaceDescriptionBlock(item.system.description.value, '<p>Automated by CAT.</p>');
 */
function replaceDescriptionBlock(html, content) {
    const wrapper = globalThis.document.createElement('div');
    wrapper.innerHTML = html ?? '';
    wrapper.querySelectorAll(':scope > .cat-description').forEach(block => block.remove());
    if (content) {
        const block = globalThis.document.createElement('div');
        block.className = 'cat-description';
        block.innerHTML = content;
        wrapper.append(block);
    }
    return wrapper.innerHTML;
}
/**
 * The content of the first `cat-description` block in description HTML.
 * @param {string} html  Description HTML.
 * @returns {string}     The block's inner HTML, or an empty string when there is none.
 * @example
 * const notes = itemUtils.getDescriptionBlock(source.system.description.value);
 */
function getDescriptionBlock(html) {
    if (!html?.includes('cat-description')) return '';
    const wrapper = globalThis.document.createElement('div');
    wrapper.innerHTML = html;
    return wrapper.querySelector(':scope > .cat-description')?.innerHTML ?? '';
}
/**
 * Collect the dependency ids of every activity on an item from {@link activityUtils.getDependencies}.
 * @param {Item5e} item    Item to read from.
 * @returns {Set<string>}  Empty for items without activities.
 */
function getDependencies(item) {
    const dependencies = new Set();
    if (!item.system.activities) return dependencies;
    item.system.activities.forEach(activity => activityUtils.getDependencies(activity).forEach(depId => dependencies.add(depId)));
    return dependencies;
}
/**
 * Whether the owner could cast a spell right now. Checks preparation, limited uses and an available spell slot of the
 * spell's level or higher. Spells cast through a linked activity count as innate and check the item uses, activity uses
 * and materials that activity consumes instead.
 * @param {Item5e} item  Spell to check.
 * @returns {boolean}    False for anything that isn't a spell on an actor.
 * @example
 * const castable = actor.items.filter(item => itemUtils.canCast(item));
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
 * Get the spell attack bonus the item's owner rolls with: proficiency, the ability modifier and attack bonuses. Uses
 * the item's ability, then the actor's spellcasting ability, then Intelligence. Adds the melee spell attack bonus when
 * the item's first attack is a melee attack, otherwise the ranged one. Undefined for an item without an actor.
 * @param {Item5e} item  Item on an actor.
 * @returns {number|undefined}
 * @example
 * const attackBonus = itemUtils.getSpellAttackBonus(item);
 */
function getSpellAttackBonus(item) {
    const actor = item.actor;
    if (!actor) return;
    const ability = item.system.ability || actor.system.attributes.spellcasting || 'int';
    const rollData = actor.getRollData();
    const melee = item.system.activities?.find(activity => activity.type === 'attack')?.attack.type.value === 'melee';
    const {bonus} = dnd5e.dataModels.shared.D20RollModificationField.combineFields(actor.system, [
        `abilities.${ability}.attack.roll`, 'rolls.attack', melee ? 'rolls.attack.msak' : 'rolls.attack.rsak'
    ], {rules: {category: 'attack', actor, item, rollData}});
    return actor.system.attributes.prof + (actor.system.abilities[ability]?.mod ?? 0) + dnd5e.utils.simplifyBonus(bonus, rollData);
}
/**
 * Add a bonus to the first damage part of every activity in item data. Modifies `itemData` in place and does not update
 * any document.
 * @param {object} itemData      Item source data, such as from `item.toObject()`.
 * @param {string|number} bonus  Formula added to each part's existing bonus.
 * @example
 * const itemData = item.toObject();
 * itemUtils.addDamageBonus(itemData, '1d6');
 */
function addDamageBonus(itemData, bonus) {
    Object.values(itemData.system.activities).forEach(activityData => {
        const part = activityData.damage?.parts?.[0];
        if (!part) return;
        part.bonus = part.bonus ? part.bonus + ' + ' + bonus : String(bonus);
    });
}
/**
 * Add a copy of a cast activity to an item, set to cast a chosen spell, then update the item. The copy gets a new id
 * and no spent uses, is visible, and is removed when `parent` is deleted.
 * @param {Item5e} item                    Item that receives the activity.
 * @param {object} activityData            Cast activity data to copy.
 * @param {Item5e} spell                   Spell the activity casts.
 * @param {ActiveEffect} parent            Effect the activity depends on.
 * @param {object} [options]               Additional options.
 * @param {Actor5e} [options.caster]       Actor whose spell attack bonus and save DC the spell uses.
 * @param {object} [options.updates]       Merged into the copied activity data.
 * @returns {Promise<Activity|undefined>}  The new activity.
 * @example
 * const activityData = itemUtils.getActivityByIdentifier(item, 'cast').toObject();
 * await itemUtils.attachCastActivity(item, activityData, spell, effect, {caster: actor});
 */
async function attachCastActivity(item, activityData, spell, parent, {caster, updates = {}} = {}) {
    const castData = genericUtils.mergeObject(genericUtils.deepClone(activityData), updates);
    castData._id = foundry.utils.randomID();
    castData.spell.uuid = spell.uuid;
    castData.uses.spent = 0;
    genericUtils.setProperty(castData, 'midiProperties.automationOnly', false);
    genericUtils.setProperty(castData, 'flags.cat.hidden', false);
    genericUtils.setProperty(castData, 'flags.dnd5e.dependentOn', parent.uuid);
    if (caster) castData.spell.challenge = {
        attack: caster.system.attributes.spell.attack,
        save: caster.system.attributes.spell.dc,
        override: true
    };
    await documentUtils.update(item, {['system.activities.' + castData._id]: castData});
    return item.system.activities.get(castData._id);
}
/**
 * Get the label of a system base weapon.
 * @param {string} key          Base weapon key, such as `longsword`.
 * @returns {string|undefined}  Undefined for unknown keys.
 * @example
 * const label = itemUtils.getBaseWeaponLabel(item.system.type.baseItem);
 */
function getBaseWeaponLabel(key) {
    return constants.weaponOptions.find(weapon => weapon.value === key)?.label;
}
/**
 * Get the localized label of a weapon mastery.
 * @param {string} mastery  Mastery key, such as `topple`.
 * @returns {string}        The key itself for unknown masteries.
 * @example
 * const label = itemUtils.getMasteryLabel(item.system.mastery);
 */
function getMasteryLabel(mastery) {
    return _loc(CONFIG.DND5E.weaponMasteries[mastery]?.label ?? mastery);
}
/**
 * Whether a weapon's owner can use a mastery with it. Requires a weapon on an actor with mastery enabled. Characters
 * need the mastery among the weapon's mastery options, and other actors need it to be the weapon's mastery.
 * @param {Item5e} item       Weapon to check.
 * @param {string} [mastery]  Mastery key. Defaults to the weapon's mastery.
 * @returns {boolean}
 * @example
 * if (!itemUtils.canUseMastery(workflow.item, 'topple')) return;
 */
function canUseMastery(item, mastery = item?.system.mastery) {
    if (item?.type !== 'weapon' || !item.actor || !mastery || !actorUtils.isMasteryEnabled(item.actor)) return false;
    if (item.actor.type !== 'character') return item.system.mastery === mastery;
    return !!item.system.masteryOptions?.some(option => option.value === mastery);
}
/**
 * Get an item's range, long range and reach in feet, converted from the item's range units with
 * {@link distanceUtils.lengthToFeet}.
 * @param {Item5e} item  Item to read from.
 * @returns {{value: number|undefined, long: number|undefined, reach: number|undefined}}
 *                       Each is undefined when empty or when the units aren't a length, such as `touch` or `self`.
 * @example
 * const {value, long} = itemUtils.getRange(item);
 */
function getRange(item) {
    const {value, long, reach, units} = item.system.range ?? {};
    return {value: distanceUtils.lengthToFeet(value, units), long: distanceUtils.lengthToFeet(long, units), reach: distanceUtils.lengthToFeet(reach, units)};
}
/**
 * Whether an item counts as magical: a spell, or an item with the magical property.
 * @param {Item5e} [item]  Item to check.
 * @returns {boolean}      False when `item` is undefined.
 * @example
 * if (itemUtils.isMagical(workflow.item)) return;
 */
function isMagical(item) {
    return item?.type === 'spell' || !!item?.system.properties?.has('mgc');
}
export default {
    getRange,
    isMagical,
    getBaseWeaponLabel,
    canUseMastery,
    getMasteryLabel,
    getSaveDC,
    getSavedCastData,
    getActivityByIdentifier,
    attachCastActivity,
    syntheticItem,
    enchantItem,
    createItems,
    getWorldItemsByFlag,
    deleteWorldItemsByFlag,
    unhideActivities,
    rehideActivities,
    getAdvancementSourceKey,
    getAdvancementSourceItem,
    getEquipmentState,
    getItemDamageTypes,
    stripDescriptionBlock,
    resolveDescriptionEnrichers,
    setDescriptionBlock,
    replaceDescriptionBlock,
    getDescriptionBlock,
    getDependencies,
    canCast,
    getSpellAttackBonus,
    addDamageBonus
};
