function preItemRoll(workflow) {
    workflow.workflowOptions.damageRollDSN = false;
}
async function damageRollComplete(workflow) {
    const damageRolls = [...workflow.damageRolls, ...(workflow.bonusDamageRolls ?? []), ...(workflow.otherDamageRolls ?? [])];
    await MidiQOL.displayDSNForRoll(damageRolls, 'damageRoll');
}
export default {
    preItemRoll,
    damageRollComplete
};