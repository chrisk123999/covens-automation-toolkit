import {constants, Events} from '../lib/_module.mjs';
import {regions} from '../handlers/_module.mjs';
import {genericUtils, regionUtils} from '../utilities/_module.mjs';
async function createRegion(region, options, userId) {
    if (userId != game.user.id) return;
    if (region.flags.dnd5e?.spellLevel) return;
    await regions.regionEffects(region);
    await new Events.RegionEvent([region], constants.regionPasses.created, {options}).run();
}
async function doRegionMove(region, locationData, {movementPromise}) {
    const regionTokens = regionUtils.getRegionMovementTokens(region, locationData);
    if (movementPromise) await movementPromise;
    await regions.processMovedRegionActivities(region, regionTokens.entered, constants.regionPasses.entered);
    await regions.processMovedRegionActivities(region, regionTokens.exited, constants.regionPasses.exited);
    await regions.processMovedRegionActivities(region, regionTokens.stayed, constants.regionPasses.stayed);
    await regions.processMovedRegionActivities(region, regionTokens.through, constants.regionPasses.passedOver);
    await new Events.RegionEvent([region], constants.regionPasses.entered, {locationData, tokens: regionTokens.entered}).run();
    await new Events.RegionEvent([region], constants.regionPasses.exited, {locationData, tokens: regionTokens.exited}).run();
    await new Events.RegionEvent([region], constants.regionPasses.stayed, {locationData, tokens: regionTokens.stayed}).run();
    await new Events.RegionEvent([region], constants.regionPasses.passedOver, {locationData, tokens: regionTokens.through}).run();
}
async function updateRegion(region, updates, options, userId) {
    if (userId != game.user.id) return;
    const spatialKeys = ['shapes', 'x', 'y', 'elevation', 'bottom', 'top'];
    const movedOrReshaped = spatialKeys.some(key => key in updates);
    if (movedOrReshaped) await regions.regionEffects(region);
    const locationData = options.cat?.oldLocation;
    if (locationData) await doRegionMove(region, locationData);
    await new Events.RegionEvent([region], constants.regionPasses.updated, {options, updates}).run();
}
async function deleteRegion(region, options, userId) {
    if (userId != game.user.id) return;
    await regions.regionEffects(region, true);
    await new Events.RegionEvent([region], constants.regionPasses.deleted, {options}).run();
}
async function createWorkflowRegion(workflow) {
    await regions.regionEffects(workflow.template);
    await new Events.RegionEvent([workflow.template], constants.regionPasses.created, {workflow}).run();
}
function preCreateRegion(region, updates, options, userId) {
    regions.placed(region);
}
function preUpdateRegion(region, updates, options, userId) {
    if (updates.elevation || updates.shapes) {
        const oldAnchor = regionUtils.getShapeAnchor(region.shapes[0]);
        genericUtils.setProperty(options, 'cat.oldLocation', {
            oldX: oldAnchor.x,
            oldY: oldAnchor.y,
            oldBottom: region.elevation.bottom,
            oldTop: region.elevation.top
        });
    }
}
export default {
    createRegion,
    updateRegion,
    deleteRegion,
    createWorkflowRegion,
    preCreateRegion,
    preUpdateRegion,
    doRegionMove
};