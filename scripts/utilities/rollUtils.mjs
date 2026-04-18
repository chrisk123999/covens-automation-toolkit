function rollDiceSync(formula, {document, options: {strict = false, maximize = false, minimize = false} = {}} = {}) {
    // eslint-disable-next-line no-undef
    return new Roll(formula, document?.getRollData()).evaluateSync({strict, maximize, minimize});
}
export default {
    rollDiceSync
};