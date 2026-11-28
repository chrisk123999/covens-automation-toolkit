/**
 * Prompts and confirmation dialogs built on CAT's dialog window. Every prompt can be shown to another user, and the Who
 * Answers Dialogs setting can hand a player's prompt to the GM.
 * @module
 */
import DialogApp, {dialogQueue} from '../applications/dialog.mjs';
import {D20Bonus, DamageBonus} from '../lib/_module.mjs';
import constants from '../lib/constants.mjs';
import {actorUtils, automationUtils, distanceUtils, genericUtils, queryUtils, tokenUtils, uiUtils} from './_module.mjs';

/**
 * A token's name for display. When names are hidden, tokens with a neutral, hostile or secret disposition get a generic
 * Unknown Target label instead, while friendly tokens keep their name.
 * @param {foundry.documents.TokenDocument} token  Token to name.
 * @param {object} [options]                       Additional options.
 * @param {boolean} [options.hide]                 Hide the name. Defaults to CAT's Hide Names setting.
 * @param {object} [options.counter]               Running count that numbers hidden names. Incremented on each hidden
 *                                                 name.
 * @param {number} [options.counter.value]         Next number to use.
 * @returns {string}
 * @example
 * const counter = {value: 1};
 * const labels = targets.map(target => dialogUtils.getTokenName(target, {counter}));
 */
function getTokenName(token, {hide = game.settings.get('cat', 'hideNames'), counter} = {}) {
    if (!hide || token.disposition > 0) return token.name;
    const name = _loc('CAT.Dialog.UnknownTarget');
    return Number.isNumeric(counter?.value) ? name + '(' + counter.value++ + ')' : name;
}

const rememberedChoices = new Map();
/**
 * Show a raw CAT dialog to a user, sending it through a query when that user is not the current one. The Who Answers
 * Dialogs setting can redirect a player's dialog to the GM or show it to both, and the first answer wins. The other
 * prompts in this module are built on it.
 * @param {string} userId           User the dialog is meant for.
 * @param {string} title            Window title, localized.
 * @param {string} content          Text shown above the inputs, localized.
 * @param {Array} inputs            Input tree, as `[type, fields, options]` groups.
 * @param {string|Array} [buttons]  Button set such as `'yesNo'` or `'okCancel'`, or button definitions.
 * @param {object} [config]         Application options such as `width` and `height`.
 * @returns {Promise<object|null>}  Values keyed by input name, plus `buttons` holding the chosen button. Null if the
 *                                  dialog is closed.
 * @example
 * const result = await dialogUtils.runDialog(game.user.id, item.name, 'Choose a mode', inputs, 'okCancel');
 * if (!result?.buttons) return;
 */
async function runDialog(userId, title, content, inputs, buttons, config) {
    if (userId === game.user.id) return await DialogApp.dialog(title, content, inputs, buttons, config);
    const remoteConfig = DialogApp.remoteConfig(config, [userId]);
    return await queryUtils.query('dialog', game.users.get(userId), {title, content, inputs, buttons, config: remoteConfig}, remoteConfig.timeLimit * 1000);
}
/**
 * {@link runDialog}, but queued on the answering client. The dialog waits until that user's earlier queued dialogs are
 * answered.
 * @param {string} userId           User the dialog is meant for.
 * @param {string} title            Window title, localized.
 * @param {string} content          Text shown above the inputs, localized.
 * @param {Array} inputs            Input tree, as `[type, fields, options]` groups.
 * @param {string|Array} [buttons]  Button set such as `'yesNo'` or `'okCancel'`, or button definitions.
 * @param {object} [config]         Application options such as `width` and `height`.
 * @returns {Promise<object|null>}  Values keyed by input name, plus `buttons` holding the chosen button. Null if the
 *                                  dialog is closed.
 */
async function runQueuedDialog(userId, title, content, inputs, buttons, config) {
    if (userId === game.user.id) return await dialogQueue.showDialog(async (...args) => await DialogApp.dialog(...args), title, content, inputs, buttons, config);
    const remoteConfig = DialogApp.remoteConfig(config, [userId]);
    return await queryUtils.query('queuedDialog', game.users.get(userId), {title, content, inputs, buttons, config: remoteConfig}, remoteConfig.timeLimit * 1000);
}
/**
 * Prompt with one button per choice. Clicking a button confirms it immediately.
 * @param {string} title                        Window title.
 * @param {string} content                      Text shown above the buttons.
 * @param {Array<[string, *, object]>} buttons  Label, value, then options such as `image`.
 * @param {object} [options]                    Additional options.
 * @param {boolean} [options.displayAsRows]     Stack the buttons one per row. Defaults to true.
 * @param {string} [options.userId]             User the dialog is shown to. Defaults to the current user.
 * @param {'alphabetical'|null} [options.sort]  Sort the buttons by label. Unsorted by default.
 * @param {*} [options.timeoutValue]            Value chosen when the prompt timer runs out. Without one, the timer
 *                                              closes the dialog.
 * @returns {Promise<*|false>}                  The chosen value, or false if the dialog is closed.
 * @example
 * const choice = await dialogUtils.buttonDialog(item.name, 'Choose an effect', [['Blinded', 'blinded'], ['Deafened', 'deafened']]);
 * if (!choice) return;
 */
async function buttonDialog(title, content, buttons, {displayAsRows = true, userId = game.user.id, sort = null, timeoutValue} = {}) {
    let inputs = [
        ['button', [], {displayAsRows: displayAsRows}]
    ];
    if (sort === 'alphabetical') buttons = [...buttons].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en', {sensitivity: 'base'}));
    for (let [label, value, options] of buttons) {
        inputs[0][1].push({label: label, name: value, options: options ?? {}});
    }
    let result = await runDialog(userId, title, content, inputs, undefined, {width: 400, timeoutResult: timeoutValue});
    return result?.buttons ?? false;
}
/**
 * Prompt for one of an actor's abilities, with each button showing the actor's modifier. The best ability, from
 * {@link actorUtils.getBestAbility}, is starred and listed first, and is chosen when the prompt timer runs out.
 * @param {string} title             Window title.
 * @param {string} content           Text shown above the buttons.
 * @param {Actor5e} actor            Actor whose modifiers are shown.
 * @param {string[]} abilities       Ability keys to offer.
 * @param {object} [options]         Additional options.
 * @param {string} [options.userId]  User the dialog is shown to. Defaults to the current user.
 * @returns {Promise<string|false>}  The chosen ability key, or false if the dialog is closed.
 * @example
 * const ability = await dialogUtils.abilityDialog(item.name, 'Choose an ability', actor, ['int', 'wis', 'cha']);
 */
async function abilityDialog(title, content, actor, abilities, {userId = game.user.id} = {}) {
    const best = actorUtils.getBestAbility(actor, abilities);
    const buttons = abilities.map(key => {
        const label = `${CONFIG.DND5E.abilities[key].label} (${dnd5e.utils.formatNumber(actor.system.abilities[key]?.mod ?? 0, {signDisplay: 'always'})})`;
        return [label, key, {image: CONFIG.DND5E.abilities[key].icon, icon: key === best ? 'fa-solid fa-star' : undefined}];
    }).sort((a, b) => (b[1] === best) - (a[1] === best));
    return await buttonDialog(title, content, buttons, {userId, timeoutValue: best});
}
/**
 * Prompt for a distance with one button per value, labeled in the scene's units with
 * {@link distanceUtils.formatDistance}. With `none`, a button worth `0` is listed first.
 * @param {string} title                             Window title.
 * @param {string} content                           Text shown above the buttons.
 * @param {number[]} distances                       Distances in feet.
 * @param {object} [options]                         Additional options.
 * @param {string} [options.none]                    Label for a first button that picks no distance.
 * @param {foundry.documents.Scene} [options.scene]  Scene whose units label the buttons. Defaults to the viewed scene.
 * @param {string} [options.userId]                  User the dialog is shown to. Defaults to the current user.
 * @returns {Promise<number>}                        The chosen distance in feet. `0` for the none button or when the
 *                                                   dialog is closed.
 * @example
 * const distance = await dialogUtils.distanceDialog(item.name, 'How far to push?', [5, 10], {none: 'Don\'t push', scene: token.parent});
 * if (!distance) return;
 */
async function distanceDialog(title, content, distances, {none, scene = canvas.scene, userId} = {}) {
    const buttons = [...(none ? [[none, 0]] : []), ...distances.map(distance => [distanceUtils.formatDistance(scene, distance), distance])];
    return Number(await buttonDialog(title, content, buttons, {userId}));
}
/**
 * Prompt for a single number.
 * @param {string} title                    Window title.
 * @param {string} content                  Text shown above the input.
 * @param {object} [input]                  Input label, name and options.
 * @param {string} input.label              Label, localized.
 * @param {string} input.name               Input name.
 * @param {object} input.options            Number input options, such as `min` and `max`.
 * @param {object} [options]                Additional options.
 * @param {string|Array} [options.buttons]  Button set. Defaults to `'okCancel'`.
 * @param {string} [options.userId]         User the dialog is shown to. Defaults to the current user.
 * @returns {Promise<number|undefined>}     The entered number, or undefined if cancelled or closed.
 * @example
 * const amount = await dialogUtils.numberDialog(item.name, 'How many hit points?', {label: 'DND5E.HitPoints', name: 'amount', options: {min: 1, max: 10}});
 */
async function numberDialog(title, content, input = {label: 'Label', name: 'identifier', options: {}}, {buttons = 'okCancel', userId = game.user.id} = {}) {
    let inputs = [
        ['number',
            [{
                label: _loc(input.label),
                name: input.name,
                options: input.options
            }]
        ]
    ];
    let result = await runDialog(userId, title, content, inputs, buttons);
    return result?.[input.name];
}
/**
 * Prompt for one entry from a dropdown. Bare strings are accepted in place of `{value, label}` pairs, and an empty list
 * shows a single None entry. The entries are written back onto `input.options.options`.
 * @param {string} title                        Window title.
 * @param {string} content                      Text shown above the input.
 * @param {object} [input]                      Input label, name and options.
 * @param {string} input.label                  Label, localized.
 * @param {string} input.name                   Input name.
 * @param {object} input.options                Input options, with the entries under `options`.
 * @param {object} [options]                    Additional options.
 * @param {string|Array} [options.buttons]      Button set. Defaults to `'okCancel'`.
 * @param {string} [options.userId]             User the dialog is shown to. Defaults to the current user.
 * @param {'alphabetical'|null} [options.sort]  Sort the entries by label. Unsorted by default.
 * @returns {Promise<*|undefined>}              The chosen value, or undefined if cancelled or closed.
 * @example
 * const options = [{value: 'fire', label: 'Fire'}, {value: 'cold', label: 'Cold'}];
 * const choice = await dialogUtils.selectDialog(item.name, 'Choose an element', {label: 'DND5E.DamageType', name: 'element', options: {options}});
 */
async function selectDialog(title, content, input = {label: 'Label', name: 'identifier', options: {}}, {buttons = 'okCancel', userId = game.user.id, sort = null} = {}) {
    if (!input.options) input.options = {};
    let inputOptions = input.options.options ?? [];
    if (!inputOptions.length) inputOptions = [_loc('DND5E.None')];
    if (inputOptions[0].label === undefined) {
        inputOptions = inputOptions.map(text => {return {value: text, label: text};});
    }
    if (sort === 'alphabetical') inputOptions = inputOptions.sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
    input.options.options = inputOptions;
    let inputs = [
        ['selectOption',
            [{
                label: _loc(input.label),
                name: input.name,
                options: input.options
            }]
        ]
    ];
    let result = await runDialog(userId, title, content, inputs, buttons);
    return result?.[input.name];
}
/**
 * Prompt for one or more documents. Accepts world documents and compendium index entries, and a chosen index entry is
 * loaded with `fromUuid`. With `max` of one the dialog shows one button per document. Above one it shows an amount per
 * document, or checkboxes with `checkbox`.
 * @param {string} title                                       Window title.
 * @param {string} content                                     Text shown above the inputs.
 * @param {Array<foundry.abstract.Document|object>} documents  Documents to choose between.
 * @param {object} [options]                                   Additional options.
 * @param {number} [options.max]                               Total selectable. Defaults to 1. Above one, the result is
 *                                                             an array.
 * @param {boolean} [options.displayTooltips]                  Show each document's description on hover.
 * @param {'alphabetical'|'cr'|'level'|null} [options.sort]    How the entries are ordered.
 * @param {string} [options.userId]                            User the dialog is shown to.
 * @param {boolean} [options.addNoneDocument]                  Append a `None` entry.
 * @param {boolean} [options.showCR]                           Append each document's challenge rating to its label.
 * @param {boolean} [options.showSpellLevel]                   Append each document's spell level to its label.
 * @param {boolean} [options.showUses]                         Append each document's remaining uses to its label.
 * @param {boolean} [options.displayReference]                 Add a link opening the document's sheet.
 * @param {boolean} [options.combobox]                         Render as a searchable combobox.
 * @param {boolean} [options.checkbox]                         Render as checkboxes rather than an amount per document.
 * @param {object} [options.weights]                           Per-document cost against `max`, keyed by document.
 * @param {object} [options.maxes]                             Per-document maximum, keyed by document.
 * @param {Function} [options.validate]                        Receives the current selection; a falsy return blocks
 *                                                             confirmation.
 * @param {object} [options.tags]                              Per-document label tags, keyed by document.
 * @param {object} [options.selects]                           Per-document dropdown, keyed by document.
 * @param {Set} [options.locked]                               Documents that cannot be deselected.
 * @param {Set} [options.checked]                              Documents that start selected, for re-opening a saved
 *                                                             choice.
 * @param {string[]} [options.keys]                            Override the keys documents are identified by, in the
 *                                                             same order.
 * @param {object} [options.labels]                            Override document labels, keyed by document.
 * @returns {Promise<foundry.abstract.Document|Array<{document: foundry.abstract.Document, key: string, amount: number, select: *}>|false>}
 *                                                             The chosen document when `max` is one. Otherwise one
 *                                                             entry per offered document with its amount, or only
 *                                                             `document` and `amount` for a combobox. False if
 *                                                             cancelled, closed or None is chosen.
 * @example
 * const weapon = await dialogUtils.selectDocumentDialog(item.name, 'Choose a weapon', actor.itemTypes.weapon, {sort: 'alphabetical'});
 * if (!weapon) return;
 */
async function selectDocumentDialog(title, content, documents, {max = 1, displayTooltips = false, sort = null, userId = game.user.id, addNoneDocument = false, showCR = false, showSpellLevel = false, showUses = false, displayReference = false, combobox = false, checkbox = false, weights = {}, maxes = {}, validate = null, tags = {}, selects = {}, locked = new Set(), checked = new Set(), keys = null, labels = {}} = {}) {
    let sortCmp = sort === 'alphabetical' ? (a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'})
        : sort === 'cr' ? (a, b) => (a.system?.details?.cr ?? 0) - (b.system?.details?.cr ?? 0)
            : sort === 'level' ? (a, b) => (a.system?.level ?? 0) - (b.system?.level ?? 0) || a.name.localeCompare(b.name, 'en', {sensitivity: 'base'})
                : null;
    if (sortCmp) {
        let order = documents.map((d, i) => i).sort((a, b) => sortCmp(documents[a], documents[b]));
        documents = order.map(i => documents[i]);
        if (keys) keys = order.map(i => keys[i]);
    }
    let isCompendiumDoc = !documents[0]?.id;
    let docKey = d => isCompendiumDoc ? (d.uuid ?? d.actor?.uuid) : (d.id ?? d._id ?? d.actor?.id);
    let resolveDoc = async key => isCompendiumDoc ? await fromUuid(key) : documents.find(d => docKey(d) === key);
    let ordinal = n => {
        if (n === 0) return _loc('DND5E.SpellCantrip');
        let s = ['th', 'st', 'nd', 'rd'], v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    let buildEntry = (doc, id) => {
        let tagList = [];
        if (showCR) tagList.push(_loc('DND5E.CRLabel', {cr: dnd5e.utils.formatCR(doc.system?.details?.cr ?? 0, {narrow: false})}));
        if (showSpellLevel) tagList.push(ordinal(doc.system?.level ?? 0));
        let uses = doc.system?.uses ?? doc.uses;
        if (showUses && uses?.max) tagList.push(`${uses.value ?? '?'}/${uses.max}`);
        let extraTag = tags[id ?? doc.id ?? doc._id ?? doc.uuid];
        if (extraTag) tagList.push(extraTag);
        let label = (labels?.[id] ?? doc.name) + (doc.system?.linkedActivity ? ' (' + doc.system.linkedActivity.item.name + ')' : '');
        return {label, tag: tagList.join(' · ')};
    };
    let buildLabel = doc => {
        let {label, tag} = buildEntry(doc);
        return tag ? `${label} [${tag}]` : label;
    };
    let description = async doc => {
        let text = '';
        switch (doc.documentName) {
            case 'Item': text = doc.system?.description.value; break;
            case 'Activity': text = doc.description.value || doc.item.system?.description.value; break;
            case 'ActiveEffect':
            default: text = doc.description; break;
        }
        return await uiUtils.enrichHTML(text, doc.getRollData ? doc.getRollData() : doc.actor?.getRollData() ?? {});
    };
    let hasTag = showCR || showSpellLevel || showUses || Object.keys(tags).length > 0;
    let widthCfg = hasTag ? {width: 440} : undefined;
    let inputs, result;
    if (max === 1) {
        if (combobox) {
            let opts = documents.map(d => {
                let {label, tag} = buildEntry(d);
                return {value: docKey(d), label, tag, image: d.img};
            });
            if (addNoneDocument) opts.push({value: 'none', label: _loc('DND5E.None'), image: 'icons/svg/cancel.svg'});
            inputs = [['combobox', [{label: '', name: 'document', options: {placeholder: '', options: opts}}]]];
            result = await runDialog(userId, title, content, inputs, 'okCancel', widthCfg);
            if (!result?.buttons || !result.document || result.document === 'none') return false;
            return await resolveDoc(result.document);
        }
        let inputFields = await Promise.all(documents.map(async d => ({
            label: buildLabel(d),
            name: docKey(d),
            options: {
                image: d.img,
                tooltip: displayTooltips ? await description(d) : undefined,
                reference: (displayReference && d.reference) ? d.reference : undefined
            }
        })));
        if (addNoneDocument) inputFields.push({label: _loc('DND5E.None'), name: 'none', options: {image: 'icons/svg/cancel.svg'}});
        inputs = [['button', inputFields, {displayAsRows: true}]];
        result = await runDialog(userId, title, content, inputs, undefined);
        if (!result?.buttons || result.buttons === 'none') return false;
        return await resolveDoc(result.buttons);
    }
    let multiKey = d => d.id ?? d._id;
    if (combobox) {
        let opts = documents.map(d => {
            let {label, tag} = buildEntry(d);
            return {
                value: multiKey(d),
                label,
                tag,
                image: d.img,
                weight: weights?.[multiKey(d)] ?? 1,
                max: maxes?.[multiKey(d)] ?? max
            };
        });
        inputs = [['comboboxMulti', [{label: '', name: 'documents', options: {options: opts, amounts: true, maxTotal: max ?? null}}]]];
        let cfg = {height: 'auto', ...(widthCfg ?? {})};
        result = await runDialog(userId, title, content, inputs, 'okCancel', cfg);
        if (!result?.buttons || !result.documents) return false;
        let parsed = JSON.parse(result.documents);
        if (!parsed.length) return false;
        return parsed.map(({value, amount}) => ({
            document: documents.find(d => multiKey(d) === value),
            amount: Number(amount)
        }));
    }
    let idOf = i => keys ? keys[i] : multiKey(documents[i]);
    let inputFields = await Promise.all(documents.map(async (d, i) => {
        let id = idOf(i);
        let {label, tag} = buildEntry(d, id);
        let isLocked = locked.has(id);
        return {
            label: checkbox ? label : buildLabel(d),
            name: id,
            options: {
                image: d.img,
                tooltip: displayTooltips ? await description(d) : undefined,
                hint: checkbox ? tag : undefined,
                select: checkbox ? selects?.[id] : undefined,
                locked: isLocked,
                isChecked: isLocked || checked.has(id),
                minAmount: 0,
                maxAmount: maxes?.[id] ?? max,
                weight: weights?.[id] ?? 1
            }
        };
    }));
    let keyToDoc = new Map(documents.map((d, i) => [idOf(i), d]));
    inputs = [[checkbox ? 'checkbox' : 'selectAmount', inputFields, {displayAsRows: true, totalMax: max}]];
    result = await runDialog(userId, title, content, inputs, 'okCancel', {height: 'auto', validate});
    if (!result?.buttons) return false;
    delete result.buttons;
    return Object.entries(result).map(([key, value]) => {
        let document = keyToDoc.get(key);
        if (!document) return null;
        return {document, key, amount: Number(value), select: result['sel-' + key]};
    }).filter(i => i);
}
/**
 * Build the input tree for one phase of the optional bonus dialog, with a running formula header per roll type and the
 * bonuses grouped into third-party, optional, contextual and applied sections. Sorts `bonuses` by name in place.
 * Toggling, scaling or retargeting a bonus in the dialog updates the bonus objects directly.
 * @param {DamageBonus[]|D20Bonus[]} bonuses              Bonuses offered in this phase.
 * @param {object} [options]                              Additional options.
 * @param {foundry.dice.Roll[]} [options.rolls]           The d20 rolls that selected bonuses are added to.
 * @param {foundry.dice.Roll[]} [options.damageRolls]     Damage rolls already built for this workflow.
 * @param {MidiQOL.Workflow} [options.workflow]           Workflow the bonuses belong to.
 * @param {BonusCost} [options.spent]                     Resources committed in earlier phases.
 * @param {DamageBonus[]|D20Bonus[]} [options.committed]  Bonuses already applied in earlier phases, listed as locked.
 * @param {object} [options.outcome]                      Known result of the roll, once there is one.
 * @param {boolean} [options.outcome.success]             Whether the roll hit or succeeded.
 * @param {boolean} [options.outcome.noDC]                The roll has no DC to compare against.
 * @returns {Promise<{inputs: Array, hasOptional: boolean, readInputs: Function}|undefined>}
 *                                                        Undefined when there are no bonuses, committed bonuses or
 *                                                        rolls. `hasOptional` is false when nothing in the phase can be
 *                                                        changed. `readInputs` copies the dialog result back onto the
 *                                                        bonuses.
 */
async function buildBonusInputs(bonuses, {rolls, workflow, damageRolls, spent, committed = [], outcome} = {}) {
    if (!bonuses.length && !committed.length && !rolls?.length) return;
    bonuses = bonuses.sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}));
    const roll = rolls?.[0];
    const missed = outcome?.success === false;
    const attack = !!workflow?.activity?.hasAttack;
    const outcomeLabel = outcome && _loc(outcome.noDC ? 'CAT.OptionalBonus.NoDC' :
        outcome.success
            ? (attack ? 'CAT.OptionalBonus.Hit' : 'CAT.OptionalBonus.Success')
            : (attack ? 'CAT.OptionalBonus.Miss' : 'CAT.OptionalBonus.Failure'));
    let rollTotal;
    if (rolls?.length) {
        if (rolls.every(r => r._evaluated)) rollTotal = rolls.reduce((t, r) => {
            r.terms.forEach((term, i) => {
                if (term.faces) genericUtils.setProperty(r.options, 'original.' + i, term.results);
            });
            return t + r.total;
        }, 0);
        rolls = rolls.map(r => {
            if (!r._evaluated) return r;
            const clone = r.clone();
            if (clone.options.original)
                for (const [index, results] of Object.entries(clone.options.original))
                    clone.terms[index].results = results;
            return clone;
        });
    }
    const groups = [
        {cls: D20Bonus, rolls: rolls ?? [], bonuses: bonuses.filter(b => b instanceof D20Bonus)},
        {cls: DamageBonus, rolls: damageRolls?.map(r => r.clone()) ?? [], bonuses: bonuses.filter(b => b instanceof DamageBonus)}
    ].filter(group => group.bonuses.length || group.rolls.length);
    const groupOf = bonus => groups.find(group => bonus instanceof group.cls);
    const aggregateOf = group => group.rolls.length || group.bonuses.some(b => b.active)
        ? group.cls.CombineRolls(group.rolls, group.bonuses, {workflow})
        : [];
    const validateAll = context => {
        const budgets = new Map();
        for (const group of groups) {
            group.cls.ValidateAll(group.bonuses, {rollTotal, workflow, spent, roll, outcome});
            budgets.set(group.cls, group.cls.AddCosts(genericUtils.deepClone(spent ?? {}), group.bonuses.filter(b => b.active)));
        }
        for (const bonusContext of context) {
            const index = bonusContext.name.match(/\d+/)[0];
            const bonus = bonuses[index];
            bonusContext.isChecked = bonus.active;
            bonusContext.hints = bonus.validateHints;
            const {cls} = groupOf(bonus);
            bonusContext.disabled = !bonus.active && !cls.CheckCost(bonus, budgets.get(cls));
        }
    };
    const tagLabel = (key, tooltip) => {
        const [type, ...parts] = key.split('.');
        const uuid = parts.join('.');
        const document = fromUuidSync(uuid);
        tooltip ||= document?.name;
        const uses = type === 'itemUses' ? document?.system.uses : type === 'activityUses' ? document?.uses : '';
        if (uses) {
            const recoverAll = uses.recovery.find(r => r.type === 'recoverAll');
            const allLabel = CONFIG.DND5E.limitedUsePeriods[recoverAll?.period];
            if (allLabel) return {label: _loc('DND5E.AbilityUseConsumableLabel', {max: uses.max, per: allLabel.abbreviation}), tooltip};
            const formula = uses.recovery.find(r => r.type === 'formula');
            const formulaLabel = CONFIG.DND5E.limitedUsePeriods[formula?.period];
            if (formulaLabel) return {label: _loc('DND5E.AbilityUseConsumableLabel', {max: formula.formula, per: formulaLabel.abbreviation}), tooltip};
        }
        if (type === 'effect') return {label: _loc('CAT.OptionalBonus.EndsEffect'), tooltip};
        return {label: CONFIG.DND5E.activityActivationTypes[type]?.label ?? CONFIG.DND5E.activityConsumptionTypes[type]?.label ?? type, tooltip};
    };
    const updateFormula = (ctx, bonus) => {
        const group = groupOf(bonus);
        if (!group) return;
        const formula = ctx.subheaders?.[groups.indexOf(group)];
        if (!formula?.isFormula) return;
        group.aggregate = aggregateOf(group);
        formula.groups = formula.parseNewFormula(group.aggregate).groups;
        if (bonus instanceof D20Bonus) {
            let total = rollTotal;
            let anyActive = false;
            let deterministic = true;
            for (const b of group.bonuses) {
                if (!b.active) continue;
                anyActive = true;
                if (!b.roll.isDeterministic) {
                    deterministic = false;
                    break;
                }
                total += b.roll.clone().evaluateSync().total;
            }
            formula.groups[0].total = total;
            formula.groups[0].deterministic = deterministic;
            if (outcomeLabel) formula.groups[0].outcome = anyActive ?  _loc('CAT.OptionalBonus.Unknown') : outcomeLabel;
        }
    };
    const formulaTag = bonus => {
        const formula = workflow?.isCritical && bonus instanceof DamageBonus ? DamageBonus.GetCriticalRoll(bonus).formula : bonus.roll.formula;
        if (formula === '0') return {label: 'CAT.OptionalBonus.Rider.Label', id: 'formula', tooltip: 'CAT.OptionalBonus.Rider.Hint'};
        const type = CONFIG.DND5E.damageTypes[bonus.damageType] ?? CONFIG.DND5E.healingTypes[bonus.damageType];
        return {label: formula, id: 'formula', image: type?.icon, tooltip: type?.label};
    };
    const sliderChange = ({bonus, fullContext, thisContext, input, getInputById}) => {
        const preFormula = bonus.roll.formula;
        bonus.updateScaling(input.value - 1, workflow, bonuses, rollTotal);
        input.hints = bonus.scalingHints;
        const targets = thisContext.inputs.find(i => i.isComboboxMulti)?.options[0];
        if (targets) {
            targets.maxTotal = bonus.maxTargets;
            targets.hints = bonus.maxTargetsHints;
            const selected = targets.options.filter(o => o.selected);
            if (selected.length > targets.maxTotal)
                for (let i = 0; i < selected.length - targets.maxTotal; i++)
                    selected[i].selected = false;
        }
        const tags = getInputById(input.id.split(DialogApp.SUBINPUT_SEPARATOR)[0])?.tags ?? [];
        for (const t of tags) {
            if (t.id === 'formula') {
                const info = formulaTag(bonus);
                t.tooltip = info.tooltip;
                t.label = info.label;
                t.image = info.image;
                continue;
            }
            const hint = bonus.scalingHints.find(h => h.id === t.id);
            if (!hint) continue;
            t.tooltip = hint.tooltip;
            t.icon = hint.icon;
        }
        if (bonus.active && bonus.roll.formula !== preFormula) updateFormula(fullContext, bonus);
        return true;
    };
    const targetsChange = ({bonus, input}) => {
        const selected = new Set(input.options.filter(o => o.selected).map(o => o.value));
        if (selected.size === bonus.targets.size) return;
        bonus.targets = bonus.targetOptions.filter(t => selected.has(t.id));
    };
    const damageChange = ({bonus, fullContext, input, getInputById}) => {
        bonus.damageType = input.value;
        if (bonus.active) updateFormula(fullContext, bonus);
        const tag = getInputById(input.id.split(DialogApp.SUBINPUT_SEPARATOR)[0])?.tags?.find(t => t.id === 'formula');
        if (!tag) return bonus.active;
        const type = CONFIG.DND5E.damageTypes[bonus.damageType] ?? CONFIG.DND5E.healingTypes[bonus.damageType];
        tag.image = type.icon;
        tag.tooltip = type.label;
        return true;
    };
    const extraChange = ({bonus, name, ctx, onchange}) => {
        onchange?.({...ctx, bonus});
        const parent = ctx.fullContext.inputs.find(group => group.options?.some(o => o.name === name + '.active'));
        if (parent) validateAll(parent.options);
        updateFormula(ctx.fullContext, bonus);
        const tag = ctx.getInputById(ctx.input.id.split(DialogApp.SUBINPUT_SEPARATOR)[0])?.tags?.find(t => t.id === 'formula');
        if (tag) {
            const info = formulaTag(bonus);
            tag.tooltip = info.tooltip;
            tag.label = info.label;
            tag.image = info.image;
        }
        return true;
    };
    for (const group of groups) group.aggregate = aggregateOf(group);
    const hide = game.settings.get('cat', 'hideNames');
    const optional = [], contextual = [], thirdParty = [];
    for (let i = 0; i < bonuses.length; i++) {
        const bonus = bonuses[i];
        const name = 'b-' + i;
        const subinputs = [];
        if (bonus.maxScaling > 1)
            subinputs.push(['slider', [{
                name: name + '.scaling',
                hints: bonus.scalingHints,
                label: 'CAT.OptionalBonus.Scaling',
                options: {
                    min: 1,
                    max: bonus.maxScaling,
                    step: 1,
                    onchange: ({fullContext, thisContext, input, getInputById}) => sliderChange({bonus, fullContext, thisContext, input, getInputById})
                }
            }]]);
        const counter = {value: 1};
        if (bonus.targetOptions?.size && bonus.maxTargets > 0)
            subinputs.push(['comboboxMulti', [{
                name: name + '.targets',
                hints: bonus.maxTargetsHints,
                label: 'CAT.OptionalBonus.Targets',
                options: {
                    maxTotal: bonus.maxTargets,
                    options: bonus.targetOptions.map(t => ({
                        selected: bonus.targets.some(tgt => tgt.id === t.id),
                        label: getTokenName(t, {hide, counter}),
                        image: t.texture.src,
                        value: t.id
                    })),
                    onchange: ({input}) => targetsChange({bonus, input})
                }
            }]]);
        if (bonus.damageTypes?.size > 1)
            subinputs.push(['combobox', [{
                name: name + '.damageType',
                label: 'CAT.OptionalBonus.DamageType',
                options: {
                    value: bonus.damageType,
                    options: constants.damageTypeOptions.filter(o => bonus.damageTypes.has(o.value)),
                    onchange: ({fullContext, input, getInputById}) => damageChange({bonus, fullContext, input, getInputById})
                }
            }]]);
        for (const [type, fields, options] of bonus.extraInputs) {
            if (type === 'radio') options.radioName = name + '.inputs.' + (options.radioName ?? 'radio');
            subinputs.push([type, fields.map(f => {
                if (type !== 'radio') f.name = name + '.inputs.' + f.name;
                return {...f, options: {...f.options, onchange: ctx => extraChange({bonus, name, ctx, onchange: f.options?.onchange})}};
            }), options]);
        }
        const tags = [];
        if (bonus.roll) {
            tags.push(formulaTag(bonus));
            if (bonus.damageTypes?.size > 1) tags.push({label: 'CAT.OptionalBonus.DamageTypeChoice', id: 'damageType'});
        }
        if (bonus.scalingHints?.length) tags.push(...bonus.scalingHints.map(h => ({...h, ...tagLabel(h.id, h.tooltip)})));
        if (bonus.maxScaling > 1) tags.push({label: 'CAT.OptionalBonus.Scaleable', id: 'scaling'});
        if (bonus.maxTargets > 0) tags.push({label: 'CAT.OptionalBonus.Targeted', id: 'targets'});
        const fieldset = bonus.optional ? bonus.isThirdParty ? thirdParty : optional : contextual;
        fieldset.push({
            label: bonus.isThirdParty ? `[${bonus.actor.name}] ${bonus.name}` : bonus.name,
            hints: bonus.validateHints,
            name: name + '.active',
            onrequest: async () => await bonus.request(workflow, bonuses, rollTotal),
            options: {
                image: bonus.img,
                tooltip: await uiUtils.enrichHTML(bonus.description, bonus.roll.data),
                subinputs,
                locked: !bonus.optional,
                isChecked: !bonus.optional,
                tags,
                onchange: ({fullContext, input, group}) => {
                    bonus.active = input.isChecked;
                    validateAll(group.options);
                    updateFormula(fullContext, bonus);
                    return true;
                }
            }
        });
    }
    const applied = [];
    const appliedOrder = [...committed].sort((a, b) => (a instanceof D20Bonus ? 0 : 1) - (b instanceof D20Bonus ? 0 : 1));
    for (const bonus of appliedOrder) {
        const appliedType = CONFIG.DND5E.damageTypes[bonus.damageType] ?? CONFIG.DND5E.healingTypes[bonus.damageType];
        applied.push({
            label: bonus.name,
            name: 'applied-' + applied.length,
            options: {
                image: bonus.img,
                tooltip: await uiUtils.enrichHTML(bonus.description, bonus.roll.data),
                locked: true,
                isChecked: true,
                tags: [{label: bonus.roll.formula, id: 'formula', image: appliedType?.icon, tooltip: appliedType?.label}]
            }
        });
    }
    const inputs = [];
    for (const group of groups) {
        const isD20 = group.cls === D20Bonus;
        inputs.push(['formula', group.aggregate, {header: true, total: isD20 ? rollTotal : undefined, outcome: isD20 ? outcomeLabel : undefined, muted: !isD20 && missed}]);
    }
    if (thirdParty.length) inputs.push(['request', thirdParty, {displayAsRows: true, legend: contextual.length + optional.length > 0 ? 'CAT.OptionalBonus.ThirdParty' : ''}]);
    if (optional.length) inputs.push(['checkbox', optional, {displayAsRows: true, legend: contextual.length + thirdParty.length > 0 ? 'CAT.OptionalBonus.Optional' : ''}]);
    if (contextual.length) inputs.push(['checkbox', contextual, {displayAsRows: true, legend: 'CAT.OptionalBonus.Contextual'}]);
    if (applied.length) inputs.push(['checkbox', applied, {displayAsRows: true, legend: 'CAT.OptionalBonus.Applied'}]);
    const readInputs = (results, {remote = false} = {}) => {
        for (let i = 0; i < bonuses.length; i++)
            if (bonuses[i].extraInputs.length) bonuses[i].inputs = results?.['b-' + i]?.inputs ?? {};
        if (remote) bonuses.forEach((bonus, i) => applyRemoteResult(bonus, results?.['b-' + i]));
    };
    const applyRemoteResult = (bonus, result) => {
        if (!result) return;
        if (bonus.optional) bonus.active = !!result.active;
        if (result.scaling) bonus.updateScaling(Number(result.scaling) - 1, workflow, bonuses, rollTotal);
        if (result.targets) {
            const ids = new Set(typeof result.targets === 'string' ? (result.targets.startsWith('[') ? JSON.parse(result.targets) : result.targets.split(',')) : result.targets);
            bonus.targets = bonus.targetOptions.filter(token => ids.has(token.id));
        }
        if (result.damageType) bonus.damageType = result.damageType;
    };
    return {inputs, hasOptional: !!(optional.length || thirdParty.length || contextual.some(c => c.options.subinputs.length)), readInputs};
}
/**
 * Combobox options for an actor's spell slots that have a use left, lowest level first. Pact slots show their level in
 * the label.
 * @param {foundry.documents.Actor} actor  Actor the slots belong to.
 * @returns {{value: string, level: number, label: string, image: string}[]}
 *                                         `value` is the slot key, such as `spell3` or `pact`.
 * @example
 * const options = dialogUtils.getSpellSlotOptions(actor);
 * const slot = await dialogUtils.selectDialog(item.name, 'Spend which slot?', {label: 'DND5E.SpellSlots', name: 'slot', options: {options}});
 */
function getSpellSlotOptions(actor) {
    return Object.entries(actor.system.spells ?? {})
        .filter(([, slot]) => slot.value > 0 && slot.max > 0 && slot.level > 0)
        .sort(([, a], [, b]) => a.level - b.level)
        .map(([key, slot]) => ({
            value: key,
            level: slot.level,
            image: 'systems/dnd5e/icons/spell-tiers/spell' + slot.level + '.webp',
            label: `${slot.label}${key === 'pact' ? ' (' + slot.level + ')' : ''} - ${slot.value}/${slot.max}`
        }));
}
/**
 * Prompt the current user for one of an actor's languages in a dropdown. An actor with one language returns it without
 * a prompt.
 * @param {foundry.documents.Actor} actor  Actor whose languages are offered.
 * @param {string} title                   Window title.
 * @param {string} content                 Text shown above the input.
 * @returns {Promise<string|undefined>}    The chosen language key. Undefined if the actor knows none, or the dialog is
 *                                         cancelled or closed.
 * @example
 * const language = await dialogUtils.selectLanguage(actor, item.name, 'Choose a language');
 */
async function selectLanguage(actor, title, content) {
    const languages = Array.from(actor.system.traits.languages.value);
    if (languages.length <= 1) return languages[0];
    const options = languages.map(value => ({value, label: dnd5e.documents.Trait.keyLabel(value, {trait: 'languages'})}));
    return await selectDialog(title, content, {label: 'DND5E.Languages', name: 'language', options: {options}});
}
/**
 * Prompt for spell slots to spend or recover, with an amount per slot level. Only shows the prompt when a slot
 * qualifies. Does not change the actor's slots.
 * @param {foundry.documents.Actor} actor                     Actor the slots belong to.
 * @param {string} title                                      Window title.
 * @param {string} content                                    Text shown above the inputs.
 * @param {object} [options]                                  Additional options.
 * @param {boolean} [options.recover]                         Offer spent slots to recover instead of available slots to
 *                                                            spend.
 * @param {number} [options.maxAmount]                        Most that may be chosen, counted as set by
 *                                                            `maxAmountMode`.
 * @param {'count'|'level'} [options.maxAmountMode]           `'count'` limits the number of slots. `'level'`, the
 *                                                            default, limits the combined slot levels and hides slots
 *                                                            above `maxAmount`.
 * @param {number} [options.maxLevel]                         Highest slot level offered. Defaults to 9.
 * @param {number} [options.minLevel]                         Lowest slot level offered. Defaults to 0.
 * @param {string} [options.userId]                           User the dialog is shown to. Defaults to the current user.
 * @returns {Promise<{key: string, amount: number}[]|false>}  Slot keys, such as `spell2` or `pact`, with the amount
 *                                                            chosen. False if no slot qualifies, nothing is chosen, or
 *                                                            the dialog is cancelled or closed.
 * @example
 * // Arcane Recovery at wizard level 6
 * const slots = await dialogUtils.selectSpellSlots(actor, item.name, 'Recover which slots?', {recover: true, maxAmount: 3, maxLevel: 5});
 */
async function selectSpellSlots(actor, title, content, {maxAmount, maxAmountMode = 'level', maxLevel = 9, minLevel = 0, userId = game.user.id, recover = false} = {}) {
    const maxes = {};
    const weights = {};
    const entries = Object.entries(actor.system.spells).filter(([k, v]) => {
        if (maxAmount && maxAmountMode === 'level' && v.level > maxAmount) return false;
        if (v.level > maxLevel || v.level < minLevel) return false;
        if (recover) return v.max > 0 && v.value < v.max;
        else return v.value > 0 && v.max > 0;
    }).map(([k, v]) => {
        maxes[k] = recover ? v.max - v.value : v.value;
        weights[k] = maxAmountMode === 'level' ? v.level : 1;
        return {
            name: v.label + (k === 'pact' ? ` (${v.level})` : ''),
            id: k,
            img: `systems/dnd5e/icons/spell-tiers/spell${v.level}.webp`
        };
    });
    if (!entries.length) return false;
    const result = await selectDocumentDialog(title, content, entries, {max: maxAmount, maxes, weights, userId});
    if (!result) return false;
    if (maxAmount === 1) return [{key: result.id, amount: 1}];
    const slots = result.filter(r => r.amount > 0).map(r => ({key: r.key, amount: r.amount}));
    return slots.length ? slots : false;
}
/**
 * Prompt for one damage type with a button per type and the system's icons. More than four types are grouped under
 * headings. With `remember` and `rememberKey`, a Remember checkbox stores the choice on this client, and later calls
 * with the same key and types return it without a prompt until {@link clearRemembered} runs.
 * @param {string[]} damageTypes                Damage type keys to choose between.
 * @param {string} title                        Window title.
 * @param {string} content                      Text shown above the buttons.
 * @param {object} [options]                    Additional options.
 * @param {boolean} [options.addNo]             Append a No button that returns false.
 * @param {string} [options.userId]             User the dialog is shown to. Defaults to the current user.
 * @param {'alphabetical'|null} [options.sort]  Sort the buttons by label. Unsorted by default.
 * @param {'combat'|'cast'} [options.remember]  Offer to reuse the choice for the rest of this combat or cast.
 * @param {object} [options.rememberKey]        Key the remembered choice is stored under.
 * @param {string} options.rememberKey.scopeId  Combat or workflow id.
 * @param {string} options.rememberKey.uuid     Uuid of the document asking.
 * @returns {Promise<string|false>}             The chosen damage type. False if `damageTypes` is empty, No is chosen,
 *                                              or the dialog is closed.
 * @example
 * const damageType = await dialogUtils.selectDamageType(['acid', 'cold', 'fire', 'lightning', 'thunder'], item.name, 'Choose a damage type');
 * if (!damageType) return;
 */
async function selectDamageType(damageTypes, title, content, {addNo = false, userId = game.user.id, sort = null, remember, rememberKey} = {}) {
    if (!damageTypes?.length) return false;
    const key = remember && rememberKey?.scopeId ? [remember, rememberKey.scopeId, rememberKey.uuid, [...damageTypes].sort().join(',')].join('|') : undefined;
    if (key && rememberedChoices.has(key)) return rememberedChoices.get(key);
    const damageTypeOptions = constants.damageTypeOptions;
    const buttons = damageTypes.map(t => {
        const config = damageTypeOptions.find(o => o.value === t);
        return {label: config?.label ?? t, name: t, group: config?.group ?? constants.getDamageTypeGroup(t), options: {image: config?.image, invertColor: config?.invertColor}};
    });
    if (sort === 'alphabetical') buttons.sort((a, b) => String(a.label).localeCompare(String(b.label), 'en', {sensitivity: 'base'}));
    const groups = damageTypes.length > 4 ? Object.keys(constants.damageTypeGroups) : [undefined];
    const inputs = groups.map(group => ['button', buttons.filter(button => !group || button.group === group), {displayAsRows: true, legend: group && constants.damageTypeGroups[group]}]).filter(([, fields]) => fields.length);
    if (addNo) inputs.push(['button', [{label: 'COMMON.No', name: false, options: {image: constants.damageIcons.no}}], {displayAsRows: true}]);
    if (key) inputs.push(['checkbox', [{label: _loc('CAT.Dialog.Remember.' + remember.capitalize()), name: 'remember'}]]);
    const result = await runDialog(userId, title, content, inputs, undefined, {width: 400});
    const choice = result?.buttons ?? false;
    if (key && result?.remember && choice) rememberedChoices.set(key, choice);
    return choice;
}
/**
 * Forget choices remembered by {@link selectDamageType} on this client.
 * @param {string} [scopeId]  Combat or workflow id. Clears every choice when omitted.
 * @example
 * dialogUtils.clearRemembered(combat.id);
 */
function clearRemembered(scopeId) {
    if (!scopeId) return rememberedChoices.clear();
    for (const key of rememberedChoices.keys()) if (key.split('|')[1] === scopeId) rememberedChoices.delete(key);
}
/**
 * Prompt for hit dice across an actor's classes, and optionally other items with uses, sorted by class name. Checkboxes
 * are shown when `max` is one, and an amount per class otherwise. Does not spend or recover the dice.
 * @param {foundry.documents.Actor} actor            Actor the hit dice belong to.
 * @param {string} title                             Window title.
 * @param {string} content                           Text shown above the inputs.
 * @param {object} [options]                         Additional options.
 * @param {number} [options.max]                     Total dice selectable. Defaults to 1.
 * @param {string} [options.userId]                  User the dialog is shown to. Defaults to the current user.
 * @param {Array<Item5e>} [options.additionalItems]  Items with remaining uses, offered after the classes. Each needs a
 *                                                   `diceSize` automation config value for its label.
 * @param {boolean} [options.recover]                Offer spent dice to recover instead of remaining dice to spend.
 * @returns {Promise<Array<{document: Item5e, amount: number}>|false>}
 *                                                   One entry per offered class or item. False when nothing is
 *                                                   available or the dialog is cancelled or closed.
 * @example
 * const choices = await dialogUtils.selectHitDie(actor, item.name, 'Spend hit dice', {max: 2});
 * if (!choices) return;
 */
async function selectHitDie(actor, title, content, {max = 1, userId = game.user.id, additionalItems = [], recover = false} = {}) {
    let documents = actor.items.filter(i => {
        if (i.type !== 'class') return false;
        return recover ? i.system.hd.spent > 0 : (i.system.levels - i.system.hd.spent) > 0;
    });
    let validAdditionalItems = additionalItems.filter(i => i && i.system?.uses?.value > 0);
    if (!documents.length && !validAdditionalItems.length) return false;
    documents = documents.sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}));
    let inputFields = documents.map(i => ({
        label: _loc('CAT.Dialog.HitDieLabel', {
            className: i.name,
            remaining: recover ? i.system.hd.spent : (i.system.levels - i.system.hd.spent),
            max: i.system.levels,
            denomination: i.system.hd.denomination
        }),
        name: i.id,
        options: {
            image: i.img,
            minAmount: 0,
            maxAmount: Math.min(recover ? i.system.hd.spent : (i.system.levels - i.system.hd.spent), max)
        }
    }));
    if (validAdditionalItems.length) {
        let additionalInputFields = validAdditionalItems.map(i => ({
            label: _loc('CAT.Dialog.HitDieLabel', {
                className: i.name,
                remaining: i.system.uses.value,
                max: i.system.uses.max,
                denomination: automationUtils.getConfigValue(i, 'diceSize')
            }),
            name: i.id,
            options: {
                image: i.img,
                minAmount: 0,
                maxAmount: Math.min(i.system.uses.max, i.system.uses.value, max)
            }
        }));
        inputFields.push(...additionalInputFields);
        documents.push(...validAdditionalItems);
    }
    let inputs = [[max === 1 ? 'checkbox' : 'selectAmount', inputFields, {displayAsRows: true, totalMax: max}]];
    let result = await runDialog(userId, title, content, inputs, 'okCancel', {height: 'auto'});
    if (!result?.buttons) return false;
    delete result.buttons;
    return Object.entries(result).map(([key, value]) => ({
        document: documents.find(d => d.id === key),
        amount: Number(value)
    }));
}
/**
 * Ask a yes or no question. Content longer than 100 characters widens the window.
 * @param {string} title                    Window title.
 * @param {string} content                  Question text.
 * @param {object} [options]                Additional options.
 * @param {string} [options.userId]         User the dialog is shown to. Defaults to the current user.
 * @param {string|Array} [options.buttons]  Button set. Defaults to `'yesNo'`.
 * @param {boolean} [options.timer]         Run the prompt timer. Defaults to true.
 * @param {AbortSignal} [options.signal]    Closes the dialog when aborted. A `deadline` timestamp on it also limits
 *                                          the prompt timer.
 * @returns {Promise<boolean|null>}         True for Yes, false for No. Null if the dialog is closed or the timer runs
 *                                          out.
 * @example
 * const useSmite = await dialogUtils.confirm(item.name, 'Use Divine Smite?');
 * if (!useSmite) return;
 */
async function confirm(title, content, {userId = game.user.id, buttons = 'yesNo', timer = true, signal} = {}) {
    const config = {width: content?.length > 100 ? 600 : undefined, timer, signal};
    let selection = await runDialog(userId, title, content, [], buttons, config);
    return selection?.buttons;
}
/**
 * {@link confirm} asking whether to use a document, titled Confirm.
 * @param {foundry.abstract.Document} document  Document being used, named in the question.
 * @param {object} [options]                    Additional options.
 * @param {string} [options.userId]             User the dialog is shown to. Defaults to the current user.
 * @param {string|Array} [options.buttons]      Button set. Defaults to `'yesNo'`.
 * @returns {Promise<boolean|null>}             True for Yes, false for No. Null if the dialog is closed or the timer
 *                                              runs out.
 * @example
 * if (!await dialogUtils.confirmUseItem(item, {userId: queryUtils.firstOwner(actor, true)})) return;
 */
async function confirmUseItem(document, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    let content = _loc('CAT.Dialog.Use', {document: document.name});
    return await confirm('COMMON.Confirm', content, {userId, buttons});
}
/**
 * {@link confirm} asking whether to use a document by spending an amount of a resource, titled Confirm.
 * @param {foundry.abstract.Document} document  Document being used, named in the question.
 * @param {number} quantity                     How much of the resource would be spent.
 * @param {string} resource                     Resource name shown in the question.
 * @param {object} [options]                    Additional options.
 * @param {string} [options.userId]             User the dialog is shown to. Defaults to the current user.
 * @param {string|Array} [options.buttons]      Button set. Defaults to `'yesNo'`.
 * @returns {Promise<boolean|null>}             True for Yes, false for No. Null if the dialog is closed or the timer
 *                                              runs out.
 * @example
 * if (!await dialogUtils.confirmUseExtraCost(item, 2, 'Sorcery Points')) return;
 */
async function confirmUseExtraCost(document, quantity, resource, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    let content = _loc('CAT.Dialog.UseExtraCost', {document: document.name, quantity, resource});
    return await confirm('COMMON.Confirm', content, {userId, buttons});
}
/**
 * {@link confirm} asking whether to use a document, with a roll total shown in the question, titled Confirm.
 * @param {foundry.abstract.Document} document  Document being used, named in the question.
 * @param {number} rollTotal                    Roll total shown in the question.
 * @param {object} [options]                    Additional options.
 * @param {string} [options.userId]             User the dialog is shown to. Defaults to the current user.
 * @param {string|Array} [options.buttons]      Button set. Defaults to `'yesNo'`.
 * @returns {Promise<boolean|null>}             True for Yes, false for No. Null if the dialog is closed or the timer
 *                                              runs out.
 * @example
 * if (!await dialogUtils.confirmUseRollTotal(item, workflow.attackTotal)) return;
 */
async function confirmUseRollTotal(document, rollTotal, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    const content = _loc('CAT.Dialog.UseRollTotal', {document: document.name, rollTotal});
    return await confirm('COMMON.Confirm', content, {userId, buttons});
}
/**
 * {@link confirm} asking whether to use a document on a named roll, with that roll's total shown in the question,
 * titled Confirm.
 * @param {foundry.abstract.Document} document  Document being used, named in the question.
 * @param {string} name                         What the roll belongs to, such as a token or actor name.
 * @param {number} rollTotal                    Roll total shown in the question.
 * @param {object} [options]                    Additional options.
 * @param {string} [options.userId]             User the dialog is shown to. Defaults to the current user.
 * @param {string|Array} [options.buttons]      Button set. Defaults to `'yesNo'`.
 * @returns {Promise<boolean|null>}             True for Yes, false for No. Null if the dialog is closed or the timer
 *                                              runs out.
 * @example
 * if (!await dialogUtils.confirmUseForRollTotal(item, token.name, roll.total)) return;
 */
async function confirmUseForRollTotal(document, name, rollTotal, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    const content = _loc('CAT.Dialog.UseForRollTotal', {document: document.name, name, rollTotal});
    return await confirm('COMMON.Confirm', content, {userId, buttons});
}
/**
 * {@link confirm} asking whether to use a document to recover another document's uses, titled Confirm. The question
 * shows the spent and maximum uses of `documentWithUses`. Does not recover the uses.
 * @param {foundry.abstract.Document} document          Document being used, named in the question.
 * @param {foundry.abstract.Document} documentWithUses  Item or activity whose uses would be recovered.
 * @param {object} [options]                            Additional options.
 * @param {number} [options.spent]                      Override the spent count shown.
 * @param {string} [options.userId]                     User the dialog is shown to. Defaults to the current user.
 * @param {string|Array} [options.buttons]              Button set. Defaults to `'yesNo'`.
 * @returns {Promise<boolean|null>}                     True for Yes, false for No. Null if the dialog is closed or the
 *                                                      timer runs out.
 * @example
 * if (!await dialogUtils.confirmRecoverUses(item, channelDivinity)) return;
 */
async function confirmRecoverUses(document, documentWithUses, {spent, userId = game.user.id, buttons = 'yesNo'} = {}) {
    const uses = (documentWithUses.system ?? documentWithUses).uses;
    return await confirm('COMMON.Confirm', _loc('CAT.Dialog.UseRecover', {document: document.name, spent: spent ?? uses?.spent ?? 0, max: uses?.max ?? 0, resource: documentWithUses.name}), {userId, buttons});
}
/**
 * {@link confirm} with Yes and No buttons, queued with {@link runQueuedDialog}. The dialog waits until that user's
 * earlier queued dialogs are answered.
 * @param {string} title             Window title.
 * @param {string} content           Question text.
 * @param {object} [options]         Additional options.
 * @param {string} [options.userId]  User the dialog is shown to. Defaults to the current user.
 * @returns {Promise<boolean|null>}  True for Yes, false for No. Null if the dialog is closed or the timer runs out.
 * @example
 * const accept = await dialogUtils.queuedConfirmDialog(item.name, 'Accept the Bless?', {userId: queryUtils.firstOwner(target.actor, true)});
 */
async function queuedConfirmDialog(title, content, {userId = game.user.id} = {}) {
    let selection = await runQueuedDialog(userId, title, content, [], 'yesNo');
    return selection?.buttons;
}
const targetInputTypes = {
    one: 'radio',
    multiple: 'checkbox',
    number: 'number',
    select: 'selectOption',
    selectAmount: 'selectAmount'
};
/**
 * Prompt for one or more tokens, optionally assigning a value to each. Labels follow {@link getTokenName}, so names can
 * be hidden. With `type` `'one'` the first token starts selected.
 * @param {string} title                               Window title.
 * @param {string} content                             Text shown above the inputs.
 * @param {foundry.documents.TokenDocument[]} targets  Tokens to choose between.
 * @param {object} [options]                           Additional options.
 * @param {'one'|'multiple'|'number'|'select'|'selectAmount'} [options.type]
 *                                                     Radio buttons, checkboxes, a number per target, a dropdown per
 *                                                     target, or an amount per target sharing `maxAmount`. Defaults to
 *                                                     `'one'`.
 * @param {object[]} [options.selectOptions]           Dropdown entries for `type` `'select'`.
 * @param {boolean} [options.skipDeadAndUnconscious]   Add a Skip Dead and Unconscious checkbox, checked by default and
 *                                                     returned as `skip`. Defaults to true.
 * @param {foundry.documents.TokenDocument} [options.coverToken]
 *                                                     Show each target's cover from this token.
 * @param {boolean} [options.reverseCover]             Measure cover from each target to `coverToken` instead.
 * @param {boolean} [options.displayDistance]          Append the distance from `coverToken` to each label. Defaults to
 *                                                     true, and needs `coverToken`.
 * @param {number} [options.maxAmount]                 Most that may be assigned to one target and across all targets.
 *                                                     Defaults to 1.
 * @param {number} [options.minAmount]                 Least that may be assigned to one target. Defaults to 0.
 * @param {boolean} [options.requireTotal]             Disable Confirm until `maxAmount` is fully assigned.
 * @param {string} [options.userId]                    User the dialog is shown to. Defaults to the current user.
 * @param {string} [options.buttons]                   Button set. Defaults to `'okCancel'`.
 * @param {object} [options.maxes]                     Per-target override of `maxAmount`, keyed by token id.
 * @param {object} [options.tags]                      Per-target label tags, keyed by token id.
 * @param {object} [options.preselected]               Per-target starting checked state, keyed by token id.
 * @returns {Promise<{result: foundry.documents.TokenDocument|foundry.documents.TokenDocument[]|{document: foundry.documents.TokenDocument, value: *}[], skip: boolean}|null>}
 *                                                     `result` is a token for `'one'`, an array of tokens for
 *                                                     `'multiple'`, and `{document, value}` entries for the other
 *                                                     types, leaving out targets with no value. Null if cancelled or
 *                                                     closed.
 * @example
 * const selection = await dialogUtils.selectTargetDialog(item.name, 'Choose a target', targets, {coverToken: token});
 * const target = selection?.result;
 * if (!target) return;
 */
async function selectTargetDialog(title, content, targets, {type = 'one', selectOptions = [], skipDeadAndUnconscious = true, coverToken = undefined, reverseCover = false, displayDistance = true, maxAmount = 1, minAmount = 0, requireTotal = false, userId = game.user.id, buttons = 'okCancel', maxes = {}, tags = {}, preselected = {}} = {}) {
    const inputType = targetInputTypes[type] ?? targetInputTypes.one;
    const inputs = [[inputType]];
    const targetInputs = [];
    const hideNames = game.settings.get('cat', 'hideNames');
    const counter = {value: 1};
    for (const i of targets) {
        let label = getTokenName(i, {hide: hideNames, counter});
        if (coverToken && !reverseCover) label += ' [' + tokenUtils.checkCover(coverToken, i, {displayName: true}) + ']';
        else if (coverToken) label += ' [' + tokenUtils.checkCover(i, coverToken, {displayName: true}) + ']';
        const distance = displayDistance && coverToken ? tokenUtils.getDistance(coverToken, i) : NaN;
        if (Number.isFinite(distance)) label += ' [' + distanceUtils.formatDistance(coverToken.parent, distance) + ']';
        targetInputs.push({
            label,
            name: i.id,
            options: {
                isChecked: preselected[i.id] ?? (type !== 'multiple' && targetInputs.length === 0),
                maxAmount: maxes[i.id] ?? maxAmount,
                options: selectOptions,
                image: i.texture.src,
                tags: tags[i.id],
                minAmount
            }
        });
    }
    inputs[0].push(targetInputs);
    inputs[0].push({displayAsRows: true, radioName: 'targets', totalMax: maxAmount, requireTotal});
    if (skipDeadAndUnconscious) inputs.push(['checkbox', [{label: _loc('CAT.Dialog.SkipDeadAndUnconscious'), name: 'skip', options: {isChecked: true}}]]);
    const selection = await runDialog(userId, title, content, inputs, buttons, {width: 500});
    if (!selection || selection.buttons === false) return null;
    const skip = selection.skip ?? skipDeadAndUnconscious;
    let result = type === 'one' ? undefined : [];
    if (type === 'one') {
        result = targets.find(target => target.id === selection.targets);
    } else {
        for (const [key, value] of Object.entries(selection)) {
            if (key === 'buttons' || key === 'skip' || value === false || value === 0 || value === '0' || value == null) continue;
            const doc = targets.find(target => target.id === key);
            if (!doc) continue;
            result.push(type === 'multiple' ? doc : {document: doc, value});
        }
    }
    return {result, skip};
}
/**
 * Prompt for individual dice results across evaluated rolls, skipping deterministic terms and discarded dice. Dice
 * inside function and parenthetical terms are offered too.
 * @param {foundry.dice.Roll[]} [rolls]     Rolls whose dice may be chosen.
 * @param {string} title                    Window title.
 * @param {string} content                  Text shown above the dice.
 * @param {object} [options]                Additional options.
 * @param {number} [options.max]            Total dice selectable. Defaults to 1.
 * @param {string} [options.userId]         User the dialog is shown to. Defaults to the current user.
 * @param {string|Array} [options.buttons]  Button set. Defaults to `'okCancel'`.
 * @param {string[]} [options.damageTypes]  Only offer dice from rolls of these damage types.
 * @returns {Promise<string[]|false>}       Property paths into `rolls`, shaped `{index}.terms.{index}.results.{index}`,
 *                                          nesting deeper for dice inside other terms. False if no dice can be offered,
 *                                          or the dialog is cancelled or closed.
 * @example
 * const choices = await dialogUtils.selectDie(workflow.damageRolls, item.name, 'Reroll which die?');
 * if (!choices) return;
 * const results = choices.map(path => genericUtils.getProperty(workflow.damageRolls, path));
 */
async function selectDie(rolls = [], title, content, {max = 1, userId = game.user.id, buttons = 'okCancel', damageTypes} = {}) {
    const dice = [];
    const collectDice = (r, name = '', singleRoll = false) => {
        for (let i = 0; i < r.length; i++) {
            const roll = r[i];
            if (damageTypes?.length && !damageTypes.includes(roll.options?.type)) continue;
            const rollKey = `${name}${singleRoll ? '' : i + '-'}`;
            for (let j = 0; j < roll.terms.length; j++) {
                const term = roll.terms[j];
                if (term.isDeterministic) continue;
                if (term.rolls) { // function terms
                    dice.push(...(collectDice(term.rolls, `${name}${i}-terms-${j}-rolls-`) ?? []));
                    continue;
                }
                if (term.roll instanceof Roll) { // parenthetical terms
                    dice.push(...(collectDice([term.roll], `${name}${i}-terms-${j}-roll-`, true) ?? []));
                    continue;
                }
                const flavor = term.flavor || roll.options?.type || '';
                const cfg = CONFIG.DND5E.damageTypes[flavor];
                for (let k = 0; k < term.results.length; k++) {
                    if (!term.results[k].active) continue;
                    dice.push({
                        name: `${rollKey}terms-${j}-results-${k}`,
                        faces: term.faces,
                        result: term.results[k].result,
                        typeLabel: cfg?.label ?? flavor,
                        typeIcon: cfg?.icon
                    });
                }
            }
        }
    };
    collectDice(rolls);
    if (!dice.length) return false;
    const inputs = [['dice', dice, {totalMax: max}]];
    const result = await runDialog(userId, title, content, inputs, buttons, {height: 'auto'});
    if (!result?.buttons) return false;
    delete result.buttons;
    return Object.entries(result).filter(([, v]) => v).map(([k]) => k.replaceAll('-', '.'));
}
export default {
    abilityDialog,
    buttonDialog,
    distanceDialog,
    numberDialog,
    selectDialog,
    selectDocumentDialog,
    buildBonusInputs,
    selectSpellSlots,
    getSpellSlotOptions,
    getTokenName,
    selectLanguage,
    selectDamageType,
    clearRemembered,
    selectHitDie,
    confirm,
    confirmUseItem,
    confirmUseExtraCost,
    confirmUseRollTotal,
    confirmUseForRollTotal,
    confirmRecoverUses,
    queuedConfirmDialog,
    selectTargetDialog,
    selectDie,
    runDialog,
    runQueuedDialog
};
