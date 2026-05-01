import {constants, Events} from '../lib/_module.mjs';
import specialDuration from '../mechanics/specialDuration.mjs';
import {queryUtils} from '../utilities/_module.mjs';
async function bulkUpdated(items) {
    await new Events.ItemsEvent(items, constants.itemPasses.bulkUpdated).run({canOverlap: true});
}
async function createItem(item, options, userId) {
    if (!queryUtils.isTheGM() || !item.actor) return;
    await new Events.ItemEvent(item, constants.itemPasses.created, {options}).run();
}
async function deleteItem(item, options, userId) {
    if (!queryUtils.isTheGM() || !item.actor) return;
    await new Events.ItemEvent(item, constants.itemPasses.deleted, {options}).run();
}
async function updateItem(item, updates, options, userId) {
    if (!queryUtils.isTheGM() || !item.actor) return;
    await new Events.ItemEvent(item, constants.itemPasses.updated, {options, updates}).run();
    if (!('equipped' in item.system)) return;
    const currentlyEquipped = updates.system?.equipped ?? item.system.equipped;
    const previouslyEquipped = item.system.equipped;
    if (currentlyEquipped && !previouslyEquipped) {
        await specialDuration.specialDurationEquipment(item);
        await new Events.ItemEvent(item, constants.itemPasses.equipped, {options, updates}).run();
    } else if (!currentlyEquipped && previouslyEquipped) {
        await new Events.ItemEvent(item, constants.itemPasses.unequipped, {options, updates}).run();
    }
    const currentlyAttuned = updates.system?.attuned ?? item.system.attuned;
    const previouslyAttuned = item.system?.attuned;
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
export default {
    bulkUpdated,
    createItem,
    deleteItem,
    updateItem,
    actorMunched
};