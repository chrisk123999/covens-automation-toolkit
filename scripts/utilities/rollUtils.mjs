function rollDiceSync(formula, {document, options: {strict = false, maximize = false, minimize = false} = {}} = {}) {
    return new Roll(formula, document?.getRollData()).evaluateSync({strict, maximize, minimize});
}
async function rollDice(formula, {document, options: {strict = false, maximize = false, minimize = false} = {}} = {}) {
    return await new Roll(formula, document?.getRollData()).evaluate({strict, maximize, minimize});
}
export default {
    rollDiceSync,
    rollDice
};