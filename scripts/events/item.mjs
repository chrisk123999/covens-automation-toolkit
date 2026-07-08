import {constants, Events} from '../lib/_module.mjs';
import {genericUtils, queryUtils} from '../utilities/_module.mjs';
import {items, effects} from '../handlers/_module.mjs';
async function bulkUpdated(items) {
    await new Events.ItemsEvent(items, constants.itemPasses.bulkUpdated).run({canOverlap: true});
}
async function createItem(item, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (item.compendium) await items.updateHash(item, {create: true});
    if (!item.actor) return;
    await new Events.ItemEvent(item, constants.itemPasses.created, {options}).run();
}
async function deleteItem(item, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (item.compendium) await items.updateHash(item, {remove: true});
    if (!item.actor) return;
    await new Events.ItemEvent(item, constants.itemPasses.deleted, {options}).run();
}
async function updateItem(item, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (item.compendium) await items.updateHash(item);
    if (!item.actor) return;
    await new Events.ItemEvent(item, constants.itemPasses.updated, {options, updates}).run();
    if (!('equipped' in item.system)) return;
    const currentlyEquipped = updates.system?.equipped ?? item.system.equipped;
    const previouslyEquipped = genericUtils.getProperty(options, 'cat.previous.equipped');
    if (currentlyEquipped && !previouslyEquipped) {
        await effects.specialDurationEquipment(item);
        await effects.disableConditionEquipment(item);
        await new Events.ItemEvent(item, constants.itemPasses.equipped, {options, updates}).run();
    } else if (!currentlyEquipped && previouslyEquipped) {
        await effects.specialDurationEquipment(item, {removed: true});
        await effects.disableConditionEquipment(item);
        await new Events.ItemEvent(item, constants.itemPasses.unequipped, {options, updates}).run();
    }
    const currentlyAttuned = updates.system?.attuned ?? item.system.attuned;
    const previouslyAttuned = genericUtils.getProperty(options, 'cat.previous.attuned');
    const attunement = updates.system?.attunement ?? item.system?.attunement;
    const validTypes = ['required', 'optional'];
    const requiresAttunement = validTypes.includes(attunement);
    const previousState = (!requiresAttunement || previouslyAttuned) && previouslyEquipped; 
    const currentState = (!requiresAttunement || currentlyAttuned) && currentlyEquipped;
    if (previousState === currentState) return;
    if (currentState) {
        await new Events.ItemEvent(item, constants.itemPasses.attuned, {options, updates}).run();
    } else {
        await new Events.ItemEvent(item, constants.itemPasses.unattuned, {options, updates}).run();
    }
}
async function actorMunched({actor, ddbCharacter}) {
    await new Events.ItemsEvent(actor.items, constants.itemPasses.munched, {ddbCharacter}).run({canOverlap: true});
}
async function itemMedkit(item) {
    await new Events.ItemEvent(item, constants.itemPasses.medkit).run();
}
async function preUpdateItem(item, updates, options, userId) {
    const equipped = item.system.equipped;
    if (equipped != undefined) genericUtils.setProperty(options, 'cat.previous.equipped', equipped);
    const attuned = item.system.attuned;
    if (attuned != undefined) genericUtils.setProperty(options, 'cat.previous.attuned', attuned);
}
export default {
    bulkUpdated,
    createItem,
    deleteItem,
    updateItem,
    actorMunched,
    itemMedkit,
    preUpdateItem
};