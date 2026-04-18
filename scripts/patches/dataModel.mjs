import {Logging} from '../lib/_module.mjs';
import rollUtils from '../utilities/rollUtils.mjs';
function formula(wrapped) {
    const parent = this.parent;
    if (!parent || typeof parent !== 'object') return wrapped();
    let identifier;
    let actor;
    let document;
    if (parent.documentName === 'Activity') {
        actor = parent.actor;
        if (!actor) return wrapped();
        identifier = parent.item.system.identifier + '|' + parent.identifier;
        document = parent;
    } else {
        const grandParent = parent.parent;
        if (grandParent?.documentName !== 'Item') return wrapped();
        actor = grandParent.actor;
        if (!actor) return wrapped();
        identifier = grandParent.system.identifier;
        document = grandParent;
    }
    const alternateFormulas = [wrapped(), ...actor.items.map(item => item.flags?.cat?.alternateFormula?.[identifier]).filter(Boolean)];
    if (alternateFormulas.length === 1) return wrapped();
    const highestIndex = alternateFormulas.reduce((accumulator, currentFormula, currentIndex) => {
        const currentMax = rollUtils.rollDiceSync(currentFormula, {document, options: {maximize: true}}).total;
        if (currentMax > accumulator.maxValue) return {index: currentIndex, maxValue: currentMax};
        return accumulator;
    }, {index: 0, maxValue: -Infinity}).index;
    return alternateFormulas[highestIndex];
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