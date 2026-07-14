import {constants, Events} from '../lib/_module.mjs';
import {actorUtils, dialogUtils, workflowUtils} from '../utilities/_module.mjs';
export async function smite(workflow) {
    if (!workflowUtils.isAttackType(workflow, 'attack')) return;
    if (actorUtils.hasUsedBonusAction(workflow.actor)) return;
    const smites = (await new Events.WorkflowEvent(constants.workflowPasses.smite, workflow).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    if (!smites.length) return;
    const selection = await dialogUtils.selectDocumentDialog('CAT.Smite.Title', 'CAT.Smite.Context', smites.map(i => i.document), {displayTooltips: true, sort: 'alphabetical', showSpellLevel: true, showUses: true, addNoneDocument: true});
    if (!selection) return;
    const smite = smites.find(i => i.document.uuid === selection.uuid);
    if (!smite) return;
    const smiteWorkflow = await workflowUtils.completeItemUse(selection, Array.from(workflow.targets).map(token => token.document));
    if (!smiteWorkflow) return;
    if (smite.use) await smite.use({attackWorkflow: workflow, smiteWorkflow});
}