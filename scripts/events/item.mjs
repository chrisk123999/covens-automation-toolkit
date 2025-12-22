import {constants, Events} from '../lib.mjs';
import {queryUtils} from '../utils.mjs';
async function bulkUpdated(items) {

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

}
export const itemEvents = {
    bulkUpdated,
    createItem,
    deleteItem,
    updateItem,
    actorMunched
};