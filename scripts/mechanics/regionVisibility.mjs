import {genericUtils, regionUtils, tokenUtils, workflowUtils} from '../utilities/_module.mjs';
export async function regionVisibility(workflow) {
    if (!workflow.item || !workflow.token || !workflow.targets.size || !workflow.activity) return;
    if (!workflowUtils.isAttackType(workflow, 'attack')) return;
    const sourceToken = workflow.token.document;
    const targetToken = workflow.targets.first().document;
    const isHindering = (region) => regionUtils.isObscured(region) || regionUtils.isMagicalDarkness(region);
    const ray = new foundry.canvas.geometry.Ray(sourceToken.object.center, targetToken.object.center);
    const intersectingRegions = sourceToken.scene.regions.filter(r => isHindering(r) && regionUtils.rayIntersectsRegion(r, ray));
    const sourceRegions = sourceToken.regions.filter(isHindering);
    const targetRegions = targetToken.regions.filter(isHindering);
    const obscuredRegions = new Set([...intersectingRegions, ...sourceRegions, ...targetRegions]);
    if (!obscuredRegions.size) return;
    const distance = tokenUtils.getDistance(sourceToken, targetToken, {wallsBlock: false, checkCover: false});
    const getMagicalDarkness = (token) => token.actor.flags.cat?.senses?.magicalDarkness ?? 0;
    const checkVision = (token, senses, darkVisionDist, region) => {
        const canSeeTokens = region.flags.cat?.canSeeTokens ?? [];
        if (canSeeTokens.includes(token.uuid)) return true;
        if (senses.tremorsense >= distance || senses.blindsight >= distance || senses.truesight >= distance) return true;
        const obscured = regionUtils.isObscured(region);
        const magicalDarkness = regionUtils.isMagicalDarkness(region);
        if (magicalDarkness && !obscured && distance <= darkVisionDist) return true;
        return false;
    };
    const sourceSenses = sourceToken.actor.system.attributes.senses;
    const targetSenses = targetToken.actor.system.attributes.senses;
    const sourceDarknessVal = getMagicalDarkness(sourceToken);
    const targetDarknessVal = getMagicalDarkness(targetToken);
    obscuredRegions.forEach(region => {
        const sourceCanSeeTarget = checkVision(sourceToken, sourceSenses, sourceDarknessVal, region);
        const targetCanSeeSource = checkVision(targetToken, targetSenses, targetDarknessVal, region);
        if (!sourceCanSeeTarget) {
            workflow.flankingAdvantage = false;
            workflow.tracker.disadvantage.add(region.name, genericUtils.translate('CAT.Region.AttackerCantSeeTarget'));
        }
        if (!targetCanSeeSource) {
            workflow.tracker.advantage.add(region.name, genericUtils.translate('CAT.Region.TargetCantSeeAttacker'));
        }
    });
}