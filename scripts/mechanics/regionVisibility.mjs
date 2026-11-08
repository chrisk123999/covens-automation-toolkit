import {actorUtils, distanceUtils, regionUtils, tokenUtils, workflowUtils} from '../utilities/_module.mjs';
export async function regionVisibility(workflow) {
    if (!workflow.item || !workflow.token || !workflow.targets.size || !workflow.activity) return;
    if (!workflowUtils.isAttackType(workflow, 'attack')) return;
    const sourceToken = workflow.token.document;
    const targetToken = workflow.targets.first().document;
    function isHindering(region) {
        return regionUtils.isObscured(region) || regionUtils.isMagicalDarkness(region);
    }
    const obscuredRegions = new Set([
        ...sourceToken.scene.regions.filter(r => isHindering(r) && regionUtils.isBetweenTokens(r, sourceToken, targetToken)),
        ...sourceToken.regions.filter(isHindering),
        ...targetToken.regions.filter(isHindering)
    ]);
    if (!obscuredRegions.size) return;
    const distance = tokenUtils.getDistance(sourceToken, targetToken, {wallsBlock: false, checkCover: false});
    function checkVision(token, region) {
        if (region.flags.cat?.canSeeTokens?.includes(token.uuid)) return true;
        const within = sense => {
            const range = actorUtils.getSense(token.actor, sense);
            return range > 0 && distanceUtils.isWithinRange(sourceToken.parent, distance, range);
        };
        if (['tremorsense', 'blindsight', 'truesight'].some(within)) return true;
        const isObscured = regionUtils.isObscured(region);
        const isMagDarkness = regionUtils.isMagicalDarkness(region);
        if (isMagDarkness && !isObscured && within('devilsSight')) return true;
        return false;
    };
    obscuredRegions.forEach(region => {
        if (!checkVision(sourceToken, region)) {
            workflow.flankingAdvantage = false;
            workflow.tracker.disadvantage.add(region.name, _loc('CAT.Region.AttackerCantSeeTarget'));
        }
        if (!checkVision(targetToken, region)) {
            workflow.tracker.advantage.add(region.name, _loc('CAT.Region.TargetCantSeeAttacker'));
        }
    });
}
