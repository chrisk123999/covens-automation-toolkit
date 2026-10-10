import {constants, Logging} from '../lib/_module.mjs';
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
    if (!data || !data.abilities) return;
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
            partIndex: this._index ?? 0,
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
    let originalParsed;
    const data = rollData(context);
    if (originalFormula?.length) originalParsed = new Roll(originalFormula, data).evaluateSync({maximize: true});
    let maxRoll = originalParsed;
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
    if (maxRoll?.formula === originalParsed?.formula && !rollModifiers.size) return originalFormula;
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
    return maxRoll.formula;
}
function armorClass(wrapped, rollData) {
    const actor = this.parent;
    const formulas = this.attributes.ac.formulas;
    if (actor && formulas) {
        const {ACAbility, ACFormula} = constants.alternateAttributes;
        const context = {actor};
        for (const item of ACFormula.getFlagHolders(actor)) {
            context.sourceItem = item;
            for (const formula of ACFormula.evaluate(context) ?? []) formulas.push({formula, label: item.name});
            for (const ability of ACAbility.evaluate(context) ?? []) formulas.push({formula: '@attributes.ac.armor + @attributes.ac.clamped.' + ability, label: item.name});
        }
    }
    return wrapped(rollData);
}
function visionSourceData(wrapped, ...args) {
    const data = wrapped(...args);
    const ranges = this.actor?.system.attributes?.senses?.ranges;
    if (ranges?.devilsSight || ranges?.truesight) data.priority = 1;
    return data;
}
// this is a near identical copy of the wrapped function, except this.formula is always accessed
function scaledFormula(wrapped, increase, options = {}) {
    let formula = this.formula;
    const nativeFormula = this.custom.enabled ? this._manualFormula() : this._automaticFormula();
    if (formula === nativeFormula) return wrapped(increase, options);
    if (increase instanceof dnd5e.documents.Scaling) increase = increase.increase;
    switch (this.scaling.mode) {
        case 'whole': break;
        case 'half': increase = Math.floor(increase * .5); break;
        default: increase = 0; break;
    }
    if (!increase) return formula;
    const dieIncrease = (this.scaling.number ?? 0) * increase;
    formula = formula.replace(/^(\d+)d/, (match, number) => `${Number(number) + dieIncrease}d`);
    if (this.scaling.formula) {
        let roll = new Roll(this.scaling.formula);
        roll = roll.alter(increase, 0, {multiplyNumeric: true});
        formula = formula ? `${formula} + ${roll.formula}` : roll.formula;
    }
    return formula;
}
function range(wrapped, rollData, labels) {
    if (!(this.range.units in CONFIG.DND5E.movementUnits)) return wrapped(rollData, labels);
    dnd5e.utils.prepareFormulaValue(this, 'range.value', 'DND5E.RANGE.FIELDS.range.value.label', rollData);
    let context;
    if (this.item) {
        if (!this.item.actor) return wrapped(rollData, labels);
        context = {
            identifier: this.item.system.identifier,
            activityIdentifier: this.identifier,
            actor: this.item.actor,
            range: this.range,
            item: this.item,
            activity: this,
            document: this
        };
    } else {
        if (!this.parent.actor) return wrapped(rollData, labels);
        context = {
            identifier: this.parent.system.identifier,
            actor: this.parent.actor,
            range: this.range,
            item: this.parent,
            document: this
        };
    }
    const Range = constants.alternateAttributes.Range;
    let bonus = 0;
    for (const item of Range.getFlagHolders(context.actor)) {
        context.sourceItem = item;
        const range = Range.evaluate(context);
        if (!range?.size) continue;
        const formula = dnd5e.utils.replaceFormulaData(range.first(), rollData, {item, property: _loc('DND5E.RANGE.FIELDS.range.value.label')});
        const value = new Roll(formula).evaluateSync().total;
        if (value) bonus += value;
    }
    if (bonus) {
        this.range.value += bonus;
        this.range.catModified = true;
    }
    return wrapped(rollData, labels);
}
const patches = [
    {path: 'dnd5e.dataModels.shared.DamageData.prototype.formula',              fn: formula,        wrapType: 'MIXED'},
    {path: 'dnd5e.dataModels.shared.DamageData.prototype.scaledFormula',        fn: scaledFormula,  wrapType: 'MIXED'},
    {path: 'dnd5e.dataModels.shared.RangeField.prepareData',                    fn: range,          wrapType: 'MIXED'},
    {path: 'dnd5e.dataModels.actor.AttributesFields.prepareArmorClass',         fn: armorClass,     wrapType: 'WRAPPER'},
    {path: 'foundry.canvas.placeables.Token.prototype._getVisionSourceData',    fn: visionSourceData, wrapType: 'WRAPPER'}
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