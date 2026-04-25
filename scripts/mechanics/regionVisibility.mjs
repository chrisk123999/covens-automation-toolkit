import {regionUtils, workflowUtils} from '../utilities/_module.mjs';
async function regionVisibility(workflow) {
    if (!workflow.item || !workflow.token || !workflow.targets.size || !workflow.activity) return;
    if (!workflowUtils.isAttackType(workflow, 'attack')) return;
    const sourceToken = workflow.token.document;
    const targetToken = workflow.targets.first().document;
    const obscuredRegions = new Set(sourceToken.scene.regions.filter(region => {
        if (!regionUtils.isObscured(region) && !regionUtils.isMagicalDarkness(region)) return;
        const ray = new foundry.canvas.geometry.Ray(sourceToken.object.center, targetToken.object.center);
        return regionUtils.rayIntersectsRegion(region, ray);
    }));
    obscuredRegions.add(...sourceToken.regions.filter(region => regionUtils.isObscured(region) || regionUtils.isMagicalDarkness(region)));
    obscuredRegions.add(...targetToken.regions.filter(region => regionUtils.isObscured(region) || regionUtils.isMagicalDarkness(region)));
    if (!obscuredRegions.size) return;
    const sourceSenses = sourceToken.actor.system.attributes.senses;
    const targetSenses = targetToken.actor.system.attributes.senses;
    //Finish this
}