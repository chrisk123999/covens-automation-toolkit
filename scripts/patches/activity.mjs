import {Logging, constants} from '../lib/_module.mjs';
import {itemUtils} from '../utilities/_module.mjs';
/*
activity.flags.cat.otherAbilities = {
    value: ['wis', 'int']
}
item.flags.cat.alternateAttributes.Ability = [
    {
        value: ['str', 'con'],
        restrictions: {
            Identifier: {
                value: ['itemID', 'itemID|activityID|partID']
            }
            Type: {
                value: ['spell', 'weapon']
            },
            Property: {
                value: ['lgt', 'hvy'],
                requireAll: false
            },
            DamageType: {
                value: ['fire', 'lightning']
            }
        }
    }
]
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
    const allAbilities = wrapped();
    const otherFlag = this.flags?.cat?.otherAbilities;
    if (otherFlag) {
        const resolvedOther = otherFlag.value;
        if (resolvedOther) resolvedOther.forEach(o => allAbilities.add(o));
    }
    if (!this.actor) return new Set(allAbilities);
    const context = {
        activity: this,
        document: this,
        item: this.item,
        actor: this.actor,
        activityIdentifier: this.identifier,
        identifier: this.item.system.identifier,
    };
    const attributeFlagHolders = [
        ...this.actor.itemTypes.feat,
        ...this.actor.itemTypes.equipment
    ];
    attributeFlagHolders.forEach(item => {
        context.sourceItem = item;
        const newAbilities = constants.alternateAttributes.Ability.evaluate(context);
        if (newAbilities?.size) newAbilities.forEach(a => allAbilities.add(a));
    });
    return allAbilities;
}
function getDamageConfig(wrapped, config) {
    const rollConfig = wrapped(config);
    if (!rollConfig || !rollConfig.rolls?.length) return rollConfig;
    const actor = this.actor;
    if (!actor) return rollConfig;
    const context = {
        actor,
        activity: this,
        document: this,
        item: this.item,
        activityIdentifier: this.identifier,
        identifier: this.item.system.identifier,
    };
    rollConfig.rolls.forEach(rollData => {
        if (!rollData.parts) return;
        const rollModifiers = new Set();
        const attributeFlagHolders = [
            ...actor.itemTypes.feat,
            ...actor.itemTypes.equipment
        ];
        context.damage = rollData.options;
        attributeFlagHolders.forEach(item => {
            context.sourceItem = item;
            const newModifiers = constants.alternateAttributes.RollModifier.evaluate(context);
            if (newModifiers?.size) newModifiers.forEach(mod => rollModifiers.add(mod));
        });
        if (rollModifiers.size) {
            rollData.parts = rollData.parts.map(part => {
                const terms = Roll.parse(part, rollData.data);
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