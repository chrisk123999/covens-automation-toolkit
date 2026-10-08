import {Logging, constants} from '../lib/_module.mjs';
import {actorUtils, itemUtils} from '../utilities/_module.mjs';
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
    const [_, sourceClassIdentifier] = itemUtils.getAdvancementSourceKey(this.item)?.split(':') ?? [];
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
    const [_, sourceClassIdentifier] = itemUtils.getAdvancementSourceKey(this.item)?.split(':') ?? [];
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
function checkSaveAbility(wrapped) {
    const data = this[this.type];
    if (data.dc.calculation in CONFIG.DND5E.abilities) return data.dc.calculation;
    if (data.dc.calculation === 'spellcasting') return this.spellcastingAbility;
    const available = availableAbilities.apply(this, [() => this.item.system.availableAbilities ?? new Set()]);
    if (!available) return defaultCheckSaveAbility(this.type, data);
    if (available.size === 1) return available.first();
    return this.actor ? actorUtils.getBestAbility(this.actor, Array.from(available)) : defaultCheckSaveAbility(this.type, data);
}
function defaultCheckSaveAbility(type, data) {
    return (type === 'check' ? data.ability : data.ability.first()) ?? null;
}
const patches = [
    {path: 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', fn: availableAbilities,   wrapType: 'MIXED'},
    {path: 'dnd5e.dataModels.activity.SaveActivityData.prototype.ability',         fn: checkSaveAbility,     wrapType: 'OVERRIDE'},
    {path: 'dnd5e.dataModels.activity.CheckActivityData.prototype.ability',        fn: checkSaveAbility,     wrapType: 'OVERRIDE'},
    {path: 'dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData',     fn: prepareFinalDataSave, wrapType: 'WRAPPER'},
    {path: 'dnd5e.dataModels.activity.AttackActivityData.prototype.getAttackData', fn: getAttackData,        wrapType: 'WRAPPER'}
];
function patch(enabled) {
    if (enabled) {
        for (const entry of patches) {
            Logging.addEntry('DEBUG', 'Patching: ' + entry.path, {force: true});
            libWrapper.register('cat', entry.path, entry.fn, entry.wrapType);
        }
    } else {
        for (const entry of patches) {
            Logging.addEntry('DEBUG', 'Unpatching: ' + entry.path, {force: true});
            libWrapper.unregister('cat', entry.path);
        }
    }
}
export default {
    patch
};