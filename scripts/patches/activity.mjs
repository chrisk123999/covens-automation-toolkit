import {Logging} from '../lib/_module.mjs';
import {default as dataModel} from './dataModel.mjs';
import {automationUtils, itemUtils} from '../utilities/_module.mjs';
/*
activity.flags.cat.otherAbilities = {
    value: ['wis', 'int']
}
item.flags.cat.alternateAbilities = {
    exampleIdentifier: {
        value: ['str', 'con']
    }
}
item.flags.cat.classDifficultyClass = {
    wizard: {
        value: 1
    }
}
item.flags.cat.classAttackBonus = {
    wizard: {
        value: 1
    }    
}
*/
function availableAbilities(wrapped) {
    const targetItem = this.item;
    const allAbilities = [...wrapped()];
    const otherFlag = this.flags?.cat?.otherAbilities;
    if (otherFlag) {
        const resolvedOther = otherFlag.value;
        if (resolvedOther) allAbilities.push(...resolvedOther);
    }
    if (!this.actor) return new Set(allAbilities); 
    const identifier = targetItem?.system?.identifier;
    this.actor.items.forEach(item => {
        if (item.type != 'feat') return;
        const altFlag = item.flags?.cat?.alternateAbilities?.[identifier];
        if (altFlag) {
            const resolvedAlt = altFlag.value;
            if (resolvedAlt) allAbilities.push(...resolvedAlt);
        }
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
    rollConfig.rolls.forEach(rollData => {
        if (!rollData.parts) return;
        const rollModifiers = new Set();
        actor.items.forEach(item => {
            if (item.type != 'feat') return;
            const modifiersList = item.flags.cat?.rollModifiers;
            if (modifiersList) {
                modifiersList.forEach(modDef => {
                    if (dataModel.isValidModifier(modDef, targetItem, identifier, {rollData}) && modDef.modifiers) {
                        modDef.modifiers.forEach(m => rollModifiers.add(m));
                    }
                });
            }
        });
        if (rollModifiers.size) {
            rollData.parts = rollData.parts.map(part => {
                const terms = Roll.parse(part);
                terms.forEach(term => {
                    if (term.modifiers) {
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
function prepareFinalDataSave(wrapped, ...args) {
    wrapped.apply(this, args);
    if (!this.actor || !this.save?.dc?.value) return;
    const sourceClassIdentifier = itemUtils.getSourceClassIdentifier(this.item);
    if (!sourceClassIdentifier) return;
    const totalBonus = this.actor.items.reduce((acc, item) => {
        if (!itemUtils.getEquipmentState(item)) return acc;
        const bonus = item.flags.cat?.classDifficultyClass?.[sourceClassIdentifier]?.value;
        if (bonus) return acc + bonus;
        return acc;
    }, 0);
    this.save.dc.value += totalBonus;
}
function prepareFinalDataAttack(wrapped, ...args) {
    wrapped.apply(this, args);
    if (!this.actor) return;
    const sourceClassIdentifier = itemUtils.getSourceClassIdentifier(this.item);
    if (!sourceClassIdentifier) return;
    const totalBonus = this.actor.items.reduce((acc, item) => {
        if (!itemUtils.getEquipmentState(item)) return acc;
        const bonus = item.flags.cat?.classAttackBonus?.[sourceClassIdentifier]?.value;
        if (bonus) return acc + bonus;
        return acc;
    }, 0);
    if (totalBonus) this.attack.bonus += ' + ' + totalBonus;
}
const activityTypes = [
    'AttackActivity',
    'DamageActivity',
    'SaveActivity',
    'HealActivity'
];
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', availableAbilities, 'MIXED');
        activityTypes.forEach(type => {
            Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.' + type + '.prototype.getDamageConfig', {force: true});
            libWrapper.register('cat', 'dnd5e.documents.activity.' + type + '.prototype.getDamageConfig', getDamageConfig, 'WRAPPER');
        });
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData', prepareFinalDataSave, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.AttackActivity.prototype.prepareFinalData', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.AttackActivity.prototype.prepareFinalData', prepareFinalDataAttack, 'WRAPPER');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
        activityTypes.forEach(type => {
            Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.' + type + '.prototype.getDamageConfig');
            libWrapper.unregister('cat', 'dnd5e.documents.activity.' + type + '.prototype.getDamageConfig');
        });
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.AttackActivity.prototype.prepareFinalData');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.AttackActivity.prototype.prepareFinalData');
    }
}
export default {
    patch
};