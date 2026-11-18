import {rollUtils} from '../utilities/_module.mjs';
async function manualDamageRolls(workflow) {
    if (!game.settings.get('cat', 'manualRollsEnabled') || !workflow.damageRolls?.length) return;
    if (!workflow.hitTargets?.count && !game.settings.get('cat', 'manualRollsPromptOnMiss')) return;
    const label = workflow.item?.name ? (workflow.item.name + ' - ' + (workflow.activity?.name ?? '')).trim() : undefined;
    const rollType = workflow.activity?.type === 'heal' ? 'heal' : 'damage';
    for (const roll of workflow.damageRolls) {
        const source = roll.options.cat?.source || roll.options.flavor || workflow.item?.name;
        roll.options.cat = {...roll.options.cat, rollType, critical: !!workflow.isCritical, ...(source ? {source} : {})};
        roll.options.workflowId ??= workflow.id;
    }
    const newRolls = await rollUtils.resolveManualRolls(workflow.damageRolls, workflow.actor, label);
    if (newRolls !== workflow.damageRolls) await workflow.setDamageRolls(newRolls);
}
export default {
    manualDamageRolls
};
