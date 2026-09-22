import CatRollResolver from '../applications/dice/roll-resolver.mjs';
import {actorUtils, genericUtils, queryUtils} from './_module.mjs';
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
 * Replace rolls with manually entered results when manual rolls are enabled for the actor.
 * @param {foundry.dice.Roll[]} rolls
 * @param {foundry.documents.Actor} actor
 * @param {string} label Shown as the heading of the manual roll prompt.
 * @param {object} [options]
 * @param {typeof foundry.dice.Roll} [options.rollClass]
 * @returns {Promise<foundry.dice.Roll[]>}
 */
async function resolveManualRolls(rolls, actor, label, {rollClass = CONFIG.Dice.DamageRoll} = {}) {
    if (!game.settings.get('cat', 'manualRollsEnabled') || !CatRollResolver.shouldForce(actor)) return rolls;
    const newRolls = rolls.map(roll => roll.options.cat?.noManualRoll ? roll : new rollClass(roll.formula, roll.data, roll.options));
    const toRoll = newRolls.filter(roll => !roll.options.cat?.noManualRoll);
    if (!toRoll.length) return rolls;
    await CatRollResolver.fulfillBatch(toRoll, label, {prompt: true});
    for (const roll of toRoll) await roll.evaluate({allowInteractive: false});
    return newRolls;
}
/**
 * @param {string} formula
 * @param {object} [options]
 * @param {foundry.abstract.Document} [options.document]
 * @param {boolean} [options.message]
 * @param {string} [options.flavor]
 * @param {'blind'|'gm'|'ic'|'public'|'self'} [options.mode]
 * @param {boolean} [options.manual] Prompt for a manually entered result when manual rolls are enabled.
 * @param {EvaluateOptions} [options.options]
 * @returns {Promise<foundry.dice.Roll>}
 */
async function rollDice(formula, {document, message, flavor, mode = 'public', manual = false, options: {maximize = false, minimize = false} = {}} = {}) {
    let roll = new Roll(formula, document?.getRollData());
    let resolved = false;
    if (manual) {
        const actor = document?.actor ?? document;
        const [manualRoll] = await resolveManualRolls([roll], actor, flavor, {rollClass: Roll});
        resolved = manualRoll !== roll;
        roll = manualRoll;
    }
    if (!resolved) await roll.evaluate({maximize, minimize});
    if (message) return {message: await roll.toMessage({flavor}, {rollMode: mode}), roll};
    return roll;
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
/**
 * Rebuild a damage roll with every flavoured term retyped.
 * @param {CONFIG.Dice.DamageRoll} origRoll
 * @param {string} newType A key of CONFIG.DND5E.damageTypes.
 * @returns {Promise<CONFIG.Dice.DamageRoll>}
 */
async function getChangedDamageRoll(origRoll, newType) {
    return await new CONFIG.Dice.DamageRoll(origRoll.terms.map(i => i.expression + (i.flavor?.length ? '[' + newType + ']' : '')).join(''), origRoll.data, foundry.utils.mergeObject(origRoll.options, {type: newType}, {inplace: false})).evaluate();
}
/**
 * Append a formula to an existing roll, preserving the original roll data.
 * @param {foundry.dice.Roll} roll
 * @param {string|number} formula
 * @param {object} [options]
 * @param {object} [options.rollData] Roll data for the appended formula.
 * @returns {Promise<foundry.dice.Roll>}
 */
async function addToRoll(roll, formula, {rollData} = {}) {
    const bonusRoll = await new Roll(String(formula), rollData).evaluate();
    const newRoll = MidiQOL.addRollTo(roll, bonusRoll);
    newRoll.data = roll.data;
    return newRoll;
}
/**
 * Whether any die result is repeated across the given rolls.
 * @param {foundry.dice.Roll[]} rolls
 * @returns {boolean}
 */
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
/**
 * Note - tools will roll '-1' if the associated item is not present on the character sheet.
 * @param {foundry.documents.Actor} token
 * @param {'abil'|'check'|'save'|'test'|'skill'|'tool'|'deathSave'} request
 * @param {string} ability Use an ability, skill, or tool abbreviation.
 * @param {object} [options]
 * @param {number} [options.rollDC]
 * @param {boolean} [options.advantage]
 * @param {boolean} [options.disadvantage]
 * @param {boolean} [options.fast] Fast forward.
 * @param {boolean} [options.message] Create a chat card.
 * @param {'blind'|'gm'|'ic'|'public'|'self'} [options.mode]
 * @returns {Promise<dnd5e.dice.D20Roll>}
 */
async function requestRoll(actor, request, ability, {rollDC, advantage, disadvantage, fast, message = true, mode = 'public'} = {}) {
    if (request === 'abil' || request === 'test') request = 'check';
    const user = queryUtils.firstOwner(actor);
    fast ??= shouldFastForward(request, user);
    const data = {
        displayOptions: {
            fastForward: fast,
            showTargetDC: true,
            chatMessage: message,
            rollMode: mode
        },
        saveDetails: {
            rollDC,
            advantage,
            disadvantage,
            rollType: request,
            actorUuid: actor.uuid
        }
    };
    switch(request) {
        case 'check':
        case 'save': genericUtils.setProperty(data.saveDetails, 'rollAbilities', [ability]); break;
        case 'skill': genericUtils.setProperty(data.saveDetails, 'rollSkills', [ability]); break;
        case 'tool': genericUtils.setProperty(data.saveDetails, 'rollTools', [ability]); break;
        case 'deathSave': break;
    }
    return (await MidiQOL.socket().executeAsUser('rollAbility', user.id, data))?.[0];
}
/**
 * Returns a number representing the target's roll total subtracted from the source's roll total.
 * Returns undefined for actorless tokens or invalid abilities.
 * @param {object} params
 * @param {string} params.flavor Text for the results chat card.
 * @param {boolean} params.message Display results in a chat card.
 * @param {foundry.documents.TokenDocument} params.sourceToken
 * @param {foundry.documents.TokenDocument} params.targetToken
 * @param {'abil'|'test'|'save'|'skill'} params.sourceRollType
 * @param {'abil'|'test'|'save'|'skill'} params.targetRollType
 * @param {string[]} params.sourceAbilities
 * @param {string[]} params.sourceAbilities
 * @returns {Promise<number|undefined>}
 */
async function contestedRoll({sourceToken, targetToken, sourceRollType, targetRollType, sourceAbilities, targetAbilities, message, flavor}) {
    if (!sourceToken.actor || !targetToken.actor) return;
    const getBest = (actor, type, choices) => {
        switch(type) {
            case 'abil':
            case 'test': return actorUtils.getBestAbility(actor, choices);
            case 'save': return actorUtils.getBestSave(actor, choices);
            case 'skill': return actorUtils.getBestSkill(actor, choices);
        }
    };
    return (await MidiQOL.contestedRoll({
        source: {token: sourceToken, rollType: sourceRollType, ability: getBest(sourceToken.actor, sourceRollType, sourceAbilities)},
        target: {token: targetToken, rollType: targetRollType, ability: getBest(targetToken.actor, targetRollType, targetAbilities)},
        displayResults: message,
        flavor
    }))?.result;
}
/**
 * @param {'attack'|'damage'|'check'|'save'|'skill'|'tool'} rollType
 * @param {foundry.documents.User} user
 * @returns {boolean}
 */
function shouldFastForward(rollType, user = game.user) {
    const settings = MidiQOL.configSettings();
    return user.isGM ? settings.gmAutoFastForward.includes(rollType) : settings.autoFastForward.includes(rollType);
}
export default {
    rollDiceSync,
    rollDice,
    resolveManualRolls,
    getRollsTotal,
    getCriticalFormula,
    addToRoll,
    damageRoll,
    getChangedDamageRoll,
    hasDuplicateDie,
    replaceRollShowDiscarded,
    setTotalWithBonus,
    requestRoll,
    contestedRoll,
    shouldFastForward
};
