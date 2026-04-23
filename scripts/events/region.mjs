import {constants, Events} from '../lib/_module.mjs';
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
function preCreateRegion(region, updates, options, userId) {
    const originUuid = region.flags.dnd5e?.origin;
    if (!originUuid) return;
    const activity = fromUuidSync(originUuid);
    if (!activity) return;
    const regionMacros = activity.flags.cat?.placed?.region?.macros;
    if (regionMacros) region.updateSource({'flags.cat.macros.region': regionMacros});
    const visibility = activity.flags.cat?.placed?.region?.visibility;
    if (visibility) region.updateSource({'flags.cat.visibility': visibility});
}
export default {
    createRegion,
    updateRegion,
    deleteRegion,
    createWorkflowRegion,
    preCreateRegion
};