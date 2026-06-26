import {constants, Logging} from '../lib/_module.mjs';
import {rollUtils} from '../utilities/_module.mjs';
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
    const alternateFormulas = new Set([originalFormula]);
    const rollModifiers = new Set();
    const {DamageFormula, RollModifier} = constants.alternateAttributes;
    DamageFormula.getFlagHolders(context.actor).forEach(item => {
        context.sourceItem = item;
        const newFormulas = DamageFormula.evaluate(context);
        if (newFormulas?.size) newFormulas.forEach(f => alternateFormulas.add(f));
        const newModifiers = RollModifier.evaluate(context);
        if (newModifiers?.size) newModifiers.forEach(mod => rollModifiers.add(mod));
    });
    let bestFormula = originalFormula;
    if (alternateFormulas.size > 1) {
        bestFormula = alternateFormulas.reduce((accumulator, currentFormula) => {
            if (!currentFormula.length) return accumulator;
            const currentMax = rollUtils.rollDiceSync(currentFormula, {document: context.document, options: {maximize: true}}).total;
            if (currentMax > accumulator.maxValue) return {best: currentFormula, maxValue: currentMax};
            return accumulator;
        }, {best: originalFormula, maxValue: -Infinity}).best;
    }
    if (rollModifiers.size) {
        const terms = Roll.parse(bestFormula, context.document.getRollData());
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
    patch
};