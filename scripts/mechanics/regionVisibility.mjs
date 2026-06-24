import {genericUtils, regionUtils, tokenUtils, workflowUtils} from '../utilities/_module.mjs';
export async function regionVisibility(workflow) {
    if (!workflow.item || !workflow.token || !workflow.targets.size || !workflow.activity) return;
    if (!workflowUtils.isAttackType(workflow, 'attack')) return;
    const sourceToken = workflow.token.document;
    const targetToken = workflow.targets.first().document;
    function isHindering(region) {
        return regionUtils.isObscured(region) || regionUtils.isMagicalDarkness(region);
    }
    const ray = new foundry.canvas.geometry.Ray(sourceToken.object.center, targetToken.object.center);
    const obscuredRegions = new Set([
        ...sourceToken.scene.regions.filter(r => isHindering(r) && regionUtils.rayIntersectsRegion(r, ray)),
        ...sourceToken.regions.filter(isHindering),
        ...targetToken.regions.filter(isHindering)
    ]);
    if (!obscuredRegions.size) return;
    const distance = tokenUtils.getDistance(sourceToken, targetToken, {wallsBlock: false, checkCover: false});
    function checkVision(token, senses, region) {
        if (region.flags.cat?.canSeeTokens?.includes(token.uuid)) return true;
        if (senses.tremorsense >= distance || senses.blindsight >= distance || senses.truesight >= distance) return true;
        const isObscured = regionUtils.isObscured(region);
        const isMagDarkness = regionUtils.isMagicalDarkness(region);
        if (isMagDarkness && !isObscured && distance <= senses.devilsSight) return true;
        return false;
    };
    const sourceSenses = sourceToken.actor.system.attributes.senses.ranges;
    const targetSenses = targetToken.actor.system.attributes.senses.ranges;
    obscuredRegions.forEach(region => {
        if (!checkVision(sourceToken, sourceSenses, region)) {
            workflow.flankingAdvantage = false;
            workflow.tracker.disadvantage.add(region.name, _loc('CAT.Region.AttackerCantSeeTarget'));
        }
        if (!checkVision(targetToken, targetSenses, region)) {
            workflow.tracker.advantage.add(region.name, _loc('CAT.Region.TargetCantSeeAttacker'));
        }
    });
}