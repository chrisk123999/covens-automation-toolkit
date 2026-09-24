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
 * Roll a formula synchronously, for data preparation and other places that cannot await.
 * @param {string} formula Formula to roll.
 * @param {object} [options] Additional options.
 * @param {foundry.abstract.Document} [options.document] Document supplying roll data.
 * @param {EvaluateOptions & {strict?: boolean}} [options.options]
 * @returns {foundry.dice.Roll}
 */
function rollDiceSync(formula, {document, options: {strict = false, maximize = false, minimize = false} = {}} = {}) {
    return new Roll(formula, document?.getRollData()).evaluateSync({strict, maximize, minimize});
}
/**
 * Replace rolls with manually entered results when manual rolls are enabled for the actor.
 * @param {foundry.dice.Roll[]} rolls Rolls to work with.
 * @param {foundry.documents.Actor} actor Actor the rolls belong to.
 * @param {string} label Shown as the heading of the manual roll prompt.
 * @param {object} [options] Additional options.
 * @param {typeof foundry.dice.Roll} [options.rollClass] Roll class the manual rolls are rebuilt as.
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
 * Roll a formula, optionally posting it to chat.
 * @param {string} formula Formula to roll.
 * @param {object} [options] Additional options.
 * @param {foundry.abstract.Document} [options.document] Document supplying roll data.
 * @param {boolean} [options.message] Post the roll to chat.
 * @param {string} [options.flavor] Flavour text for the chat card.
 * @param {'blind'|'gm'|'ic'|'public'|'self'} [options.mode] Roll visibility mode.
 * @param {boolean} [options.manual] Prompt for a manually entered result when manual rolls are enabled.
 * @param {EvaluateOptions} [options.options] Evaluation options.
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
 * Add up the totals of several rolls.
 * @param {foundry.dice.Roll[]} rolls Rolls to work with.
 * @returns {number}
 */
function getRollsTotal(rolls) {
    return rolls.reduce((acc, roll) => acc + roll.total, 0);
}

/**
 * The formula this damage would use on a critical hit.
 * @param {string} formula Formula to roll.
 * @param {foundry.abstract.Document} document Document supplying roll data.
 * @param {CritOptions} [options] Critical and damage handling.
 * @returns {string}
 */
function getCriticalFormula(formula, document, {bonusDamage, bonusDice, multiplier = 2, multiplyNumeric, powerfulCritical} = {}) {
    return new CONFIG.Dice.DamageRoll(formula, document.getRollData(), {isCritical: true, critical: {bonusDamage, bonusDice, multiplier, multiplyNumeric, powerfulCritical}}).formula;
}
/**
 * @param {string} formula Formula to roll.
 * @param {foundry.abstract.Document} document Document supplying roll data.
 * @param {DamageOptions} [options] Critical and damage handling.
 * @param {EvaluateOptions} [evaluateOptions] Evaluation options, such as maximize and minimize.
 * @returns {Promise<dnd5e.dice.DamageRoll>}
 * */
/**
 * Roll damage from a formula, using a document for roll data.
 * @param {string|number} formula Damage formula to roll.
 * @param {foundry.abstract.Document} document Document supplying roll data, usually an item or activity.
 * @param {object} [options] Additional options.
 * @param {object} [options.critOptions] Critical handling, matching dnd5e's DamageRoll critical config.
 * @param {string} [options.critOptions.bonusDamage] Formula added on a critical hit.
 * @param {number} [options.critOptions.bonusDice] Extra dice added on a critical hit.
 * @param {number} [options.critOptions.multiplier] How many times the dice are multiplied.
 * @param {boolean} [options.critOptions.multiplyNumeric] Also multiply flat terms.
 * @param {boolean} [options.critOptions.powerfulCritical] Maximize the extra dice.
 * @param {string} [options.flavor] Flavour shown on the roll.
 * @param {boolean} [options.isCritical] Roll this as a critical hit.
 * @param {string[]} [options.properties] Item properties carried onto the roll.
 * @param {string} [options.type] Damage type.
 * @param {object} [evaluateOptions] Evaluation options, such as maximize and minimize.
 * @param {boolean} [evaluateOptions.maximize] Take the highest result on every die.
 * @param {boolean} [evaluateOptions.minimize] Take the lowest result on every die.
 * @returns {Promise<CONFIG.Dice.DamageRoll>} The evaluated roll.
 */
async function damageRoll(formula, document, {critOptions: {bonusDamage, bonusDice, multiplier = 2, multiplyNumeric, powerfulCritical} = {}, flavor, isCritical, properties, type} = {}, {maximize, minimize} = {}) {
    return await new CONFIG.Dice.DamageRoll(String(formula), document.getRollData(), {
        critical: {bonusDamage, bonusDice, multiplier, multiplyNumeric, powerfulCritical},
        flavor, isCritical, properties, type
    }).evaluate({maximize, minimize});
}
/**
 * Rebuild a damage roll with every flavoured term retyped.
 * @param {CONFIG.Dice.DamageRoll} origRoll Roll to rebuild.
 * @param {string} newType A key of CONFIG.DND5E.damageTypes.
 * @returns {Promise<CONFIG.Dice.DamageRoll>}
 */
async function getChangedDamageRoll(origRoll, newType) {
    return await new CONFIG.Dice.DamageRoll(origRoll.terms.map(i => i.expression + (i.flavor?.length ? '[' + newType + ']' : '')).join(''), origRoll.data, foundry.utils.mergeObject(origRoll.options, {type: newType}, {inplace: false})).evaluate();
}
/**
 * Append a formula to an existing roll, preserving the original roll data.
 * @param {foundry.dice.Roll} roll Roll to work with.
 * @param {string|number} formula Formula to roll.
 * @param {object} [options] Additional options.
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
 * @param {foundry.dice.Roll[]} rolls Rolls to work with.
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
 * @param {foundry.dice.Roll} roll Roll to work with.
 * @param {foundry.dice.Roll} newRoll Roll whose results replace the original.
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
 * @param {foundry.dice.Roll} roll Roll to work with.
 * @param {number} total Total to force the roll to.
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
 * @param {foundry.documents.Actor} token Actor the roll is requested from.
 * @param {'abil'|'check'|'save'|'test'|'skill'|'tool'|'deathSave'} request Kind of roll to request.
 * @param {string} ability Use an ability, skill, or tool abbreviation.
 * @param {object} [options] Additional options.
 * @param {number} [options.rollDC] DC the roll is checked against.
 * @param {boolean} [options.advantage] Roll with advantage.
 * @param {boolean} [options.disadvantage] Roll with disadvantage.
 * @param {boolean} [options.fast] Fast forward.
 * @param {boolean} [options.message] Create a chat card.
 * @param {'blind'|'gm'|'ic'|'public'|'self'} [options.mode] Roll visibility mode.
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
 * Returns a number representing the target's roll total subtracted from the source's roll total, or undefined for actorless tokens and invalid abilities.
 * @param {object} params Contest settings.
 * @param {string} params.flavor Text for the results chat card.
 * @param {boolean} params.message Display results in a chat card.
 * @param {foundry.documents.TokenDocument} params.sourceToken Token making the contest.
 * @param {foundry.documents.TokenDocument} params.targetToken Token opposing it.
 * @param {'abil'|'test'|'save'|'skill'} params.sourceRollType Kind of roll the source makes.
 * @param {'abil'|'test'|'save'|'skill'} params.targetRollType Kind of roll the target makes.
 * @param {string[]} params.sourceAbilities Abilities or skills the source may use; the best is chosen.
 * @param {string[]} params.targetAbilities Abilities or skills the target may use; the best is chosen.
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
 * Whether midi's settings skip the roll dialog for this user.
 * @param {'attack'|'damage'|'check'|'save'|'skill'|'tool'} rollType Kind of roll being made.
 * @param {foundry.documents.User} user User the roll belongs to.
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
