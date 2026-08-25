import DialogApp, {dialogQueue} from '../applications/dialog.mjs';
import {queryUtils, tokenUtils, automationUtils, uiUtils} from './_module.mjs';
import constants from '../lib/constants.mjs';
import {D20Bonus, DamageBonus} from '../lib/_module.mjs';

/**
 * @param {foundry.documents.TokenDocument} token 
 * @param {object} [options]
 * @param {boolean} [options.hide]
 * @param {object} [options.counter]
 * @param {number} [options.counter.value]
 * @returns 
 */
function getTokenName(token, {hide, counter} = {}) {
    if (!hide || token.disposition > 0) return token.name;
    const name = _loc('CAT.Dialog.UnknownTarget');
    return Number.isNumeric(counter?.value) ? name + '(' + counter.value++ + ')' : name;
}

async function runDialog(userId, title, content, inputs, buttons, config) {
    if (userId === game.user.id) return await DialogApp.dialog(title, content, inputs, buttons, config);
    return await queryUtils.query('dialog', game.users.get(userId), {title, content, inputs, buttons, config}, 300000);
}
async function runQueuedDialog(userId, title, content, inputs, buttons, config) {
    if (userId === game.user.id) {
        return await dialogQueue.showDialog(async (...args) => await DialogApp.dialog(...args), title, content, inputs, buttons, config);
    }
    return await queryUtils.query('queuedDialog', game.users.get(userId), {title, content, inputs, buttons, config}, 300000);
}
async function buttonDialog(title, content, buttons, {displayAsRows = true, userId = game.user.id, sort = null} = {}) {
    let inputs = [
        ['button', [], {displayAsRows: displayAsRows}]
    ];
    if (sort === 'alphabetical') buttons = [...buttons].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en', {sensitivity: 'base'}));
    for (let [label, value, options] of buttons) {
        inputs[0][1].push({label: label, name: value, options: options ?? {}});
    }
    let result = await runDialog(userId, title, content, inputs, undefined, {width: 400});
    return result?.buttons ?? false;
}
async function numberDialog(title, content, input = {label: 'Label', name: 'identifier', options: {}}, {buttons = 'okCancel', userId = game.user.id} = {}) {
    let inputs = [
        ['number',
            [{
                label: input.label,
                name: input.name,
                options: input.options
            }]
        ]
    ];
    let result = await runDialog(userId, title, content, inputs, buttons);
    return result?.[input.name];
}
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
                label: input.label,
                name: input.name,
                options: input.options
            }]
        ]
    ];
    let result = await runDialog(userId, title, content, inputs, buttons);
    return result?.[input.name];
}
async function selectDocumentDialog(title, content, documents, {max = 1, displayTooltips = false, sort = null, userId = game.user.id, addNoneDocument = false, showCR = false, showSpellLevel = false, showUses = false, displayReference = false, combobox = false, checkbox = false, weights = {}, maxes = {}, validate = null, tags = {}, selects = {}, locked = new Set(), keys = null, labels = {}} = {}) {
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
        if (n === 0) return _loc('DND5E.SpellCantrip') || 'Cantrip';
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
        let inputFields = documents.map(d => ({
            label: buildLabel(d),
            name: docKey(d),
            options: {
                image: d.img,
                tooltip: displayTooltips ? d.system?.description?.value?.replace(/<[^>]*>?|@UUID\[.*?\]{(.*?)}/gm, '$1') : undefined,
                reference: (displayReference && d.reference) ? d.reference : undefined
            }
        }));
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
    let inputFields = documents.map((d, i) => {
        let id = idOf(i);
        let {label, tag} = buildEntry(d, id);
        let isLocked = locked.has(id);
        return {
            label: checkbox ? label : buildLabel(d),
            name: id,
            options: {
                image: d.img,
                tooltip: displayTooltips ? d.system?.description?.value?.replace(/<[^>]*>?|@UUID\[.*?\]{(.*?)}/gm, '$1') : undefined,
                hint: checkbox ? tag : undefined,
                select: checkbox ? selects?.[id] : undefined,
                locked: isLocked,
                isChecked: isLocked,
                minAmount: 0,
                maxAmount: maxes?.[id] ?? max,
                weight: weights?.[id] ?? 1
            }
        };
    });
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
 * 
 * @param {DamageBonus[]|D20Bonus[]} bonuses 
 * @param {object} [options]
 * @param {foundry.dice.Roll[]} [options.rolls] The roll(s) to which selected bonuses will be added.
 * @param {foundry.documents.TokenDocument[]|Set<foundry.documents.TokenDocument>} [options.targets]
 * @param {MidiQOL.Workflow} [options.workflow]
 * @param {string} [options.title]
 * @param {string} [options.content]
 */
async function selectScaledDocument(bonuses, {rolls, targets, workflow, title = 'CAT.OptionalBonus.Title', content = 'CAT.OptionalBonus.Content'} = {}) {
    if (!bonuses.length) return false;
    bonuses = bonuses.sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}));
    let rollTotal;
    if (rolls?.length) {
        rollTotal = rolls.reduce((t, r) => t += r.total, 0);
        rolls = rolls.map(r => r._evaluated ? r.clone() : r);
    }
    const cls = bonuses[0].constructor;
    const validateAll = context => {
        cls.ValidateAll(bonuses, {rollTotal, workflow});
        for (const bonusContext of context) {
            const index = bonusContext.name.match(/\d+/)[0];
            const bonus = bonuses[index];
            bonusContext.isChecked = bonus.active;
            bonusContext.hints = bonus.validateHints;
        }
    };
    const tagLabel = key => CONFIG.DND5E.activityActivationTypes[key]?.label ?? CONFIG.DND5E.activityConsumptionTypes[key]?.label ?? key;
    const sliderChange = ({bonus, thisContext, input, getInputById}) => {
        bonus.updateScaling(input.value, workflow, bonuses, rollTotal);
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
                t.label = bonus.roll.formula;
                continue;
            }
            const hint = bonus.scalingHints.find(h => h.id === t.id);
            if (!hint) continue;
            t.tooltip = hint.tooltip;
            t.icon = hint.icon;
        }
        return true;
    };
    const targetsChange = ({bonus, input}) => {
        const selected = new Set(input.options.filter(o => o.selected).map(o => o.value));
        if (selected.size === bonus.targets.size) return;
        bonus.targets = targets.filter(t => selected.has(t.id));
    };
    const damageChange = ({bonus, fullContext, input, getInputById}) => {
        bonus.damageType = input.value;
        if (bonus.active) updateFormula(fullContext);
        const tag = getInputById(input.id.split(DialogApp.SUBINPUT_SEPARATOR)[0])?.tags?.find(t => t.id === 'formula');
        if (!tag) return bonus.active;
        const type = CONFIG.DND5E.damageTypes[bonus.damageType] ?? CONFIG.DND5E.healingTypes[bonus.damageType];
        tag.image = type.icon;
        tag.tooltip = type.label;
        return true;
    };
    let currentAggregate = cls.CombineRolls(rolls, bonuses, {workflow});
    const updateFormula = ctx => {
        const formula = ctx.subheaders.find(i => i.isFormula);
        if (!formula) return;
        currentAggregate = cls.CombineRolls(rolls, bonuses, {workflow});
        const newCtx = formula.parseNewFormula(currentAggregate);
        formula.groups = newCtx.groups;
    };
    const hide = game.settings.get('cat', 'hideNames');
    const optional = [], contextual = [], thirdParty = [];
    for (let i = 0; i < bonuses.length; i++) {
        const bonus = bonuses[i];
        const name = 'b-' + i;
        const subinputs = [];
        if (bonus.maxScaling > 0)
            subinputs.push(['slider', [{
                name: name + '.scaling',
                hints: bonus.scalingHints,
                label: 'CAT.OptionalBonus.Scaling',
                options: {
                    min: 0,
                    max: bonus.maxScaling,
                    step: 1,
                    onchange: ({thisContext, input, getInputById}) => sliderChange({bonus, thisContext, input, getInputById})
                }
            }]]);
        const counter = {value: 1};
        if (targets && bonus.maxTargets > 0)
            subinputs.push(['comboboxMulti', [{
                name: name + '.targets',
                hints: bonus.maxTargetsHints,
                label: 'CAT.OptionalBonus.Targets',
                options: {
                    maxTotal: bonus.maxTargets,
                    options: targets.map(t => ({
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
                    options: constants.damageTypeOptions().filter(o => bonus.damageTypes.has(o.value)),
                    onchange: ({fullContext, input, getInputById}) => damageChange({bonus, fullContext, input, getInputById})
                }
            }]]);
        const tags = [];
        if (bonus.roll) {
            const type = CONFIG.DND5E.damageTypes[bonus.damageType] ?? CONFIG.DND5E.healingTypes[bonus.damageType];
            tags.push({label: bonus.roll.formula, id: 'formula', image: type?.icon, tooltip: type?.label});
            if (bonus.damageTypes?.size > 1) tags.push({label: 'CAT.OptionalBonus.DamageTypeChoice', id: 'damageType'});
        }   
        if (bonus.scalingHints?.length) tags.push(...bonus.scalingHints.map(h => ({...h, label: tagLabel(h.id)})));
        if (bonus.maxScaling > 0) tags.push({label: 'CAT.OptionalBonus.Scaleable', id: 'scaling'});
        if (bonus.maxTargets > 0) tags.push({label: 'CAT.OptionalBonus.Targeted', id: 'targets'});
        const fieldset = bonus.optional ? bonus.isThirdParty ? thirdParty : optional : contextual;
        fieldset.push({
            label: bonus.name,
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
                    if (rolls?.length) updateFormula(fullContext);
                    return true;
                }
            }
        });
    }
    if (!optional.length && !thirdParty.length) return [];
    const inputs = [];
    if (rolls?.length) inputs.push(['formula', currentAggregate, {header: true}]);
    if (thirdParty.length) inputs.push(['request', thirdParty, {displayAsRows: true, legend: contextual.length + optional.length > 0 ? 'CAT.OptionalBonus.ThirdParty' : ''}]);
    if (optional.length) inputs.push(['checkbox', optional, {displayAsRows: true, legend: contextual.length + thirdParty.length > 0 ? 'CAT.OptionalBonus.Optional' : ''}]);
    if (contextual.length) inputs.push(['checkbox', contextual, {displayAsRows: true, legend: 'CAT.OptionalBonus.Contextual'}]);
    const choices = await runDialog(game.user.id, title, content, inputs, 'okCancel', {height: 'auto'});
    if (!choices?.buttons) return false;
    return cls.ValidateAll(bonuses, {workflow});
}
/**
 * @param {foundry.documents.Actor} actor 
 * @param {string} title 
 * @param {string} content 
 * @param {object} [options]
 * @param {boolean} [options.recover] If true, select missing slots. If false, select available slots.
 * @param {number} [options.maxAmount]
 * @param {'count'|'level'} [options.maxAmountMode] 'count' mode selects a number of spell slots. 'level' mode selects a combined total of slot levels. 
 * @returns {Promise<{key: string, amount: number}[]>}
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
async function selectDamageType(damageTypes, title, content, {addNo = false, userId = game.user.id, sort = null} = {}) {
    if (!damageTypes?.length) return false;
    let buttons = damageTypes.map(t => {
        const config = constants.damageTypeOptions().find(o => o.value === t);
        return [config?.label ?? t, t, {image: config?.image, invertColor: config?.invertColor}];
    });
    if (sort === 'alphabetical') buttons.sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en', {sensitivity: 'base'}));
    if (addNo) buttons.push(['No', false, {image: constants.damageIcons.no}]);
    return await buttonDialog(title, content, buttons, {userId});
}
async function selectHitDie(actor, title, content, {max = 1, userId = game.user.id, additionalItems = []} = {}) {
    let documents = actor.items.filter(i => i.type === 'class' && (i.system.levels - i.system.hd.spent) > 0);
    let validAdditionalItems = additionalItems.filter(i => i && i.system?.uses?.value > 0);
    if (!documents.length && !validAdditionalItems.length) return false;
    documents = documents.sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}));
    let inputFields = documents.map(i => ({
        label: _loc('CAT.Dialog.HitDieLabel', {
            className: i.name,
            remaining: i.system.levels - i.system.hd.spent,
            max: i.system.levels,
            denomination: i.system.hd.denomination
        }),
        name: i.id,
        options: {
            image: i.img,
            minAmount: 0,
            maxAmount: Math.min(i.system.levels - i.system.hd.spent, max)
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
async function confirm(title, content, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    let selection = await runDialog(userId, title, content, [], buttons);
    return selection?.buttons;
}
async function confirmUseItem(document, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    let content = _loc('CAT.Dialog.Use', {document: document.name});
    return await confirm('COMMON.Confirm', content, {userId, buttons});
}
async function confirmUseExtraCost(document, quantity, resource, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    let content = _loc('CAT.Dialog.UseExtraCost', {document: document.name, quantity, resource});
    return await confirm('COMMON.Confirm', content, {userId, buttons});
}
async function confirmUseRollTotal(document, rollTotal, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    const content = _loc('CAT.Dialog.UseRollTotal', {document: document.name, rollTotal});
    return await confirm('COMMON.Confirm', content, {userId, buttons});
}
async function confirmUseForRollTotal(document, name, rollTotal, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    const content = _loc('CAT.Dialog.UseForRollTotal', {document: document.name, name, rollTotal});
    return await confirm('COMMON.Confirm', content, {userId, buttons});
}
async function confirmRecoverUses(document, documentWithUses, {spent, userId = game.user.id, buttons = 'yesNo'} = {}) {
    const uses = (documentWithUses.system ?? documentWithUses).uses;
    return await confirm('COMMON.Confirm', _loc('CAT.Dialog.UseRecover', {document: document.name, spent: spent ?? uses?.spent ?? 0, max: uses?.max ?? 0, resource: documentWithUses.name}), {userId, buttons});
}
async function queuedConfirmDialog(title, content, {userId = game.user.id} = {}) {
    let selection = await runQueuedDialog(userId, title, content, [], 'yesNo');
    return selection?.buttons;
}
async function selectTargetDialog(title, content, targets, {type = 'one', selectOptions = [], skipDeadAndUnconscious = true, coverToken = undefined, reverseCover = false, displayDistance = true, maxAmount = 1, minAmount = 0, userId = game.user.id, buttons = 'okCancel', maxes = {}} = {}) {
    const inputType = type === 'multiple' ? 'checkbox' : type === 'number' ? 'number' : type === 'select' ? 'selectOption' : type === 'selectAmount' ? 'selectAmount' : 'radio';
    const inputs = [[inputType]];
    const targetInputs = [];
    const hideNames = game.settings.get('cat', 'hideNames');
    const counter = {value: 1};
    for (const i of targets) {
        let label = getTokenName(i, {hide: hideNames, counter});
        if (coverToken && !reverseCover) label += ' [' + tokenUtils.checkCover(coverToken, i, {displayName: true}) + ']';
        else if (coverToken) label += ' [' + tokenUtils.checkCover(i, coverToken, {displayName: true}) + ']';
        if (displayDistance && coverToken) label += ' [' + tokenUtils.getDistance(coverToken, i).toFixed(2) + ' ' + canvas.scene.grid.units + ' ]';
        targetInputs.push({
            label,
            name: i.id,
            options: {image: i.texture.src, isChecked: type !== 'multiple' && targetInputs.length === 0, options: selectOptions, maxAmount: maxes[i.id] ?? maxAmount, minAmount}
        });
    }
    inputs[0].push(targetInputs);
    inputs[0].push({displayAsRows: true, radioName: 'targets', totalMax: maxAmount});
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
async function selectDie(rolls = [], title, content, {max = 1, userId = game.user.id, buttons = 'okCancel'} = {}) {
    let dice = [];
    for (let i = 0; i < rolls.length; i++) {
        let roll = rolls[i];
        for (let j = 0; j < roll.terms.length; j++) {
            let term = roll.terms[j];
            if (term.isDeterministic) continue;
            let flavor = term.flavor || term.options?.flavor || roll.options?.flavor || '';
            let cfg = CONFIG.DND5E.damageTypes[flavor];
            for (let k = 0; k < term.results.length; k++) {
                dice.push({
                    name: i + '-' + j + '-' + k,
                    faces: term.faces,
                    result: term.results[k].result,
                    typeLabel: cfg?.label ?? flavor,
                    typeIcon: cfg?.icon
                });
            }
        }
    }
    if (!dice.length) return false;
    let inputs = [['dice', dice, {totalMax: max}]];
    let result = await runDialog(userId, title, content, inputs, buttons, {height: 'auto'});
    if (!result?.buttons) return false;
    delete result.buttons;
    return Object.entries(result).filter(([, v]) => v).map(([k]) => k);
}
export default {
    buttonDialog,
    numberDialog,
    selectDialog,
    selectDocumentDialog,
    selectScaledDocument,
    selectSpellSlots,
    selectDamageType,
    selectHitDie,
    confirm,
    confirmUseItem,
    confirmUseExtraCost,
    confirmUseRollTotal,
    confirmUseForRollTotal,
    confirmRecoverUses,
    queuedConfirmDialog,
    selectTargetDialog,
    selectDie
};
