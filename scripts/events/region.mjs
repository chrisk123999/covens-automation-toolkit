import {constants, Events} from '../lib/_module.mjs';
import {regions} from '../handlers/_module.mjs';
async function createRegion(region, options, userId) {
    if (userId != game.user.id) return;
    if (region.flags.dnd5e?.spellLevel) return;
    await new Events.RegionEvent([region], constants.regionPasses.created, {options}).run();
}
async function updateRegion(region, updates, options, userId) {
    if (userId != game.user.id) return;
    await new Events.RegionEvent([region], constants.regionPasses.updated, {options, updates}).run();
}
async function deleteRegion(region, options, userId) {
    if (userId != game.user.id) return;
    await new Events.RegionEvent([region], constants.regionPasses.deleted, {options}).run();
}
async function createWorkflowRegion(workflow) {
    await new Events.RegionEvent([workflow.template], constants.regionPasses.created, {workflow}).run();
}
async function preCreateRegion(region, updates, options, userId) {
    regions.placed(region);
}
export default {
    createRegion,
    updateRegion,
    deleteRegion,
    createWorkflowRegion,
    preCreateRegion
};