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
        identifier: this.item.system.identifier
    };
    const Ability = constants.alternateAttributes.Ability;
    Ability.getFlagHolders(this.actor).forEach(item => {
        context.sourceItem = item;
        const newAbilities = Ability.evaluate(context);
        if (newAbilities?.size) newAbilities.forEach(a => allAbilities.add(a));
    });
    return allAbilities;
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
function getAttackData(wrapped, ...args) {
    const exit = () => wrapped(args);
    if (!this.actor) return exit();
    if (this.attack.catModified) return exit();
    const sourceClassIdentifier = itemUtils.getSourceClassIdentifier(this.item);
    if (!sourceClassIdentifier) return exit();
    const totalBonus = this.actor.items.reduce((acc, item) => {
        if (!itemUtils.getEquipmentState(item)) return acc;
        const bonus = item.flags.cat?.classAttackBonus?.[sourceClassIdentifier]?.value;
        if (bonus) return acc + bonus;
        return acc;
    }, 0);
    this.attack.bonus ||= '';
    if (totalBonus) {
        this.attack.bonus += ' + ' + totalBonus;
        this.attack.catModified = true;
    }
    return exit();
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', availableAbilities, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData', prepareFinalDataSave, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.activity.AttackActivityData.prototype.getAttackData', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.activity.AttackActivityData.prototype.getAttackData', getAttackData, 'WRAPPER');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.activity.AttackActivityData.prototype.getAttackData');
        libWrapper.unregister('cat', 'dnd5e.dataModels.activity.AttackActivityData.prototype.getAttackData');
    }
}
export default {
    patch
};