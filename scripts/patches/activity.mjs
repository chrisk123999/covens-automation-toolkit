import {Logging} from '../lib/_module.mjs';
function availableAbilities(wrapped) {
    const baseAbilities = wrapped();
    if (!this.actor) return baseAbilities;
    const allAbilities = [...baseAbilities];
    const identifier = this.item.system.identifier;
    this.actor.items.forEach(item => {
        const abilities = item.flags.cat?.alternateAbilities?.[identifier];
        if (abilities) allAbilities.push(...abilities);
    });
    return new Set(allAbilities);
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', availableAbilities, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
    }
}
export default {
    patch
};