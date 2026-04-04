import {constants, Events} from '../lib.mjs';
async function createRegion(region, options, userId) {
    if (userId != game.user.id) return;
    if (region.flags.dnd5e?.spellLevel) return;
    console.log(region);
    await new Events.RegionEvent([region], constants.regionPasses.created, {options}).run();
}
async function updateRegion(region, updates, options, userId) {
    if (userId != game.user.id) return;
    console.log(region);
    await new Events.RegionEvent([region], constants.regionPasses.updated, {options, updates}).run();
}
async function deleteRegion(region, options, userId) {
    if (userId != game.user.id) return;
    console.log(region);
    await new Events.RegionEvent([region], constants.regionPasses.deleted, {options}).run();
}
async function createWorkflowRegion(workflow) {
    console.log(workflow.template);
    await new Events.RegionEvent([workflow.template], constants.regionPasses.created, {workflow}).run();
}
export const regionEvents = {
    createRegion,
    updateRegion,
    deleteRegion,
    createWorkflowRegion
};