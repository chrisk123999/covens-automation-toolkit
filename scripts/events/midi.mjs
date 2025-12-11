import {constants, Events} from '../lib.mjs';
async function preTargeting({activity, token, config, dialog, message}) {
    let event = await new Events.PreTargetingWorkflowEvent(constants.workflowPasses.preTargeting, {activity, token, config, dialog, message}).run();
    if (event) return false;
}
async function preItemRoll(workflow) {
    let event = await new Events.WorkflowEvent(constants.workflowPasses.preItemRoll, workflow).run();
    if (event) return false;
}
async function preambleComplete(workflow) {
    let event = await new Events.WorkflowEvent(constants.workflowPasses.targeting, workflow).run();
    if (event) return;
    event = await new Events.WorkflowEvent(constants.workflowPasses.preambleComplete, workflow).run();
    if (event) return false;
}
async function postAttackRoll(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.attackRoll, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.attackRollBonuses, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.attackRollMissedBonuses, workflow).run();
}
async function attackRollComplete(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.attackRollComplete, workflow).run();
}
async function savesComplete(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.savesComplete, workflow).run();
}
async function damageRollComplete(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.damageRoll, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.damageRollBonuses, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.damageRollComplete, workflow).run();
}
async function utilityRollComplete(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.utilityRoll, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.utilityRollBonuses, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.utilityRollComplete, workflow).run();
}
async function preTargetDamageApplication(token, {workflow, ditem}) {
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamage, workflow, token, ditem).run();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamageBonuses, workflow, token, ditem).run();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamageFlatReductions, workflow, token, ditem).run();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamagePercentReductions, workflow, token, ditem).run();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.targetDamageComplete, workflow, token, ditem).run();
}
async function rollFinished(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.rollFinished, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.onHit, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.cleanup, workflow).run();
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