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
 * @property {boolean} [isCritical] Treat the roll as critical by applying {@link CritOptions}.
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
 * @param {DamageOptions & CritOptions} [options]
 * @param {EvaluateOptions} [evaluateOptions]
 * @returns {Promise<dnd5e.dice.DamageRoll>}
 * */
async function damageRoll(formula, document, {bonusDamage, bonusDice, isCritical, multiplier = 2, multiplyNumeric, powerfulCritical} = {}, {maximize, minimize} = {}) {
    return await new CONFIG.Dice.DamageRoll(formula, document.getRollData(), {critical: {bonusDamage, bonusDice, multiplier, multiplyNumeric, powerfulCritical}, isCritical}).evaluate({maximize, minimize});
}
async function addToRoll(roll, formula, {rollData} = {}) {
    const bonusRoll = await new roll.constructor(String(formula), rollData).evaluate();
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
export default {
    rollDiceSync,
    rollDice,
    getRollsTotal,
    getCriticalFormula,
    addToRoll,
    hasDuplicateDie,
    damageRoll
};