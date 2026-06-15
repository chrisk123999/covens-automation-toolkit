import {constants, Events} from '../lib/_module.mjs';
import {regionVisibility} from '../mechanics/regionVisibility.mjs';
import specialDuration from '../mechanics/specialDuration.mjs';
import {diceSoNice} from '../integration/_modules.mjs';
import CatRollResolver from '../applications/dice/roll-resolver.mjs';
async function manualDamageRolls(workflow) {
    if (!game.settings.get('cat', 'manualRollsEnabled') || !workflow.damageRolls?.length) return;
    if (!workflow.hitTargets?.size && !game.settings.get('cat', 'manualRollsPromptOnMiss')) return;
    if (!CatRollResolver.shouldForce(workflow.actor)) return;
    const newRolls = workflow.damageRolls.map(roll => new CONFIG.Dice.DamageRoll(roll.formula, roll.data, roll.options));
    const label = workflow.item?.name ? `${workflow.item.name} — ${workflow.activity?.name ?? ''}`.trim() : undefined;
    await CatRollResolver.fulfillBatch(newRolls, label, {prompt: true});
    for (const roll of newRolls) await roll.evaluate({allowInteractive: false});
    await workflow.setDamageRolls(newRolls);
}
async function preTargeting({activity, token, config, dialog, message}) {
    let event = await new Events.PreTargetingWorkflowEvent(constants.workflowPasses.preTargeting, {activity, token, config, dialog, message}).run();
    if (event) return false;
}
async function preItemRoll(workflow) {
    if (game.settings.get('cat', 'diceSoNice') && game.modules.get('dice-so-nice')?.active) diceSoNice.preItemRoll(workflow);
    let event = await new Events.WorkflowEvent(constants.workflowPasses.preItemRoll, workflow).run();
    if (event) return false;
}
async function preambleComplete(workflow) {
    let event = await new Events.WorkflowEvent(constants.workflowPasses.targeting, workflow).run();
    if (event) return;
    event = await new Events.WorkflowEvent(constants.workflowPasses.preambleComplete, workflow).run();
    if (event) return false;
}
async function attackRollConfig(workflow) {
    await regionVisibility(workflow);
    await new Events.WorkflowEvent(constants.workflowPasses.attackRollConfig, workflow).run();
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
    await manualDamageRolls(workflow);
    if (game.settings.get('cat', 'diceSoNice') && game.modules.get('dice-so-nice')?.active) await diceSoNice.damageRollComplete(workflow);
}
async function utilityRollComplete(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.utilityRoll, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.utilityRollBonuses, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.utilityRollComplete, workflow).run();
}
async function preTargetDamageApplication(token, {workflow, ditem}) {
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.damage, workflow, token, ditem).run();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.damageBonuses, workflow, token, ditem).run();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.damageFlatReductions, workflow, token, ditem).run();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.damagePercentReductions, workflow, token, ditem).run();
    await new Events.TokenDamageWorkflowEvent(constants.workflowPasses.damageComplete, workflow, token, ditem).run();
}
async function rollFinished(workflow) {
    await new Events.WorkflowEvent(constants.workflowPasses.rollFinished, workflow).run();
    await new Events.WorkflowEvent(constants.workflowPasses.onHit, workflow).run();
    await specialDuration.specialDuration(workflow);
    await new Events.WorkflowEvent(constants.workflowPasses.cleanup, workflow).run();
    console.log(workflow);
}
export default {
    preTargeting,
    preItemRoll,
    preambleComplete,
    attackRollConfig,
    postAttackRoll,
    attackRollComplete,
    savesComplete,
    damageRollComplete,
    utilityRollComplete,
    preTargetDamageApplication,
    rollFinished
};