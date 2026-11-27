import {ActorMedkit} from '../applications/_module.mjs';
import {effects, items} from '../handlers/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {automationUtils, dataUtils, genericUtils, queryUtils} from '../utilities/_module.mjs';
async function bulkUpdated(items) {
    await new Events.ItemsEvent(items, constants.itemPasses.bulkUpdated).run({canOverlap: true});
}
async function createItem(item, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (item.compendium) await items.updateHash(item, {create: true});
    if (!item.actor) return;
    if (item.system.linkedActivity?.item.flags.cat?.automation?.source && !item.flags.cat?.automation?.source) await automationUtils.updateItem(item, {massApply: true});
    await automationUtils.updateScales(item);
    if (item.effects.some(effect => effect.flags.cat?.disableCondition?.length) || (item.type === 'equipment' && item.system.equipped)) await effects.refreshDisableConditions(item.actor);
    await new Events.ItemEvent(item, constants.itemPasses.created, {options}).run();
}
async function deleteItem(item, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (item.compendium) await items.updateHash(item, {remove: true});
    if (!item.actor) return;
    if (item.type === 'equipment' && item.system.equipped) await effects.refreshDisableConditions(item.actor);
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
        await effects.refreshDisableConditions(item.actor);
        await new Events.ItemEvent(item, constants.itemPasses.equipped, {options, updates}).run();
    } else if (!currentlyEquipped && previouslyEquipped) {
        await effects.specialDurationEquipment(item, {removed: true});
        await effects.refreshDisableConditions(item.actor);
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
    if (game.settings.get('cat', 'ddbiIntegration')) await new ActorMedkit({document: actor}).massApply({prompt: false});
}
async function itemMedkit(item, {massApply = false} = {}) {
    await new Events.ItemEvent(item, constants.itemPasses.medkit, {massApply}).run();
}
async function preUpdateItem(item, updates, options, userId) {
    const equipped = item.system.equipped;
    if (equipped != undefined) genericUtils.setProperty(options, 'cat.previous.equipped', equipped);
    const attuned = item.system.attuned;
    if (attuned != undefined) genericUtils.setProperty(options, 'cat.previous.attuned', attuned);
}
function preCreateItem(item) {
    if (item.pack || !item.flags.cat?.automation || item.flags.cat.automation.metric) return;
    const source = item.toObject();
    const converted = dataUtils.convertItemToMetric(genericUtils.deepClone(source));
    if (converted.flags.cat.automation.metric) item.updateSource(foundry.utils.diffObject(source, converted));
}
export default {
    bulkUpdated,
    createItem,
    deleteItem,
    updateItem,
    actorMunched,
    itemMedkit,
    preUpdateItem,
    preCreateItem
};
