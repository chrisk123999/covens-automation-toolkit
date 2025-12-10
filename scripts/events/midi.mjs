import {constants, Events} from '../lib.mjs';
async function preTargeting({activity, token, config, dialog, message}) {
    let event = await new Events.PreTargetingWorkflowEvent(constants.workflowPasses.preTargeting, {activity, token, config, dialog, message}).execute();
    if (event) return false;
}
async function preItemRoll(workflow) {
    let event = await new Events.WorkflowEvent(constants.workflowPasses.preItemRoll, workflow).execute();
    if (event) return false;
}
async function preambleComplete(workflow) {
    let event = await new Events.WorkflowEvent(constants.workflowPasses.targeting, workflow).execute();
    if (event) return;
    event = await new Events.WorkflowEvent(constants.workflowPasses.preambleComplete, workflow).execute();
    if (event) return false;
}
async function postAttackRoll(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.attackRoll, workflow).execute();
    await new Events.WorkflowEvent(constants.workflowPasses.attackRollBonuses, workflow).execute();
    await new Events.WorkflowEvent(constants.workflowPasses.attackRollMissedBonuses, workflow).execute();
}
async function attackRollComplete(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.attackRollComplete, workflow).execute();
}
async function savesComplete(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.savesComplete, workflow).execute();
}
async function damageRollComplete(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.damageRoll, workflow).execute();
    await new Events.WorkflowEvent(constants.workflowPasses.damageRollBonuses, workflow).execute();
    await new Events.WorkflowEvent(constants.workflowPasses.damageRollComplete, workflow).execute();
}
async function utilityRollComplete(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.utilityRoll, workflow).execute();
    await new Events.WorkflowEvent(constants.workflowPasses.utilityRollBonuses, workflow).execute();
    await new Events.WorkflowEvent(constants.workflowPasses.utilityRollComplete, workflow).execute();
}
async function preTargetDamageApplication(token, {workflow, ditem}) {
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamage, workflow, token, ditem).execute();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamageBonuses, workflow, token, ditem).execute();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamageFlatReductions, workflow, token, ditem).execute();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamagePercentReductions, workflow, token, ditem).execute();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamageComplete, workflow, token, ditem).execute();
}
async function rollFinished(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.rollFinished, workflow).execute();
    await new Events.WorkflowEvent(constants.workflowPasses.onHit, workflow).execute();
    await new Events.WorkflowEvent(constants.workflowPasses.cleanup, workflow).execute();
}
export const midiEvents = {
    preTargeting,
    preItemRoll,
    preambleComplete,
    postAttackRoll,
    attackRollComplete,
    savesComplete,
    damageRollComplete,
    utilityRollComplete,
    preTargetDamageApplication,
    rollFinished
};