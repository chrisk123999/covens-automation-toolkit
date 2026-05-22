import {Logging} from '../lib/_module.mjs';
function availableAbilities(wrapped) {
    const otherAbilities = this.flags?.cat?.otherAbilities ?? [];
    const allAbilities = [...wrapped(), ...otherAbilities];
    if (!this.actor) return new Set(allAbilities); 
    const identifier = this.item?.system?.identifier;
    this.actor.items.forEach(item => {
        const abilities = item.flags?.cat?.alternateAbilities?.[identifier];
        if (abilities) allAbilities.push(...abilities);
    });
    return new Set(allAbilities);
}
function getDamageConfig(wrapped, config) {
    const rollConfig = wrapped(config);
    if (!rollConfig || !rollConfig.rolls?.length) return rollConfig;
    const targetItem = this.item;
    const actor = this.actor;
    if (!actor) return rollConfig;
    const identifier = targetItem.system.identifier + '|' + this.identifier;
    const rollModifiers = [];
    for (const item of actor.items) {
        const modGroup = item.flags.cat?.rollModifiers;
        if (modGroup) {
            const modFlagId = modGroup.byIdentifier?.[identifier];
            if (modFlagId) rollModifiers.push(...modFlagId);
            const modFlagType = modGroup.byType?.[targetItem.type];
            if (modFlagType) rollModifiers.push(...modFlagType);
        }
    }
    if (!rollModifiers.length) return rollConfig;
    rollConfig.rolls.forEach(rollData => {
        if (rollData.parts && Array.isArray(rollData.parts)) {
            rollData.parts = rollData.parts.map(part => {
                const terms = Roll.parse(part);
                terms.forEach(term => {
                    if (term.modifiers && Array.isArray(term.modifiers)) {
                        rollModifiers.forEach(mod => {
                            if (!term.modifiers.includes(mod)) term.modifiers.push(mod);
                        });
                    }
                });
                return Roll.getFormula(terms);
            });
        }
    });
    return rollConfig;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', availableAbilities, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.AttackActivity.prototype.getDamageConfig', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.AttackActivity.prototype.getDamageConfig', getDamageConfig, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.DamageActivity.prototype.getDamageConfig', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.DamageActivity.prototype.getDamageConfig', getDamageConfig, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.SaveActivity.prototype.getDamageConfig', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.SaveActivity.prototype.getDamageConfig', getDamageConfig, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.HealActivity.prototype.getDamageConfig', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.HealActivity.prototype.getDamageConfig', getDamageConfig, 'WRAPPER');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.AttackActivity.prototype.getDamageConfig');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.AttackActivity.prototype.getDamageConfig');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.DamageActivity.prototype.getDamageConfig');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.DamageActivity.prototype.getDamageConfig');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.SaveActivity.prototype.getDamageConfig');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.SaveActivity.prototype.getDamageConfig');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.HealActivity.prototype.getDamageConfig');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.HealActivity.prototype.getDamageConfig');
    }
}
export default {
    patch
};