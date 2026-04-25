import constants from '../lib/constants.mjs';
function getActionType(workflow) {
    if (!workflow.activity) return;
    return workflow.activity.getActionType(workflow.attackMode);
}
function isAttackType(workflow, type = 'attack') {
    if (!workflow.activity) return;
    let field;
    switch (type) {
        case 'attack': field = 'attacks'; break;
        case 'meleeAttack': field = 'meleeAttacks'; break;
        case 'rangedAttack': field = 'rangedAttacks'; break;
        case 'weaponAttack': field = 'weaponAttacks'; break;
        case 'spellAttack': field = 'spellAttacks'; break;
        case 'rangedWeaponAttack': field = 'rangedWeaponAttacks'; break;
        case 'meleeWeaponAttack': field = 'meleeWeaponAttacks'; break;
        case 'rangedSpellAttack': field = 'rangedSpellAttacks'; break;
        case 'meleeSpellAttack': field = 'meleeSpellAttacks'; break;
        default: return;
    }
    return constants[field].includes(getActionType(workflow));
}
export default {
    getActionType,
    isAttackType
};