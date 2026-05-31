import {Logging} from '../lib/_module.mjs';
import {rollUtils} from '../utilities/_module.mjs';
/*
item.flags.cat.rollModifiers = [
    {
        modifiers: ['x', 'min1'],
        restrictions: {
            identifier: {
                value: ['example']
            },
            type: {
                value: ['spell', 'weapon'],
                requireAll: false
            },
            property: {
                value: ['verbal', 'material'],
                requireAll: false
            },
            school: {
                value: ['evocation', 'necromancy'],
                requireAll: true
            },
            level: {
                value: [0]
            },
            ability: {
                value: ['int', 'wis'],
                requireAll: false
            },
            method: {
                value: ['spell', 'atwill'],
                requireAll: false
            },
            damageTypes: {
                value: ['fire', 'lightning']
                requireAll: false
            }
        }
    }
]
item.flags.cat.alternateFormula = [
    value: '1d8 + @mod',
    identifiers: ['example']
]
*/
function checkReq(requirement, itemData, defaultRequireAll = true) {
    if (!requirement) return true;
    const reqValues = requirement.value;
    const requireAll = requirement.requireAll ?? defaultRequireAll;
    if (itemData instanceof Set) {
        return requireAll ? reqValues.every(v => itemData.has(v))  : reqValues.some(v => itemData.has(v));
    }
    if (Array.isArray(itemData)) {
        return requireAll ? reqValues.every(v => itemData.includes(v)) : reqValues.some(v => itemData.includes(v));
    }
    return requireAll ? reqValues.every(v => v === itemData) : reqValues.some(v => v === itemData);
}
function isValidModifier(modDef, targetItem, identifier, {rollData} = {}) {
    const reqs = modDef.restrictions;
    if (!reqs) return true;
    if (!checkReq(reqs.identifier, identifier, false)) return false;
    if (!checkReq(reqs.type, targetItem.type, false)) return false;
    if (!checkReq(reqs.property, targetItem.system.properties, true)) return false;
    if (targetItem.type === 'spell') {
        if (!checkReq(reqs.school, targetItem.system.school, false)) return false;
        if (!checkReq(reqs.level, targetItem.system.level, false)) return false;
        if (!checkReq(reqs.method, targetItem.system.method, false)) return false;
        if (!checkReq(reqs.ability, targetItem.system.ability, false)) return false;
    }
    if (!checkReq(reqs.classIdentifier, targetItem.system.classIdentifier, false)) return false;
    if (reqs.damageTypes) {
        if (!rollData) return false; 
        const currentTypes = rollData.options?.types || [rollData.options?.type];
        if (!checkReq(reqs.damageTypes, currentTypes, false)) return false;
    }
    return true;
}
function formula(wrapped) {
    const parent = this.parent;
    if (!parent) return wrapped();
    let identifier;
    let actor;
    let document;
    let targetItem; 
    if (parent.documentName === 'Activity') {
        actor = parent.actor;
        if (!actor) return wrapped();
        targetItem = parent.item;
        identifier = targetItem.system.identifier + '|' + parent.identifier;
        document = parent;
    } else {
        const grandParent = parent.parent;
        if (grandParent?.documentName !== 'Item') return wrapped();
        actor = grandParent.actor;
        if (!actor) return wrapped();
        targetItem = grandParent;
        identifier = grandParent.system.identifier;
        document = grandParent;
    }
    const originalFormula = wrapped();
    const alternateFormulas = [originalFormula];
    const rollModifiers = new Set();
    actor.items.forEach(item => {
        if (item.type != 'feat') return;
        const altFormula = item.flags.cat?.alternateFormula?.find(i => i.identifiers?.includes(identifier))?.value;
        if (altFormula) alternateFormulas.push(altFormula);
        const modifiersList = item.flags.cat?.rollModifiers;
        if (modifiersList) {
            modifiersList.forEach(modDef => {
                if (isValidModifier(modDef, targetItem, identifier) && modDef.modifiers) modDef.modifiers.forEach(m => rollModifiers.add(m));
            });
        }
    });
    let bestFormula = originalFormula;
    if (alternateFormulas.length > 1) {
        const highestIndex = alternateFormulas.reduce((accumulator, currentFormula, currentIndex) => {
            const currentMax = rollUtils.rollDiceSync(currentFormula, {document, options: {maximize: true}}).total;
            if (currentMax > accumulator.maxValue) return {index: currentIndex, maxValue: currentMax};
            return accumulator;
        }, {index: 0, maxValue: -Infinity}).index;
        bestFormula = alternateFormulas[highestIndex];
    }
    if (rollModifiers.size) {
        const terms = Roll.parse(bestFormula);
        terms.forEach(term => {
            if (term.modifiers) {
                rollModifiers.forEach(mod => {
                    if (!term.modifiers.includes(mod)) term.modifiers.push(mod);
                });
            }
        });
        bestFormula = Roll.getFormula(terms);
    }
    return bestFormula;
}
function defineSchema(wrapped, ...args) {
    const schema = wrapped(...args);
    schema.attributes.fields.senses.fields.ranges.initialKeys.devilsSight = 'CAT.Senses.DevilsSight';
    return schema;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.shared.DamageData.prototype.formula', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula', formula, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.actor.CharacterData.defineSchema', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.actor.CharacterData.defineSchema', defineSchema, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.actor.NPCData.defineSchema', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.actor.NPCData.defineSchema', defineSchema, 'WRAPPER');
        
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.shared.DamageData.prototype.formula');
        libWrapper.unregister('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.actor.CharacterData.defineSchema');
        libWrapper.unregister('cat', 'dnd5e.dataModels.actor.CharacterData.defineSchema');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.actor.NPCData.defineSchema');
        libWrapper.unregister('cat', 'dnd5e.dataModels.actor.NPCData.defineSchema');
    }
}
export default {
    patch,
    isValidModifier
};