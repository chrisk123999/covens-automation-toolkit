/**
 * Dice rolls, changes to rolls that have already been made, and roll requests sent to another actor's owner.
 * @module
 */
import CatRollResolver from '../applications/dice/roll-resolver.mjs';
import {actorUtils, dataUtils, genericUtils, queryUtils} from './_module.mjs';
const {OperatorTerm, NumericTerm, ParentheticalTerm} = foundry.dice.terms;

/**
 * @typedef {object} DamageOptions
 * @property {string} [flavor]            Flavor text shown on the roll.
 * @property {boolean} [isCritical]       Treat the roll as critical by applying `CritOptions`.
 * @property {string[]} [properties]      Mark relevant properties, such as 'mwak', 'mgc', 'sil'.
 * @property {string} [type]              Damage type, a key of `CONFIG.DND5E.damageTypes`.
 * @property {CritOptions} [critOptions]  Critical hit handling.
 */

/**
 * @typedef {object} EvaluateOptions
 * @property {boolean} [maximize]  Take the highest result on every die.
 * @property {boolean} [minimize]  Take the lowest result on every die.
 */

/**
 * Roll a formula synchronously, for data preparation and other places that cannot await. Roll data comes from
 * {@link dataUtils.getFormulaData}. Dice are rolled unless `strict` is set, which throws on them instead.
 * @param {string} formula                                Formula to roll.
 * @param {object} [options]                              Additional options.
 * @param {foundry.abstract.Document} [options.document]  Document supplying roll data. An active effect provides its
 *                                                        parent's data, with its origin's data under `@effect.source`.
 * @param {MidiQOL.Workflow} [options.workflow]           Adds workflow data to the roll data.
 * @param {EvaluateOptions & {strict?: boolean}} [options.options]
 *                                                        Roll evaluation options.
 * @returns {foundry.dice.Roll}                           The evaluated roll.
 * @example
 * const bonus = rollUtils.rollDiceSync('@prof', {document: actor}).total;
 */
function rollDiceSync(formula, {document, workflow, options: {strict = false, maximize = false, minimize = false} = {}} = {}) {
    return new Roll(formula, dataUtils.getFormulaData({document, workflow})).evaluateSync({strict, maximize, minimize});
}
/**
 * Prompt the current user to enter roll results by hand, when CAT's manual rolls settings apply to this user and actor.
 * Otherwise the rolls are returned unchanged. Rolls with `options.cat.noManualRoll` are never prompted.
 * @param {foundry.dice.Roll[]} rolls                     Unevaluated rolls.
 * @param {foundry.documents.Actor} actor                 Actor the rolls belong to.
 * @param {string} label                                  Heading of the manual roll prompt.
 * @param {object} [options]                              Additional options.
 * @param {typeof foundry.dice.Roll} [options.rollClass]  Roll class the prompted rolls are rebuilt as. Defaults to the
 *                                                        system's damage roll.
 * @returns {Promise<foundry.dice.Roll[]>}                The original rolls, or new rolls with the prompted ones
 *                                                        evaluated.
 * @example
 * const rolls = await rollUtils.resolveManualRolls([roll], actor, item.name);
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
 * Roll a formula, with roll data from {@link dataUtils.getFormulaData}. With `message` set, the roll is posted to chat
 * and the result is an object holding both the message and the roll.
 * @param {string} formula                                    Formula to roll.
 * @param {object} [options]                                  Additional options.
 * @param {foundry.abstract.Document} [options.document]      Document supplying roll data. An active effect provides
 *                                                            its parent's data, with its origin's data under
 *                                                            `@effect.source`.
 * @param {MidiQOL.Workflow} [options.workflow]               Adds workflow data to the roll data.
 * @param {boolean} [options.message]                         Post the roll to chat.
 * @param {string} [options.flavor]                           Flavor text for the chat card and the manual roll prompt.
 * @param {object} [options.speaker]                          Chat speaker data for the card.
 * @param {'blind'|'gm'|'ic'|'public'|'self'} [options.mode]  Visibility of the chat card. Defaults to `public`.
 * @param {boolean} [options.manual]                          Prompt for a hand-entered result through
 *                                                            {@link resolveManualRolls}.
 * @param {EvaluateOptions} [options.options]                 Evaluation options.
 * @returns {Promise<foundry.dice.Roll|{message: ChatMessage, roll: foundry.dice.Roll}>}
 * @example
 * const roll = await rollUtils.rollDice('1d8 + @mod', {document: item});
 * const {roll: d4} = await rollUtils.rollDice('1d4', {document: actor, message: true, flavor: item.name});
 */
async function rollDice(formula, {document, workflow, message, flavor, speaker, mode = 'public', manual = false, options: {maximize = false, minimize = false} = {}} = {}) {
    let roll = new Roll(formula, dataUtils.getFormulaData({document, workflow}));
    let resolved = false;
    if (manual) {
        const actor = document?.actor ?? workflow?.actor ?? document;
        const [manualRoll] = await resolveManualRolls([roll], actor, flavor, {rollClass: Roll});
        resolved = manualRoll !== roll;
        roll = manualRoll;
    }
    if (!resolved) await roll.evaluate({maximize, minimize});
    if (message) return {message: await roll.toMessage({flavor, speaker}, {messageMode: mode}), roll};
    return roll;
}
/**
 * Roll the same formula again with every die at its highest result. The original roll is not changed.
 * @param {foundry.dice.Roll} roll        Roll to copy.
 * @returns {Promise<foundry.dice.Roll>}  A new evaluated roll of the same class.
 * @example
 * const maxRoll = await rollUtils.maximizeRoll(workflow.damageRolls[0]);
 */
async function maximizeRoll(roll) {
    return await new roll.constructor(roll.formula, roll.data, roll.options).evaluate({maximize: true});
}
/**
 * Add up the totals of several rolls.
 * @param {foundry.dice.Roll[]} rolls  Evaluated rolls.
 * @returns {number}
 * @example
 * const damage = rollUtils.getRollsTotal(workflow.damageRolls);
 */
function getRollsTotal(rolls) {
    return rolls.reduce((acc, roll) => acc + roll.total, 0);
}

/**
 * The formula a damage roll would use on a critical hit, built by the system's damage roll. Nothing is rolled.
 * @param {string} formula                       Damage formula.
 * @param {foundry.abstract.Document} document   Document supplying roll data. An active effect provides its parent's
 *                                               data, with its origin's data under `@effect.source`.
 * @param {object} [options]                     Additional options.
 * @param {MidiQOL.Workflow} [options.workflow]  Adds workflow data to the roll data.
 * @param {string} [options.bonusDamage]         Formula added on a critical hit.
 * @param {number} [options.bonusDice]           Extra dice added on a critical hit.
 * @param {number} [options.multiplier]          How many times the dice are multiplied. Defaults to `2`.
 * @param {boolean} [options.multiplyNumeric]    Also multiply flat terms.
 * @param {boolean} [options.powerfulCritical]   Maximize the extra dice.
 * @returns {string}
 * @example
 * rollUtils.getCriticalFormula('1d8 + 3', item); // '2d8 + 3'
 */
function getCriticalFormula(formula, document, {workflow, bonusDamage, bonusDice, multiplier = 2, multiplyNumeric, powerfulCritical} = {}) {
    return new CONFIG.Dice.DamageRoll(formula, dataUtils.getFormulaData({document, workflow}), {isCritical: true, critical: {bonusDamage, bonusDice, multiplier, multiplyNumeric, powerfulCritical}}).formula;
}
/**
 * Roll damage from a formula as the system's damage roll, with roll data from {@link dataUtils.getFormulaData}. Nothing
 * is posted to chat.
 * @param {string|number} formula                           Damage formula to roll.
 * @param {foundry.abstract.Document} document              Document supplying roll data, usually an item or activity.
 *                                                          An active effect provides its parent's data, with its
 *                                                          origin's data under `@effect.source`.
 * @param {object} [options]                                Additional options.
 * @param {MidiQOL.Workflow} [options.workflow]             Adds workflow data to the roll data.
 * @param {object} [options.critOptions]                    Critical handling, matching the system's damage roll
 *                                                          critical config.
 * @param {string} [options.critOptions.bonusDamage]        Formula added on a critical hit.
 * @param {number} [options.critOptions.bonusDice]          Extra dice added on a critical hit.
 * @param {number} [options.critOptions.multiplier]         How many times the dice are multiplied. Defaults to `2`.
 * @param {boolean} [options.critOptions.multiplyNumeric]   Also multiply flat terms.
 * @param {boolean} [options.critOptions.powerfulCritical]  Maximize the extra dice.
 * @param {boolean} [options.configured]                    The formula is already crit-scaled, so skip configuration.
 * @param {string} [options.flavor]                         Flavor shown on the roll.
 * @param {boolean} [options.isCritical]                    Roll this as a critical hit.
 * @param {string[]} [options.properties]                   Item properties carried onto the roll.
 * @param {string} [options.type]                           Damage type.
 * @param {object} [evaluateOptions]                        Evaluation options.
 * @param {boolean} [evaluateOptions.maximize]              Take the highest result on every die.
 * @param {boolean} [evaluateOptions.minimize]              Take the lowest result on every die.
 * @returns {Promise<CONFIG.Dice.DamageRoll>}               The evaluated roll.
 * @example
 * const roll = await rollUtils.damageRoll('2d6', workflow.activity, {type: 'fire', isCritical: workflow.isCritical});
 */
async function damageRoll(formula, document, {workflow, critOptions: {bonusDamage, bonusDice, multiplier = 2, multiplyNumeric, powerfulCritical} = {}, configured, flavor, isCritical, properties, type} = {}, {maximize, minimize} = {}) {
    return await new CONFIG.Dice.DamageRoll(String(formula), dataUtils.getFormulaData({document, workflow}), {
        critical: {bonusDamage, bonusDice, multiplier, multiplyNumeric, powerfulCritical},
        configured, flavor, isCritical, properties, type
    }).evaluate({maximize, minimize});
}
/**
 * Copy an evaluated damage roll with a different damage type. Every term with a flavor gets the new type, and the
 * roll's `type` option changes. The dice results and total are kept.
 * @param {CONFIG.Dice.DamageRoll} origRoll  Roll to copy.
 * @param {string} newType                   A key of `CONFIG.DND5E.damageTypes`.
 * @returns {Promise<CONFIG.Dice.DamageRoll>}
 * @example
 * workflow.damageRolls[0] = await rollUtils.getChangedDamageRoll(workflow.damageRolls[0], 'radiant');
 */
async function getChangedDamageRoll(origRoll, newType) {
    const data = origRoll.toJSON();
    data.options = {...data.options, type: newType};
    data.terms = data.terms.map(term => term.options?.flavor ? {...term, options: {...term.options, flavor: newType}} : term);
    const roll = CONFIG.Dice.DamageRoll.fromData(data);
    roll.resetFormula();
    return roll;
}
/**
 * Roll a formula and add it to an evaluated roll with midi-qol's `addRollToAsync`. The result keeps the original roll's
 * data.
 * @param {foundry.dice.Roll} roll        Evaluated roll to add to.
 * @param {string|number} formula         Formula to add.
 * @param {object} [options]              Additional options.
 * @param {object} [options.rollData]     Roll data for the added formula.
 * @returns {Promise<foundry.dice.Roll>}  A new combined roll.
 * @example
 * const newRoll = await rollUtils.addToRoll(workflow.attackRoll, '1d4', {rollData: actor.getRollData()});
 */
async function addToRoll(roll, formula, {rollData} = {}) {
    const newRoll = await MidiQOL.addRollToAsync(roll, new Roll(String(formula), rollData));
    newRoll.data = roll.data;
    return newRoll;
}
/**
 * Whether any active die result appears more than once across the given rolls.
 * @param {foundry.dice.Roll[]} rolls  Evaluated rolls.
 * @returns {boolean}
 * @example
 * const doubles = rollUtils.hasDuplicateDie(workflow.damageRolls);
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
 * Replace a roll's result with another roll's, keeping the old dice visible as discarded. The new roll's terms are
 * appended, and the formula and total are taken from it. Changes `roll` in place.
 * @param {foundry.dice.Roll} roll     Evaluated roll to change.
 * @param {foundry.dice.Roll} newRoll  Evaluated roll whose results replace the original.
 * @returns {foundry.dice.Roll}        The same roll.
 * @example
 * const newRoll = await rollUtils.rollDice(workflow.attackRoll.formula, {document: workflow.activity});
 * rollUtils.replaceRollShowDiscarded(workflow.attackRoll, newRoll);
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
 * Set the active result of the first d20 in a roll to a number and recalculate the total. The result counts as natural,
 * so a 20 still crits. Changes `roll` in place, and does nothing when the roll has no d20.
 * @param {foundry.dice.Roll} roll  Evaluated roll to change.
 * @param {number} number           Result the d20 shows.
 * @returns {foundry.dice.Roll}     The same roll.
 * @example
 * rollUtils.replaceD20(workflow.attackRoll, 20);
 */
function replaceD20(roll, number) {
    const d20Result = roll.terms.find(term => term.faces === 20)?.results.find(result => result.active);
    if (!d20Result) return roll;
    d20Result.result = number;
    delete d20Result.count;
    roll._total = roll._evaluateTotal();
    return roll;
}
/**
 * Force a roll's total by discarding every die result and adding a flat bonus that covers the difference. Flat terms
 * stay counted. Changes `roll` in place.
 * @param {foundry.dice.Roll} roll  Evaluated roll to change.
 * @param {number} total            Total to force the roll to.
 * @returns {foundry.dice.Roll}     The same roll.
 * @example
 * rollUtils.setTotalWithBonus(workflow.damageRolls[0], 12);
 */
function setTotalWithBonus(roll, total) {
    const number = total - discardTerms(roll);
    if (number) roll.terms.push(
        new OperatorTerm({operator: '+'}),
        new NumericTerm({number}).evaluate()
    );
    roll._total = total;
    roll.resetFormula();
    return roll;
}
/**
 * Mark every dice result in a roll as discarded.
 * @param {Roll} roll  Roll to modify, including parenthetical sub-rolls.
 * @returns {number}   Sum of the roll's numeric terms.
 */
function discardTerms(roll) {
    let numericTerms = 0;
    for (let i = 0; i < roll.terms.length; i++) {
        const term = roll.terms[i];
        const subtraction = roll.terms[i - 1]?.operator === '-' ? -1 : 1;
        if (term instanceof ParentheticalTerm) {
            numericTerms += discardTerms(term.roll) * subtraction;
            continue;
        }
        if (term instanceof NumericTerm) {
            numericTerms += term.total * subtraction;
            continue;
        }
        if (!term.results) continue;
        for (const result of term.results) {
            result.active = false;
            result.discarded = true;
        }
    }
    return numericTerms;
}
/**
 * Ask an actor's owner to make an ability check, save, skill check, tool check or death save, through midi-qol. The
 * request goes to the active player who owns the actor, or to the GM. A tool check rolls `-1` when the actor doesn't
 * have the tool.
 * @param {foundry.documents.Actor} actor                     Actor making the roll.
 * @param {'abil'|'check'|'save'|'test'|'skill'|'tool'|'deathSave'} request
 *                                                            Kind of roll. `abil` and `test` are ability checks.
 * @param {string} ability                                    Ability, skill or tool key.
 * @param {object} [options]                                  Additional options.
 * @param {number} [options.rollDC]                           DC the roll is checked against.
 * @param {boolean} [options.advantage]                       Roll with advantage.
 * @param {boolean} [options.disadvantage]                    Roll with disadvantage.
 * @param {boolean} [options.fast]                            Skip the roll dialog. Defaults to the owner's midi-qol
 *                                                            fast forward setting, from {@link shouldFastForward}.
 * @param {boolean} [options.message]                         Create a chat card. Defaults to `true`.
 * @param {'blind'|'gm'|'ic'|'public'|'self'} [options.mode]  Roll visibility mode. Defaults to `public`.
 * @returns {Promise<dnd5e.dice.D20Roll|undefined>}           Undefined when no roll comes back.
 * @example
 * const roll = await rollUtils.requestRoll(target.actor, 'save', 'dex', {rollDC: 15});
 * if (roll?.total >= 15) return;
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
        case 'skill':
            genericUtils.setProperty(data.saveDetails, 'rollAbilities', [actor.system.skills[ability]?.ability ?? CONFIG.DND5E.skills[ability]?.ability ?? '']);
            genericUtils.setProperty(data.saveDetails, 'rollSkills', [ability]);
            break;
        case 'tool':
            genericUtils.setProperty(data.saveDetails, 'rollAbilities', [actor.system.tools[ability]?.ability ?? CONFIG.DND5E.tools[ability]?.ability ?? '']);
            genericUtils.setProperty(data.saveDetails, 'rollTools', [ability]);
            break;
        case 'deathSave': break;
    }
    const result = (await MidiQOL.socket().executeAsUser('rollAbility', user.id, data))?.[0];
    if (!result || result instanceof CONFIG.Dice.D20Roll) return result;
    return result.terms ? CONFIG.Dice.D20Roll.fromData(result) : undefined;
}
/**
 * Run a contested roll between two tokens through midi-qol. Each side rolls with its best ability, save or skill from
 * the choices given. Returns the source's total minus the target's, or undefined when either token has no actor.
 * @param {object} params                                       Contest settings.
 * @param {string} params.flavor                                Text for the results chat card.
 * @param {boolean} params.message                              Display results in a chat card.
 * @param {foundry.documents.TokenDocument} params.sourceToken  Token making the contest.
 * @param {foundry.documents.TokenDocument} params.targetToken  Token opposing it.
 * @param {'abil'|'test'|'save'|'skill'} params.sourceRollType  Kind of roll the source makes.
 * @param {'abil'|'test'|'save'|'skill'} params.targetRollType  Kind of roll the target makes.
 * @param {string[]} params.sourceAbilities                     Abilities or skills the source may use. The best is
 *                                                              chosen.
 * @param {string[]} params.targetAbilities                     Abilities or skills the target may use. The best is
 *                                                              chosen.
 * @returns {Promise<number|undefined>}
 * @example
 * const result = await rollUtils.contestedRoll({
 *     sourceToken: workflow.token.document, targetToken: target.document, sourceRollType: 'skill', targetRollType: 'skill',
 *     sourceAbilities: ['ath'], targetAbilities: ['ath', 'acr'], message: true, flavor: item.name
 * });
 * if (result > 0) await effectUtils.createEffects(target.actor, [effectData]);
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
 * Whether midi-qol's fast forward settings skip the roll dialog for this kind of roll. GMs use the GM setting and
 * players use the player setting.
 * @param {'attack'|'damage'|'check'|'save'|'skill'|'tool'} rollType
 *                                         Kind of roll being made.
 * @param {foundry.documents.User} [user]  User making the roll. Defaults to the current user.
 * @returns {boolean}
 * @example
 * const fast = rollUtils.shouldFastForward('save', queryUtils.firstOwner(target.actor));
 */
function shouldFastForward(rollType, user = game.user) {
    const settings = MidiQOL.configSettings();
    return user.isGM ? settings.gmAutoFastForward.includes(rollType) : settings.autoFastForward.includes(rollType);
}
/**
 * Replace deterministic dice counts with their result, such as `(1+1)d6` to `2d6`.
 * An evaluated roll is returned unchanged.
 * @param {foundry.dice.Roll} roll  An unevaluated roll.
 * @returns {foundry.dice.Roll}     The roll cloned with a simplified formula.
 * @example
 * rollUtils.simplify(new Roll('(1+1)d6')).formula; // '2d6'
 */
function simplify(roll) {
    if (roll._evaluated) return roll;
    for (const term of roll.terms) {
        if (!(term._number instanceof Roll)) continue;
        if (!term._number.isDeterministic) continue;
        term._number = term._number.evaluateSync().total;
        term._formula = String(term._number);
    }
    roll.resetFormula();
    const formula = dnd5e.dice.simplifyRollFormula(roll.formula);
    return new roll.constructor(formula, roll.data, roll.options);
}

const REPLACE_MODES = {
    highest: true,
    lowest: false,
    replace: undefined
};
/**
 * Reroll the dice picked with {@link dialogUtils.selectDie} and recalculate the totals. The new result replaces the old
 * one, or the higher or lower of the two is kept.
 * @param {foundry.dice.Roll[]} rolls            Evaluated rolls the dice were picked from.
 * @param {string[]} resultKeys                  Selected dice, as returned by {@link dialogUtils.selectDie}.
 * @param {'highest'|'lowest'|'replace'} [keep]  Which result to keep. Defaults to `replace`.
 * @returns {Promise<foundry.dice.Roll[]>}       The provided rolls, modified in place.
 * @example
 * const selection = await dialogUtils.selectDie(workflow.damageRolls, item.name, content);
 * if (selection?.length) await rollUtils.rerollDice(workflow.damageRolls, selection, 'highest');
 */
async function rerollDice(rolls, resultKeys, keep) {
    const highest = REPLACE_MODES[keep];
    for (const key of resultKeys) {
        const parts = key.split('.');
        const term = genericUtils.getProperty(rolls, parts.slice(0, -2).join('.'));
        if (!term) continue;
        await term.roll({reroll: true});
        if (highest === undefined) {
            const result = genericUtils.getProperty(rolls, key);
            result.active = false;
            result.discarded = true;
        }
        else term.results = CONFIG.Dice.termTypes.DiceTerm._keepOrDrop(term.results, term.number, {highest});
        for (let i = 4; i < parts.length; i++) {
            const partKey = parts.slice(0, -i).join('.');
            const part = genericUtils.getProperty(rolls, partKey);
            if (part?.rolls) {
                const totals = part.rolls.map(r => r.total);
                if (part.function.constructor.name === 'AsyncFunction')
                    part.result = await part.function.apply(part, totals);
                else part.result = part.function.apply(part, totals);
                continue;
            }
            if (!part || !(part instanceof Roll)) continue;
            part._total = part._evaluateTotal();
        }
    }
    return rolls;
}
export default {
    rollDiceSync,
    rollDice,
    resolveManualRolls,
    getRollsTotal,
    maximizeRoll,
    getCriticalFormula,
    addToRoll,
    damageRoll,
    getChangedDamageRoll,
    hasDuplicateDie,
    replaceRollShowDiscarded,
    replaceD20,
    setTotalWithBonus,
    requestRoll,
    contestedRoll,
    shouldFastForward,
    simplify,
    rerollDice
};
