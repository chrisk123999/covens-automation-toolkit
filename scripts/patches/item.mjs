import {Logging} from '../lib/_module.mjs';
import {itemUtils} from '../utilities/_module.mjs';
function prepareFinalAttributes(wrapped, ...args) {
    wrapped.apply(this, args);
    if (this.type !== 'class') return;
    if (!this.actor) return;
    if (!this.actor || !this.system.spellcasting?.save) return;
    const classIdentifier = this.identifier;
    const bonuses = this.actor.items.reduce((acc, item) => {
        if (!itemUtils.getEquipmentState(item)) return acc;
        const dcBonus = item.flags.cat?.classDifficultyClass?.[classIdentifier]?.value;
        if (Number.isFinite(dcBonus)) acc.dc += dcBonus;
        const attackBonus = item.flags.cat?.classAttackBonus?.[classIdentifier]?.value;
        if (Number.isFinite(attackBonus)) acc.attack += attackBonus;
        return acc;
    }, {dc: 0, attack: 0});
    if (bonuses.dc !== 0) this.system.spellcasting.save += bonuses.dc;
    if (bonuses.attack !== 0) this.system.spellcasting.attack += bonuses.attack;
}
function masteryOptions(wrapped) {
    const options = wrapped();
    if (!options || !this.type.value?.startsWith('advanced') || !game.settings.get('cat', 'advancedWeaponProficiency')) return options;
    return this.parent.actor.items.some(item => item.system.identifier === 'advanced-weapon-proficiency') ? options : null;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.Item5e.prototype.prepareFinalAttributes', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.Item5e.prototype.prepareFinalAttributes', prepareFinalAttributes, 'WRAPPER');
        libWrapper.register('cat', 'dnd5e.dataModels.item.WeaponData.prototype.masteryOptions', masteryOptions, 'WRAPPER');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.Item5e.prototype.prepareFinalAttributes');
        libWrapper.unregister('cat', 'dnd5e.documents.Item5e.prototype.prepareFinalAttributes');
        libWrapper.unregister('cat', 'dnd5e.dataModels.item.WeaponData.prototype.masteryOptions');
    }
}
export default {
    patch
};
