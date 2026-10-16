import {regionUtils, workflowUtils} from '../utilities/_module.mjs';
function crossedRegions(workflow, target, mode) {
    const sourceToken = workflow.token.document;
    return sourceToken.parent.regions.filter(region => region.flags.cat?.rangedAttacks === mode && regionUtils.isBetweenTokens(region, sourceToken, target.document));
}
function isRangedWeaponAttack(workflow) {
    return !!workflow.token && !!workflow.targets.size && workflowUtils.isAttackType(workflow, 'rangedWeaponAttack');
}
/**
 * Impose disadvantage on ranged weapon attacks passing through regions with `flags.cat.rangedAttacks` set to `disadvantage`.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 */
function config(workflow) {
    if (!isRangedWeaponAttack(workflow)) return;
    workflow.targets.forEach(target => crossedRegions(workflow, target, 'disadvantage').forEach(region => workflow.tracker.disadvantage.add(region.id, region.name)));
}
/**
 * Make ranged weapon attacks passing through regions with `flags.cat.rangedAttacks` set to `miss` miss their target.
 * @param {MidiQOL.Workflow} workflow Workflow in progress.
 */
function complete(workflow) {
    if (!isRangedWeaponAttack(workflow)) return;
    workflow.hitTargets.forEach(target => {
        if (crossedRegions(workflow, target, 'miss').length) workflow.hitTargets.delete(target);
    });
}
export default {
    config,
    complete
};
