import {constants, Events} from '../lib/_module.mjs';
import {regionUtils, workflowUtils} from '../utilities/_module.mjs';
/**
 * The point a workflow's damage comes from: the centre of its placed area, otherwise its token.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @returns {{x: number, y: number}|undefined}
 */
function getOrigin(workflow) {
    const area = workflow.template ? regionUtils.getArea(workflow.template) : undefined;
    if (area) return {x: area.x, y: area.y};
    return workflow.token?.center ?? workflow.token?.document?.getCenterPoint();
}
/**
 * Scale damage that passes through regions with `flags.cat.damageThrough`, a map of damage type to multiplier, then run each crossed region's `damageThrough` pass.
 * @param {foundry.canvas.placeables.Token} token Target taking the damage.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 * @param {object} ditem Midi damage item for the target.
 */
export async function regionDamage(token, workflow, ditem) {
    const origin = getOrigin(workflow);
    const scene = token?.document?.parent ?? token?.parent;
    if (!origin || !scene || !ditem?.damageDetail?.length) return;
    const target = token.center ?? token.object?.center;
    const types = new Set(ditem.damageDetail.filter(detail => detail.value > 0).map(detail => detail.type));
    const regions = scene.regions.filter(region => region.flags.cat?.damageThrough && regionUtils.getIntersections(region, origin, target, true));
    for (const region of regions) {
        for (const [type, multiplier] of Object.entries(region.flags.cat.damageThrough)) {
            const dealt = ditem.damageDetail.filter(detail => detail.type === type).reduce((total, detail) => total + detail.value, 0);
            if (dealt > 0 && multiplier < 1) workflowUtils.modifyDamageAppliedFlat(ditem, -Math.ceil(dealt * (1 - multiplier)), {type});
        }
        await new Events.RegionEvent([region], constants.regionPasses.damageThrough, {workflow, options: {token, origin, target, types: [...types]}}).run();
    }
}
