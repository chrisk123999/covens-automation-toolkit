function rollDiceSync(formula, {document, options: {strict = false, maximize = false, minimize = false} = {}} = {}) {
    return new Roll(formula, document?.getRollData()).evaluateSync({strict, maximize, minimize});
}
async function rollDice(formula, {document, options: {strict = false, maximize = false, minimize = false} = {}} = {}) {
    return await new Roll(formula, document?.getRollData()).evaluate({strict, maximize, minimize});
}
function getRollsTotal(rolls) {
    return rolls.reduce((acc, roll) => acc + roll.total, 0);
}
function getCriticalFormula(formula, document) {
    return new CONFIG.Dice.DamageRoll(formula, document.getRollData(), {isCritical: true}).formula;
}
async function addToRoll(roll, formula, {rollData} = {}) {
    const bonusRoll = await new Roll(String(formula), rollData).evaluate();
    const newRoll = MidiQOL.addRollTo(roll, bonusRoll);
    newRoll.data = roll.data;
    return newRoll;
}
export default {
    rollDiceSync,
    rollDice,
    getRollsTotal,
    getCriticalFormula,
    addToRoll
};