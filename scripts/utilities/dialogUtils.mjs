import DialogApp, {dialogQueue} from '../applications/dialog.mjs';
import {queryUtils, tokenUtils, automationUtils} from './_module.mjs';

async function runDialog(userId, title, content, inputs, buttons, config) {
    if (userId === game.user.id) return await DialogApp.dialog(title, content, inputs, buttons, config);
    return await queryUtils.query('dialog', game.users.get(userId), {title, content, inputs, buttons, config}, 300000);
}
async function runQueuedDialog(userId, title, content, inputs, buttons, config, reason) {
    if (userId === game.user.id) {
        return await dialogQueue.showDialog(async (...args) => {
            if (reason) ui.notifications.info(reason);
            return await DialogApp.dialog(...args);
        }, title, content, inputs, buttons, config);
    }
    return await queryUtils.query('queuedDialog', game.users.get(userId), {title, content, inputs, buttons, config, reason}, 300000);
}
async function confirm(title, content, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    let selection = await runDialog(userId, title, content, [], buttons);
    return selection?.buttons;
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
async function selectDocumentDialog(title, content, documents, {max = 1, displayTooltips = false, sort = null, userId = game.user.id, addNoneDocument = false, showCR = false, showSpellLevel = false, showUses = false, displayReference = false, combobox = false, checkbox = false, weights = {}, maxes = {}, validate = null, tags = {}, selects = {}} = {}) {
    if (sort === 'alphabetical') documents = [...documents].sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}));
    else if (sort === 'cr') documents = [...documents].sort((a, b) => (a.system?.details?.cr ?? 0) - (b.system?.details?.cr ?? 0));
    else if (sort === 'level') documents = [...documents].sort((a, b) => (a.system?.level ?? 0) - (b.system?.level ?? 0) || a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}));
    let isCompendiumDoc = !documents[0]?.id;
    let docKey = d => isCompendiumDoc ? (d.uuid ?? d.actor?.uuid) : (d.id ?? d._id ?? d.actor?.id);
    let resolveDoc = async key => isCompendiumDoc ? await fromUuid(key) : documents.find(d => docKey(d) === key);
    let ordinal = n => {
        if (n === 0) return _loc('DND5E.SpellCantrip') || 'Cantrip';
        let s = ['th', 'st', 'nd', 'rd'], v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    let buildEntry = doc => {
        let tagList = [];
        if (showCR) tagList.push(_loc('DND5E.CRLabel', {cr: dnd5e.utils.formatCR(doc.system?.details?.cr ?? 0, {narrow: false})}));
        if (showSpellLevel) tagList.push(ordinal(doc.system?.level ?? 0));
        let uses = doc.system?.uses ?? doc.uses;
        if (showUses && uses?.max) tagList.push(`${uses.value ?? '?'}/${uses.max}`);
        let extraTag = tags[doc.id ?? doc._id ?? doc.uuid];
        if (extraTag) tagList.push(extraTag);
        let label = doc.name + (doc.system?.linkedActivity ? ' (' + doc.system.linkedActivity.item.name + ')' : '');
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
    let inputFields = documents.map(d => {
        let {label, tag} = buildEntry(d);
        return {
            label: checkbox ? label : buildLabel(d),
            name: multiKey(d),
            options: {
                image: d.img,
                tooltip: displayTooltips ? d.system?.description?.value?.replace(/<[^>]*>?|@UUID\[.*?\]{(.*?)}/gm, '$1') : undefined,
                hint: checkbox ? tag : undefined,
                select: checkbox ? selects?.[multiKey(d)] : undefined,
                minAmount: 0,
                maxAmount: maxes?.[multiKey(d)] ?? max,
                weight: weights?.[multiKey(d)] ?? 1
            }
        };
    });
    inputs = [[checkbox ? 'checkbox' : 'selectAmount', inputFields, {displayAsRows: true, totalMax: max}]];
    result = await runDialog(userId, title, content, inputs, 'okCancel', {height: 'auto', validate});
    if (!result?.buttons) return false;
    delete result.buttons;
    return Object.entries(result).map(([key, value]) => {
        let document = documents.find(d => multiKey(d) === key);
        if (!document) return null;
        return {document, amount: Number(value), select: result['sel-' + key]};
    }).filter(i => i);
}
async function selectSpellSlot(actor, title, content, {maxLevel = 9, minLevel = 0, userId = game.user.id, no = false} = {}) {
    let buttons = Object.entries(actor.system.spells).filter(([k, v]) => {
        if (v.level > maxLevel || v.level < minLevel) return false;
        if (k === 'spell0') return false;
        return v.value > 0 && v.max > 0;
    }).map(([k, v]) => {
        if (k === 'pact') return [CONFIG.DND5E.spellPreparationModes.pact.label + ' (' + v.level + ')', 'pact'];
        return [CONFIG.DND5E.spellLevels[v.level], v.level];
    });
    if (no) buttons.push(['No', false]);
    return await buttonDialog(title, content, buttons, {displayAsRows: true, userId});
}
async function selectDamageType(damageTypes, title, content, {addNo = false, userId = game.user.id} = {}) {
    let buttons = damageTypes.map(t => [
        CONFIG.DND5E.damageTypes[t]?.label ?? t,
        t,
        {image: CONFIG.DND5E.damageTypes[t]?.icon, imageClass: 'cat-dmg-icon'}
    ]);
    if (addNo) buttons.push(['No', false, {image: 'icons/svg/cancel.svg'}]);
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
async function confirmUseItem(item, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    let content = _loc('CAT.Dialog.Use', {itemName: item.name});
    return await confirm('COMMON.Confirm', content, {userId, buttons});
}
async function confirmRecoverUses(document, documentWithUses, {spent, userId = game.user.id, buttons = 'yesNo'} = {}) {
    const uses = (documentWithUses.system ?? documentWithUses).uses;
    return await confirm('COMMON.Confirm', _loc('CAT.Dialog.UseRecover', {document: document.name, spent: spent ?? uses?.spent ?? 0, max: uses?.max ?? 0, resource: documentWithUses.name}), {userId, buttons});
}
async function queuedConfirmDialog(title, content, {actor, reason, userId = game.user.id} = {}) {
    let selection = await runQueuedDialog(userId, title, content, [], 'yesNo', undefined, reason);
    return selection?.buttons;
}
async function selectTargetDialog(title, content, targets, {type = 'one', selectOptions = [], skipDeadAndUnconscious = true, coverToken = undefined, reverseCover = false, displayDistance = true, maxAmount = 1, minAmount = 0, userId = game.user.id, buttons = 'okCancel', maxes = {}} = {}) {
    const inputType = type === 'multiple' ? 'checkbox' : type === 'number' ? 'number' : type === 'select' ? 'selectOption' : type === 'selectAmount' ? 'selectAmount' : 'radio';
    const inputs = [[inputType]];
    const targetInputs = [];
    const hideNames = game.settings.get('cat', 'hideNames');
    let number = 1;
    for (const i of targets) {
        let label;
        if (hideNames && i.disposition <= 0) {
            label = _loc('CAT.Dialog.UnknownTarget') + ' (' + number + ')';
            number++;
        } else {
            label = i.name;
        }
        if (coverToken && !reverseCover) label += ' [' + tokenUtils.checkCover(coverToken, i, {displayName: true}) + ']';
        else if (coverToken) label += ' [' + tokenUtils.checkCover(i, coverToken, {displayName: true}) + ']';
        if (displayDistance && coverToken) label += ' [' + tokenUtils.getDistance(coverToken, i).toFixed(2) + ' ' + canvas.scene.grid.units + ' ]';
        targetInputs.push({
            label,
            name: i.id,
            options: {image: i.texture.src, isChecked: targetInputs.length === 0, options: selectOptions, maxAmount: maxes[i.id] ?? maxAmount, minAmount}
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
    confirm,
    buttonDialog,
    numberDialog,
    selectDialog,
    selectDocumentDialog,
    selectSpellSlot,
    selectDamageType,
    selectHitDie,
    confirmUseItem,
    confirmRecoverUses,
    queuedConfirmDialog,
    selectTargetDialog,
    selectDie
};
