import CatRollResolver from '../applications/dice/roll-resolver.mjs';
async function resolveManualRolls(rolls, actor, label) {
    if (!game.settings.get('cat', 'manualRollsEnabled') || !CatRollResolver.shouldForce(actor)) return rolls;
    const newRolls = rolls.map(roll => roll.options.cat?.noManualRoll ? roll : new CONFIG.Dice.DamageRoll(roll.formula, roll.data, roll.options));
    const toRoll = newRolls.filter(roll => !roll.options.cat?.noManualRoll);
    if (!toRoll.length) return rolls;
    await CatRollResolver.fulfillBatch(toRoll, label, {prompt: true});
    for (const roll of toRoll) await roll.evaluate({allowInteractive: false});
    return newRolls;
}
async function manualDamageRolls(workflow) {
    if (!game.settings.get('cat', 'manualRollsEnabled') || !workflow.damageRolls?.length) return;
    if (!workflow.hitTargets?.size && !game.settings.get('cat', 'manualRollsPromptOnMiss')) return;
    const label = workflow.item?.name ? (workflow.item.name + ' — ' + (workflow.activity?.name ?? '')).trim() : undefined;
    const newRolls = await resolveManualRolls(workflow.damageRolls, workflow.actor, label);
    if (newRolls !== workflow.damageRolls) await workflow.setDamageRolls(newRolls);
}
export default {
    manualDamageRolls,
    resolveManualRolls
};
