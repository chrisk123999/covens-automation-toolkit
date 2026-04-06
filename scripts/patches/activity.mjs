import {Logging} from '../lib/_module.mjs';
import {actorUtils} from '../utilities/_module.mjs';
function getRollData(wrapped, options) {
    const rollData = wrapped(options);
    const abilities = this.flags.cat?.abilities;
    if (!abilities || !this.actor) return rollData;
    const bestAbility = actorUtils.getBestAbility(this.actor, [this.ability, ...abilities]);
    rollData.mod = this.actor?.system.abilities?.[bestAbility]?.mod ?? 0;
    return rollData;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.AttackActivity.prototype.getRollData');
        libWrapper.register('cat', 'dnd5e.documents.activity.AttackActivity.prototype.getRollData', getRollData, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.AttackActivity.prototype.getRollData');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.AttackActivity.prototype.getRollData');
    }
}
export default {
    patch
};