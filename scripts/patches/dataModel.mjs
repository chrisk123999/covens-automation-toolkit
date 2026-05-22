import {Logging} from '../lib/_module.mjs';
import {rollUtils} from '../utilities/_module.mjs';
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
    const rollModifiers = [];
    for (const item of actor.items) {
        const altFormula = item.flags.cat?.alternateFormula?.[identifier];
        if (altFormula) alternateFormulas.push(altFormula);
        const modGroup = item.flags.cat?.rollModifiers;
        if (modGroup) {
            const modFlagId = modGroup.byIdentifier?.[identifier];
            if (modFlagId) rollModifiers.push(...modFlagId);
            const modFlagType = modGroup.byType?.[targetItem.type];
            if (modFlagType) rollModifiers.push(...modFlagType);
        }
    }
    let bestFormula = originalFormula;
    if (alternateFormulas.length > 1) {
        const highestIndex = alternateFormulas.reduce((accumulator, currentFormula, currentIndex) => {
            const currentMax = rollUtils.rollDiceSync(currentFormula, {document, options: {maximize: true}}).total;
            if (currentMax > accumulator.maxValue) return {index: currentIndex, maxValue: currentMax};
            return accumulator;
        }, {index: 0, maxValue: -Infinity}).index;
        bestFormula = alternateFormulas[highestIndex];
    }
    if (rollModifiers.length) {
        const terms = Roll.parse(bestFormula);
        terms.forEach(term => {
            if (term.modifiers && Array.isArray(term.modifiers)) {
                rollModifiers.forEach(mod => {
                    if (!term.modifiers.includes(mod)) term.modifiers.push(mod);
                });
            }
        });
        bestFormula = Roll.getFormula(terms);
    }
    return bestFormula;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.shared.DamageData.prototype.formula', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula', formula, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.shared.DamageData.prototype.formula');
        libWrapper.unregister('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula');
    }
}
export default {
    patch
};