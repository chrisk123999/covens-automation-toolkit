import {constants, Events} from '../lib/_module.mjs';
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
    await new Events.ItemEvent(item, constants.itemPasses.deleted, {options, updates}).run();
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