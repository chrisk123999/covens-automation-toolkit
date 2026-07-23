const {OperatorTerm, NumericTerm} = foundry.dice.terms;
/**
 * @typedef {object} CritOptions
 * @property {string} [bonusDamage] An extra term in the formula.
 * @property {number} [bonusDice] Add dice to the first term after multiplication.
 * @property {number} [multiplier] Multiply the number of base dice.
 * @property {boolean} [multiplyNumeric] Apply {@link multiplier} to numeric terms.
 * @property {boolean} [powerfulCritical] Reduce {@link multiplier} by 1 and maximize those dice instead.
 */

/**
 * @typedef {object} DamageOptions
 * @property {string} [flavor]
 * @property {boolean} [isCritical] Treat the roll as critical by applying {@link CritOptions}.
 * @property {string[]} [properties] Mark relevant properties, such as 'mwak', 'mgc', 'sil'.
 * @property {string} [type]
 * @property {CritOptions} [critOptions]
 */

/**
 * @typedef {object} EvaluateOptions
 * @property {boolean} [maximize]
 * @property {boolean} [minimize]
 */

/**
 * @param {string} formula 
 * @param {object} [options]
 * @param {foundry.abstract.Document} [options.document]
 * @param {EvaluateOptions & {strict?: boolean}} [options.options]
 * @returns {foundry.dice.Roll}
 */
function rollDiceSync(formula, {document, options: {strict = false, maximize = false, minimize = false} = {}} = {}) {
    return new Roll(formula, document?.getRollData()).evaluateSync({strict, maximize, minimize});
}
/**
 * @param {string} formula 
 * @param {object} [options]
 * @param {foundry.abstract.Document} [options.document]
 * @param {EvaluateOptions} [options.options]
 * @returns {Promise<foundry.dice.Roll>}
 */
async function rollDice(formula, {document, options: {maximize = false, minimize = false} = {}} = {}) {
    return await new Roll(formula, document?.getRollData()).evaluate({maximize, minimize});
}
/**
 * @param {foundry.dice.Roll[]} rolls 
 * @returns {number}
 */
function getRollsTotal(rolls) {
    return rolls.reduce((acc, roll) => acc + roll.total, 0);
}

/**
 * @param {string} formula 
 * @param {foundry.abstract.Document} document 
 * @param {CritOptions} [options]
 * @returns {string}
 */
function getCriticalFormula(formula, document, {bonusDamage, bonusDice, multiplier = 2, multiplyNumeric, powerfulCritical} = {}) {
    return new CONFIG.Dice.DamageRoll(formula, document.getRollData(), {isCritical: true, critical: {bonusDamage, bonusDice, multiplier, multiplyNumeric, powerfulCritical}}).formula;
}
/** 
 * @param {string} formula 
 * @param {foundry.abstract.Document} document 
 * @param {DamageOptions} [options]
 * @param {EvaluateOptions} [evaluateOptions]
 * @returns {Promise<dnd5e.dice.DamageRoll>}
 * */
async function damageRoll(formula, document, {critOptions: {bonusDamage, bonusDice, multiplier = 2, multiplyNumeric, powerfulCritical} = {}, flavor, isCritical, properties, type} = {}, {maximize, minimize} = {}) {
    return await new CONFIG.Dice.DamageRoll(String(formula), document.getRollData(), {
        critical: {bonusDamage, bonusDice, multiplier, multiplyNumeric, powerfulCritical},
        flavor, isCritical, properties, type
    }).evaluate({maximize, minimize});
}
async function getChangedDamageRoll(origRoll, newType) {
    return await new CONFIG.Dice.DamageRoll(origRoll.terms.map(i => i.expression + (i.flavor?.length ? '[' + newType + ']' : '')).join(''), origRoll.data, foundry.utils.mergeObject(origRoll.options, {type: newType}, {inplace: false})).evaluate();
}
async function addToRoll(roll, formula, {rollData} = {}) {
    const bonusRoll = await new Roll(String(formula), rollData).evaluate();
    const newRoll = MidiQOL.addRollTo(roll, bonusRoll);
    newRoll.data = roll.data;
    return newRoll;
}
function hasDuplicateDie(rolls) {
    function hasDuplicate(arr) {
        let seen = new Set();
        for (let num of arr) {
            if (seen.has(num)) {
                return true;
            }
            seen.add(num);
        }
        return false;
    }
    return hasDuplicate(rolls.flatMap(i => i.dice.flatMap(j => j.results.filter(k => k.active).flatMap(l => l.result))));
}
/**
 * Discard all terms in {@link roll}. Use the terms and total from {@link newRoll}.
 * @param {foundry.dice.Roll} roll 
 * @param {foundry.dice.Roll} newRoll 
 * @returns {foundry.dice.Roll}
 */
function replaceRollShowDiscarded(roll, newRoll) {
    for (const term of roll.terms) {
        if (term.isDeterministic) continue;
        for (const result of term.results) {
            result.active = false;
            result.discarded = true;
        }
    }
    roll.terms.push(
        new OperatorTerm({operator: '+'}), 
        ...newRoll.terms
    );
    roll._formula = newRoll.formula;
    roll._total = newRoll.total;
    return roll;
}
/**
 * Discards rolled terms and brings the total to the given value by adding a bonus.
 * @param {foundry.dice.Roll} roll 
 * @param {number} total
 * @returns {foundry.dice.Roll}
 */
function setTotalWithBonus(roll, total) {
    let number = total;
    for (const term of roll.terms) {
        if (term.isDeterministic) {
            if (Number.isNumeric(term.total)) number -= term.total;
            continue;
        }
        for (const result of term.results) {
            result.active = false;
            result.discarded = true;
        }
    }
    roll.terms.push(
        new OperatorTerm({operator: '+'}),
        new NumericTerm({number}).evaluate()
    );
    roll._total = total;
    roll.resetFormula();
    return roll;
}
export default {
    rollDiceSync,
    rollDice,
    getRollsTotal,
    getCriticalFormula,
    addToRoll,
    damageRoll,
    getChangedDamageRoll,
    hasDuplicateDie,
    replaceRollShowDiscarded,
    setTotalWithBonus
};