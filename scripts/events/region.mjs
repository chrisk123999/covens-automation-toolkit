import {constants, Events} from '../lib/_module.mjs';
import {activityUtils, regionUtils} from '../utilities/_module.mjs';
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
    const activity = fromUuidSync(originUuid, {strict: false});
    if (!activity) return;
    const sourceUpdates = {
        flags: {
            cat: {
                castData: {
                    castLevel: region.flags.dnd5e.spellLevel,
                    baseLevel: activity.item.system.level,
                    saveDC: activityUtils.getSaveDC(activity)
                }
            }
        }
    };
    const regionMacros = activity.flags.cat?.placed?.region?.macros;
    if (regionMacros) sourceUpdates.flags.cat.macros = regionMacros;
    const visibility = activity.flags.cat?.placed?.region?.visibility;
    if (visibility) sourceUpdates.flags.cat.visibility = visibility;
    region.updateSource(sourceUpdates);
}
export default {
    createRegion,
    updateRegion,
    deleteRegion,
    createWorkflowRegion,
    preCreateRegion
};