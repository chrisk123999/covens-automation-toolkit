import QuickConditions from '../applications/quick-conditions.mjs';
import {genericUtils} from '../utilities/_module.mjs';
const {Collection} = foundry.utils;
function onRender(application, element) {
    const names = ['useConditionText', 'effectConditionText'];
    const data = {entity: application.activity, uuid: application.activity.uuid};
    names.forEach(name => {
        const node = element.querySelector('.form-fields:has([name="' + name + '"])');
        if (!node || node.querySelector('i.cat-quick-conditions')) return;
        const el = document.createElement('i');
        el.id = name;
        el.classList.add('fa-solid', 'fa-plus', 'cat-quick-conditions');
        el.dataset.tooltip = genericUtils.translate('CAT.QuickConditions.Title');
        node.appendChild(el);
        el.addEventListener('click', onClick.bind(data));
    });
}
function registerHelpers() {
    foundry.applications.handlebars.loadTemplates(['modules/cat/templates/quick-conditions.hbs']);
    Handlebars.registerHelper(helpers);
}
function button(input) {
    let html = `<button type="${input.type ?? 'button'}" class="${input.class ?? 'form-button'}" data-action="${input.dataAction}" id="${input.id}" name="${input.name}">`;
    if (input.image) html += `<img class="button-image" src=${input.image}>`;
    html += `<p class="button-text"`;
    if (input.tooltip) html += `data-tooltip="${input.tooltip}"`;
    html += `>`;
    if (input.label) html += genericUtils.translate(input.label);
    if (input.icon) html += `<i class="${input.icon}"></i>`;
    html += `</p></button>`;
    return html;
}
function selectDetailed(input) {
    let html = `<select id="${input.id}" name="${input.name}">`;
    input.options.forEach(i => {
        html += `<option value="${i.value}"`;
        if (input.value === i.value) html += ` selected `;
        html += `>`;
        let text = i.display ?? i.name;
        if (text) html += genericUtils.translate(text.toString());
        html += `</option>`;
    });
    html += `</select>`;
    if (input.label || input.image) {
        html += `<label for="${input.id}">`;
        if (input.image) html += `<img class="label-image" src=${input.image}>`;
        if (input.label) html += `<p class="label-text">${genericUtils.translate(input.label?.toString())}</p>`;
        html += `</label>`;
    }
    return html;
}
function selectMultiple(input) {
    let html = `<multi-select id="${input.id}" name="${input.name}">`;
    input.options.forEach(i => {
        html += `<option value="${i.value}"`;
        if (input.value.includes(i.value)) html += ` selected `;
        html += `>`;
        if (i.name) html += genericUtils.translate(i.name?.toString());
        html += `</option>`;
    });
    html += `</multi-select>`;
    if (input.label || input.image) {
        html += `<label for="${input.id}">`;
        if (input.image) html += `<img class="label-image" src=${input.image}>`;
        if (input.label) html += `<p class="label-text">${genericUtils.translate(input.label?.toString())}</p>`;
        html += `</label>`;
    }
    return html;
}
function contentP(input) {
    return `<p class=${input.class ?? 'form-content'} id=${input.id} name=${input.name}>
        ${input.value}
        </p>
    `;
}
function textInput(input) {
    let html = `<input type="text" class="${input.class}" id="${input.id}" name="${input.name}" value="${input.value}"`;
    if (input.tooltip) html += `data-tooltip="${genericUtils.translate(input.tooltip)}"`;
    html += `></input>`;
    if (input.label) html += `<label for="${input.id}"><p class="label-text">${genericUtils.translate(input.label?.toString())}</p></label>`;
    return html;
}
function labelP(input) {
    return `<span class="${input.class}" id="${input.id}">${genericUtils.translate(input.value?.toString())}</span>`;
}
function numberInput(input) {
    let html = `<input type="number" class="quick-conditions-number" id="${input.id}" name="${input.name}" value="${input.value}"`;
    if (input.min != null) html += ` min="${input.min}"`;
    if (input.max != null) html += ` max="${input.max}"`;
    html += `>`;
    return html;
}
const helpers = {button, selectDetailed, selectMultiple, contentP, textInput, labelP, numberInput};
function onClick(event) {
    const data = this;
    data.fieldId = event.target.id;
    new QuickConditions(data).render(true);
}
class isVar {
    static boolean(value) {return (value === '!') || (value instanceof Boolean);}
    static string(value) {return typeof value === 'string';}
    static array(value) {return value instanceof Array;}
    static object(value) {return (value instanceof Object) && !(value instanceof Array);}
}
class not {
    static default = false;
    static type = 'select';
    static varType = isVar.boolean;
    static options = [
        {name: '!', display: 'CAT.QuickConditions.Not.IsNot', value: true},
        {name: '', display: 'CAT.QuickConditions.Not.Is', value: false}
    ];
}
class creatureTypes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.entries(CONFIG?.DND5E?.creatureTypes ?? {})?.map(([key, value]) => ({name: value.label, value: key}));}
}
class dispositions {
    static get default() {return 'CONST.TOKEN_DISPOSITIONS.HOSTILE';}
    static type = 'select';
    static varType = isVar.string;
    static get options() {return Object?.keys(CONST.TOKEN_DISPOSITIONS ?? {})?.map((key) => ({name: 'CONST.TOKEN_DISPOSITIONS.' + key, display: 'TOKEN.DISPOSITION.' + key, value: 'CONST.TOKEN_DISPOSITIONS.' + key}));}
}
class range {
    static default = '5';
    static type = 'select';
    static varType = isVar.string;
    static options = [5, 10, 15, 20, 25, 30].map(i => ({name: i.toString(), value: i.toString()}));
}
class sizes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.entries(CONFIG?.DND5E?.actorSizes ?? {})?.map(([key, value]) => ({name: value.label, value: key}));}
}
class damageTypes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.entries(CONFIG?.DND5E?.damageTypes ?? {})?.map(([key, value]) => ({name: value.label, value: key}));}
}
class itemActionTypes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.entries(CONFIG?.DND5E?.itemActionTypes ?? {})?.map(([key, value]) => ({name: value, value: key}));}
}
class activityTypes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.keys(CONFIG?.DND5E?.activityTypes ?? {})?.map(key => ({name: key, value: key}));}
}
class alignments {
    static default = 'evil';
    static type = 'select';
    static varType = isVar.string;
    static get options() {return [...new Set(Object?.values(CONFIG?.DND5E?.alignments ?? {})?.flatMap(a => a.split(' ')))].map(i => ({name: i, value: i.toLowerCase()}));}
}
class abilities {
    static default = 'int';
    static type = 'select';
    static varType = isVar.string;
    static get options() {return Object?.values(CONFIG?.DND5E?.abilities ?? {})?.map(value => ({name: value.label, value: value.abbreviation}));}
}
class comparators {
    static default = '>';
    static type = 'select';
    static varType = isVar.string;
    static options = [
        {name: '<', display: 'CAT.QuickConditions.Comparators.lt', value: '<'},
        {name: '>', display: 'CAT.QuickConditions.Comparators.gt', value: '>'},
        {name: '>=', display: 'CAT.QuickConditions.Comparators.ge', value: '>='},
        {name: '<=', display: 'CAT.QuickConditions.Comparators.le', value: '<='}
    ];
}
class scores {
    static default = '4';
    static type = 'number';
    static varType = isVar.string;
    static max = 99;
    static min = -99;
}
class conditions {
    static default = 'grappled';
    static type = 'select';
    static varType = isVar.string;
    static get options() {return Object?.entries(CONFIG?.DND5E?.conditionTypes ?? {})?.map(([key, value]) => ({name: value.name, value: key}));}
}
class itemTypes {
    static default = 'spell';
    static type = 'select';
    static varType = isVar.string;
    static get options() {return Object?.entries(CONFIG?.Item?.typeLabels ?? {})?.map(([key, value]) => ({name: genericUtils.translate(value), value: key}));}
}
const constants = new Collection([
    ['typeOrRace', {
        label: 'CAT.QuickConditions.Conditions.typeOrRace',
        format: '$not$creatureTypes.includes(typeOrRace)',
        searchKey: '.includes(typeOrRace)',
        data: {not, creatureTypes}
    }],
    ['checkNearby', {
        label: 'CAT.QuickConditions.Conditions.checkNearby',
        format: '$not$checkNearby($dispositions, tokenUuid, $range)',
        searchKey: 'checkNearby',
        data: {not, dispositions, range}
    }],
    ['reaction', {
        label: 'CAT.QuickConditions.Conditions.reaction',
        format: 'reaction == "$reactionTypes"',
        searchKey: 'reaction',
        data: {
            reactionTypes: {
                default: 'isHit',
                type: 'select',
                varType: isVar.string,
                options: ['preAttack', 'isAttacked', 'isMissed', 'isHit', 'isDamaged', 'isHealed', 'isSave', 'isSaveSuccess', 'isSaveFail'].map(i => ({name: i, value: i}))
            }
        }
    }],
    ['targetActorSize', {
        label: 'CAT.QuickConditions.Conditions.targetActorSize',
        format: '$not$sizes.includes(target.traits.size)',
        searchKey: '.includes(target.traits.size)',
        data: {not, sizes}
    }],
    ['activityType', {
        label: 'CAT.QuickConditions.Conditions.activityType',
        format: '$not$itemActionTypes.includes(activity.actionType)',
        searchKey: '.includes(activity.actionType)',
        data: {not, itemActionTypes}
    }],
    ['damageType', {
        label: 'CAT.QuickConditions.Conditions.damageType',
        format: '$not$w.damageDetail.some(d=>$damageTypes.includes(d.type))',
        searchKey: '.damageDetail.some',
        data: {not, damageTypes}
    }],
    ['critical', {
        label: 'CAT.QuickConditions.Conditions.critical',
        format: '$not$workflow.isCritical',
        searchKey: 'workflow.isCritical',
        data: {not}
    }],
    ['alignment', {
        label: 'CAT.QuickConditions.Conditions.alignment',
        format: '$not$target.details.alignment.toLowerCase().includes($alignments)',
        searchKey: 'target.details.alignment',
        data: {not, alignments}
    }],
    ['ability', {
        label: 'CAT.QuickConditions.Conditions.ability',
        format: '$not$target.abilities.$abilities.value $comparators $scores',
        searchKey: 'target.abilities.',
        data: {not, abilities, comparators, scores}
    }],
    ['hasCondition', {
        label: 'CAT.QuickConditions.Conditions.hasCondition',
        format: '$not$hasCondition(targetUuid, "$conditions")',
        searchKey: 'hasCondition',
        data: {not, conditions}
    }],
    ['itemType', {
        label: 'CAT.QuickConditions.Conditions.itemType',
        format: 'item.itemType == "$itemTypes"',
        searchKey: 'item.itemType',
        data: {itemTypes}
    }]
]);
export default {
    onRender,
    registerHelpers,
    constants,
    helpers
};
