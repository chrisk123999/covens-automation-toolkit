import {rollUtils} from '../utilities/_module.mjs';
async function manualDamageRolls(workflow) {
    if (!game.settings.get('cat', 'manualRollsEnabled') || !workflow.damageRolls?.length) return;
    if (!workflow.hitTargets?.size && !game.settings.get('cat', 'manualRollsPromptOnMiss')) return;
    const label = workflow.item?.name ? (workflow.item.name + ' — ' + (workflow.activity?.name ?? '')).trim() : undefined;
    for (const roll of workflow.damageRolls) {
        const source = roll.options.cat?.source || roll.options.flavor || workflow.item?.name;
        if (source) roll.options.cat = {...roll.options.cat, source};
    }
    const newRolls = await rollUtils.resolveManualRolls(workflow.damageRolls, workflow.actor, label);
    if (newRolls !== workflow.damageRolls) await workflow.setDamageRolls(newRolls);
}
export default {
    manualDamageRolls
};
