import {Logging} from '../lib/_module.mjs';
function availableAbilities(wrapped) {
    const abilities = wrapped();
    const catAbilities = this.flags.cat?.abilities;
    if (!catAbilities) return abilities;
    return new Set([...abilities, ...catAbilities]);
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', availableAbilities, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', {force: true});
        libWrapper.unregister('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
    }
}
export default {
    patch
};