import {constants, Logging} from '../lib/_module.mjs';
import {actorUtils} from '../utilities/_module.mjs';
const Roll = foundry.dice.Roll;
/*
item.flags.cat.alternateAttributes = {
    RollModifier: [
        {
            value: ['x', 'min2'],
            restrictions: {
                Identifier: {
                    value: ['example', 'itemID|activityID|partID']
                }
                Type: {
                    value: ['spell', 'weapon']
                },
                Property: {
                    value: ['verbal', 'material'],
                    requireAll: false
                },
                School: {
                    value: ['evocation', 'necromancy']
                },
                Level: {
                    value: [1, 2, 3]
                },
                Ability: {
                    value: ['int', 'wis']
                },
                Method: {
                    value: ['spell', 'atwill']
                },
                DamageType: {
                    value: ['fire', 'lightning']
                }
            }
        },
        {
            value: ['min10'],
            restrictions: {
                ...
            }
        }
    ],
    DamageFormula: [ 
        {
            value: '1d8 + @mod',
            restrictions: {
                ... same options as roll modifier
            }
        },
        {
            value: '2d4 + @mod',
            restrictions: {
                ...
            }
        }
    ]
}
*/
function rollData({activity, document, item}) {
    const data = document?.getRollData();
    if (!data) return;
    const ability = activity?.ability || item?.abilityMod;
    if (ability) data.mod = data.abilities[ability]?.mod ?? 0;
    return data;
}
function formula(wrapped) {
    const parent = this.parent;
    if (!parent) return wrapped();
    let context;
    if (parent.documentName === 'Activity') {
        const actor = parent.actor;
        if (!actor) return wrapped();
        context = {
            actor,
            damage: this,
            activity: parent,
            document: parent,
            item: parent.item,
            partIndex: this._index,
            activityIdentifier: parent.identifier,
            identifier: parent.item.system.identifier
        };
    } else {
        const grandParent = parent.parent;
        if (grandParent?.documentName !== 'Item') return wrapped();
        const actor = grandParent.actor;
        if (!actor) return wrapped();
        context = {
            actor,
            damage: this,
            item: grandParent,
            document: grandParent,
            identifier: grandParent.system.identifier
        };
    }
    const originalFormula = wrapped();
    const alternateFormulas = new Set();
    const rollModifiers = new Set();
    const {DamageFormula, RollModifier} = constants.alternateAttributes;
    for (const item of DamageFormula.getFlagHolders(context.actor)) {
        context.sourceItem = item;
        const newFormulas = DamageFormula.evaluate(context);
        if (newFormulas?.size) for (const f of newFormulas) alternateFormulas.add(f);
        const newModifiers = RollModifier.evaluate(context);
        if (newModifiers?.size) for (const mod of newModifiers) rollModifiers.add(mod);
    }
    let maxRoll;
    const data = rollData(context);
    if (originalFormula?.length) maxRoll = new Roll(originalFormula, data).evaluateSync({maximize: true});
    if (alternateFormulas.size) {
        let max = maxRoll?.total ?? -Infinity;
        for (const formula of alternateFormulas) {
            if (!formula.length) continue;
            const parsed = new Roll(formula, data).evaluateSync({maximize: true});
            if (parsed.total > max) {
                maxRoll = parsed;
                max = parsed.total;
            }
        }
    }
    if (maxRoll?.formula === originalFormula) return originalFormula;
    if (rollModifiers.size) {
        let changed = false;
        for (const term of maxRoll.terms) {
            if (!term.modifiers) continue;
            for (const mod of rollModifiers) {
                if (term.modifiers.includes(mod)) continue;
                term.modifiers.push(mod);
                changed = true;
            }
        }
        if (changed) maxRoll.resetFormula();
    }
    this.custom.enabled = true;
    this.custom.formula = maxRoll.formula;
    return maxRoll.formula;
}
function defineSchema(wrapped, ...args) {
    const schema = wrapped(...args);
    schema.attributes.fields.senses.fields.ranges.initialKeys.devilsSight = 'CAT.Senses.DevilsSight';
    return schema;
}
function armorClass(wrapped, rollData) {
    wrapped(rollData);
    const ac = this.attributes.ac;
    if (ac.calc === 'flat' || ac.calc === 'natural') return;
    const actor = this.parent;
    if (!actor) return;
    const cfg = CONFIG.DND5E.armorClasses[ac.calc];
    const originalFormula = cfg?.formula ?? ac.formula;
    const formulas = new Map();
    const abilities = new Set(['dex']);
    const context = {actor};
    const {ACAbility, ACFormula} = constants.alternateAttributes;
    for (const item of ACFormula.getFlagHolders(actor)) {
        context.sourceItem = item;
        const newFormulas = ACFormula.evaluate(context);
        if (newFormulas?.size) for (const f of newFormulas) formulas.set(f, item);
        const newAbilities = ACAbility.evaluate(context);
        if (newAbilities?.size) for (const ability of newAbilities) abilities.add(ability);
    }
    const bestAbility = abilities.size > 1 ? actorUtils.getBestAbility(actor, [...abilities]) : 'dex';
    const property = _loc('DND5E.ArmorClass');
    let bestFormula = {formula: originalFormula, value: ac.base};
    for (const [formula, source] of formulas) {
        if (!formula) continue;
        try {
            const replaced = dnd5e.utils.replaceFormulaData(formula, rollData, {actor, property, item: source, missing: null});
            const value = replaced ? new Roll(replaced).evaluateSync().total : 0;
            if (value > bestFormula.value) bestFormula = {formula, value, source};
        } catch (e) {
            const prepWarning = actor._preparationWarnings.find(w => w.link === source?.uuid);
            if (prepWarning) Logging.addAttributeError(source, formula, new foundry.data.validation.DataModelValidationError(prepWarning.message));
            else Logging.addAttributeError(source, formula, e);
        }
    }
    ac.catModified = true;
    ac.base = bestFormula.value;
    if (bestFormula.source?.name) {
        ac.calc = 'custom';
        ac.formula = bestFormula.formula;
        ac.label = bestFormula.source.name;
    }
    if (bestAbility !== 'dex') {
        ac.catReplaceDex = bestAbility;
        ac.dex = this.abilities[ac.catReplaceDex]?.mod ?? 0;
        if (ac.equippedArmor) {
            if (ac.equippedArmor.system.type.value === 'heavy') ac.dex = 0;
            else ac.dex = Math.min(ac.equippedArmor.system.armor.dex ?? Infinity, ac.dex);
        }
        if (ac.calc === 'default') ac.base = ac.armor + ac.dex;
    }
    if (ac.armor + ac.dex > ac.base) {
        ac.calc = 'default';
        ac.base = ac.armor + ac.dex;
        ac.label = CONFIG.DND5E.armorClasses.default.label;
    }
    ac.value = Math.max(ac.min, ac.base + ac.shield + ac.bonus + ac.cover);
}
function acLabel(wrapped, property) {
    if (property !== 'attributes.ac.dex') return wrapped(property);
    const replaceDex = this.object.system.attributes.ac.catReplaceDex;
    if (!replaceDex) return wrapped(property);
    return CONFIG.DND5E.abilities[replaceDex]?.label ?? replaceDex;
}
// this is a near identical copy of the wrapped function, except this.formula is always accessed
function scaledFormula(increase) {
    if ( increase instanceof dnd5e.documents.Scaling ) increase = increase.increase;
    switch ( this.scaling.mode ) {
        case 'whole': break;
        case 'half': increase = Math.floor(increase * .5); break;
        default: increase = 0; break;
    }
    let formula = this.formula;
    if (!increase) return formula;
    const dieIncrease = (this.scaling.number ?? 0) * increase;
    if (this.custom.enabled) {
        formula = this.custom.formula;
        formula = formula.replace(/^(\d+)d/, (match, number) => `${Number(number) + dieIncrease}d`);
    } else {
        formula = this._automaticFormula(dieIncrease);
    }
    if (this.scaling.formula) {
        let roll = new Roll(this.scaling.formula);
        roll = roll.alter(increase, 0, {multiplyNumeric: true});
        formula = formula ? `${formula} + ${roll.formula}` : roll.formula;
    }
    return formula;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.shared.DamageData.prototype.formula', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula', formula, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.actor.CharacterData.defineSchema', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.actor.CharacterData.defineSchema', defineSchema, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.actor.NPCData.defineSchema', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.actor.NPCData.defineSchema', defineSchema, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.actor.AttributesFields.prepareArmorClass', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.actor.AttributesFields.prepareArmorClass', armorClass, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.applications.PropertyAttribution.prototype.getPropertyLabel', {force: true});
        libWrapper.register('cat', 'dnd5e.applications.PropertyAttribution.prototype.getPropertyLabel', acLabel, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.shared.DamageData.prototype.scaledFormula', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.shared.DamageData.prototype.scaledFormula', scaledFormula, 'OVERRIDE');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.shared.DamageData.prototype.formula');
        libWrapper.unregister('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.actor.CharacterData.defineSchema');
        libWrapper.unregister('cat', 'dnd5e.dataModels.actor.CharacterData.defineSchema');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.actor.NPCData.defineSchema');
        libWrapper.unregister('cat', 'dnd5e.dataModels.actor.NPCData.defineSchema');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.actor.AttributesFields.prepareArmorClass');
        libWrapper.unregister('cat', 'dnd5e.dataModels.actor.AttributesFields.prepareArmorClass');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.applications.PropertyAttribution.prototype.getPropertyLabel');
        libWrapper.unregister('cat', 'dnd5e.applications.PropertyAttribution.prototype.getPropertyLabel');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.shared.DamageData.prototype.scaledFormula');
        libWrapper.unregister('cat', 'dnd5e.dataModels.shared.DamageData.prototype.scaledFormula');
    }
}
export default {
    patch
};