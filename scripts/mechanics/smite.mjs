import {constants, Events} from '../lib/_module.mjs';
import {actorUtils, workflowUtils} from '../utilities/_module.mjs';
export async function smite(workflow) {
    if (!workflowUtils.isAttackType(workflow, 'attack')) return;
    if (actorUtils.hasUsedBonusAction(workflow.actor)) return;
    const smites = new Events.WorkflowEvent(constants.workflowPasses.smite, workflow).run({multiResult: true, canOverlap: true});
    if (!smites.length) return;

}