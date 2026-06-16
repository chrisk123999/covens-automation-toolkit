import quickConditions from '../handlers/quickConditions.mjs';
import {documentUtils, genericUtils, uiUtils} from '../utilities/_module.mjs';
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {Collection} = foundry.utils;
export default class QuickConditions extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(data) {
        super({id: 'cat-quick-conditions-window'});
        this.windowTitle = genericUtils.translate('CAT.QuickConditions.Title');
        this.data = data;
        this.value = this.data.entity[this.data.fieldId];
        this._conditions = quickConditions.constants;
        this._activeConditions = new Collection();
        this._inactiveConditions = new Collection(quickConditions.constants.entries());
    }
    static DEFAULT_OPTIONS = {
        id: 'cat-quick-conditions-window',
        classes: ['cat', 'cat-embedded-macros', 'cat-quick-conditions-app'],
        tag: 'form',
        window: {frame: false, positioned: true},
        position: {width: 700, height: 'auto'},
        form: {handler: QuickConditions.formHandler, submitOnChange: false, closeOnSubmit: false},
        actions: {add: QuickConditions.add, remove: QuickConditions.remove}
    };
    static PARTS = {
        body: {template: 'modules/cat/templates/quick-conditions.hbs', scrollable: ['.cat-embedded-macros-body']}
    };
    static formHandler(event, form, formData) {
        if (this.data.entity) documentUtils.update(this.data.entity, {[this.data.fieldId]: this.value});
        this.close();
    }
    static add(event, target) {
        let conditionId = target.id;
        let condition = this.inactiveConditions.get(conditionId);
        this.activateCondition(conditionId);
        let baseArray = condition.format.split(/\$([a-zA-Z_][a-zA-Z0-9_]*)/).filter(Boolean);
        let newValue = this.value;
        if (newValue.length) newValue += ' && ';
        baseArray.map(i => {
            let placeholder = condition.data[i];
            let placeholderValue = placeholder?.default;
            if (placeholderValue || (placeholderValue === false)) {
                if (placeholderValue instanceof Array) {
                    newValue += JSON.stringify(placeholderValue);
                } else {
                    if ([true, false, 'true', 'false'].includes(placeholderValue)) {
                        newValue += placeholder.options.find(j => String(j.value) == String(placeholderValue))?.name;
                    } else {
                        newValue += placeholderValue;
                    }
                }
            } else {
                newValue += i;
            }
        });
        this.value = newValue;
        this.render(true);
    }
    static remove(event, target) {
        let conditonId = target.closest('div.quick-conditions-group-condition').id;
        let inputs = this.context.inputs.edit;
        let idx = inputs.findIndex(i => i.id === conditonId);
        if (idx === -1) return;
        inputs.splice(idx, 1);
        this.inactivateCondition(conditonId);
        this.value = this.stringifyTerms(inputs);
        this.render(true);
    }
    get terms() {
        return this.parseTerms(this.value);
    }
    operatorInput(index, op, first) {
        if (first) return {id: 'op-' + index, name: 'op-' + index, type: 'content', value: '', class: 'quick-conditions-op-spacer'};
        return {
            id: 'op-' + index,
            name: 'op-' + index,
            type: 'select',
            class: 'quick-conditions-select-logic',
            options: [
                {name: '&&', display: 'CAT.QuickConditions.Logic.And', value: '&&'},
                {name: '||', display: 'CAT.QuickConditions.Logic.Or', value: '||'}
            ],
            value: op ?? '&&'
        };
    }
    parseTerms(value) {
        let rawTerms = value.split(/(\|\||&&)/g).map(s => s.trim()).filter(Boolean);
        let rows = [];
        let pendingOp = null;
        for (let i = 0; i < rawTerms.length; i++) {
            let term = rawTerms[i];
            if (['&&', '||'].includes(term)) {
                pendingOp = term;
            } else {
                let opInput = this.operatorInput(i, pendingOp, rows.length === 0);
                pendingOp = null;
                let [condition, conditionKey] = this.findCondition(term);
                if (condition) {
                    let baseArray = condition.format.split(/\$([a-zA-Z_][a-zA-Z_]*)/).filter(Boolean);
                    let baseStrings = baseArray.filter(i => !Object.keys(condition.data).some(j => j === i));
                    let termValues = new Set(baseStrings.reduce((acc, value) => acc = acc.replace(value, ''), term.replaceAll("'", '"')).split(/(!|\[[^\]]*\]|'[^']*'|"[^"]*"|\d+|<=|>=|===|==|<|>|=)/).filter(Boolean).map(s => s.trim()).filter(Boolean).map(i => this.safeParse(i)));
                    let inputs = [opInput, {
                        id: conditionKey + '-label',
                        name: conditionKey + '-label',
                        type: 'label',
                        value: condition.label ?? conditionKey,
                        class: 'quick-conditions-label'
                    }];
                    for (let i = 0; i < baseArray.length; i++) {
                        let current = baseArray[i];
                        if (Object.keys(condition.data).includes(current)) {
                            let inputData = condition.data[current];
                            let value = termValues.find(j => inputData.varType(j));
                            termValues.delete(value);
                            let inputType = typeof inputData.default;
                            if ((value) && (inputType != typeof value)) {
                                if (inputType === 'boolean') {
                                    value = !!value;
                                } else if ((inputType instanceof Array) && (typeof value === 'string')) {
                                    value = [value];
                                } else {
                                    console.error('Type mismatch between' + inputData.default + ' and ' + value);
                                }
                            }
                            let options = inputData?.options;
                            if (options) {
                                if (inputType === 'string') {
                                    if (!options.find(i => i.value === value)) options.push({name: value, value});
                                } else if (inputType != 'boolean') value.forEach(i => {
                                    if (!options.find(j => j.value === i)) options.push({name: i, value: i});
                                });
                            }
                            inputs.push({
                                default: inputData.default,
                                id: current,
                                name: current,
                                type: inputData.type,
                                options,
                                min: inputData.min,
                                max: inputData.max,
                                value: value ?? inputData.default
                            });
                        } else {
                            inputs.push({
                                id: 'content-' + i,
                                name: 'content-' + i,
                                type: 'content',
                                value: current,
                                class: 'quick-conditions-div-content'
                            });
                        }
                    }
                    if (!inputs.some(inp => inp.id === 'not')) {
                        inputs.splice(2, 0, {id: conditionKey + '-spacer', name: conditionKey + '-spacer', type: 'content', value: '', class: 'quick-conditions-spacer'});
                    }
                    inputs.push({
                        id: conditionKey + '-remove',
                        name: conditionKey + '-remove',
                        type: 'button',
                        icon: 'fa-solid fa-minus',
                        class: 'quick-conditions-button-remove',
                        dataAction: 'remove'
                    });
                    rows.push({
                        id: conditionKey,
                        class: 'quick-conditions-group-condition cat-row-center',
                        inputs
                    });
                } else {
                    rows.push({
                        id: term + '-text',
                        class: 'quick-conditions-group-condition cat-row-center',
                        inputs: [opInput, {
                            id: 'text-' + i,
                            name: 'text-' + i,
                            type: 'text',
                            value: term,
                            class: 'quick-conditions-div-text',
                            tooltip: 'CAT.QuickConditions.Unknown.Tooltip'
                        }]
                    });
                }
            }
        }
        return rows;
    }
    findCondition(term) {
        let conditions = this.conditions;
        let foundKey;
        conditions.entries().forEach(([key, value]) => {
            if (term.includes(value.searchKey)) foundKey = key;
        });
        if (foundKey) {
            let condition = conditions.get(foundKey);
            this.foundCondition = condition;
            this.activateCondition(foundKey);
            return [condition, foundKey];
        } else {
            this.foundCondition = undefined;
            return [false, false];
        }
    }
    safeParse(string) {
        if ((typeof string != 'string') || (!string.includes('['))) return string;
        try {
            return JSON.parse(string);
        } catch {
            console.error(string + ' is not parseable');
        }
        return string;
    }
    set terms(value) {
        this.value = this.stringifyTerms(value);
        let el = this.element.querySelector('#cat-condition-value');
        el.value = this.value;
    }
    stringifyTerms(value) {
        let newValue = '';
        value.forEach((term, idx) => {
            let op = term.inputs.find(j => j.id?.startsWith('op-'));
            if (idx > 0 && op?.type === 'select') newValue += ` ${op.value} `;
            if (term.id.includes('text')) {
                newValue += term.inputs.find(j => j.id?.startsWith('text-'))?.value ?? '';
            } else {
                let condition = this.activeConditions.get(term.id);
                let baseArray = condition.format.split(/\$([a-zA-Z_][a-zA-Z0-9_]*)/).filter(Boolean);
                baseArray.map(i => {
                    let placeholderValue = term.inputs.find(j => j.id === i);
                    if (placeholderValue) {
                        if (placeholderValue.value instanceof Array) {
                            newValue += JSON.stringify(placeholderValue.value);
                        } else {
                            if ([true, false, 'true', 'false'].includes(placeholderValue.value)) {
                                newValue += placeholderValue.options.find(j => String(j.value) == String(placeholderValue.value))?.name;
                            } else {
                                newValue += placeholderValue.value;
                            }
                        }
                    } else {
                        newValue += i;
                    }
                });
            }
        });
        return newValue;
    }
    get title() {
        return this.windowTitle;
    }
    get context() {
        return this._context;
    }
    set context(value) {
        this._context = value;
    }
    get conditions() {
        return this._conditions;
    }
    set conditions(value) {
        this._conditions = value;
    }
    get foundCondition() {
        return this._foundCondition;
    }
    set foundCondition(value) {
        this._foundCondition = value;
    }
    get activeConditions() {
        return this._activeConditions;
    }
    get inactiveConditions() {
        return this._inactiveConditions;
    }
    activateCondition(value) {
        let inactiveCondition = this._inactiveConditions.get(value);
        if (!inactiveCondition) return;
        this._activeConditions.set(value, inactiveCondition);
        this._inactiveConditions.delete(value);
    }
    inactivateCondition(value) {
        let activeCondition = this._activeConditions.get(value);
        if (!activeCondition) return;
        this._inactiveConditions.set(value, activeCondition);
        this._activeConditions.delete(value);
    }
    formatInputs() {
        let context = {};
        context.title = this.windowTitle;
        context.data = {
            data: {
                value: this.value,
                placeholder: 'CAT.QuickConditions.Placeholder'
            }
        };
        context.inputs = {
            edit: this.terms,
            add: Array.from(this.inactiveConditions.entries()).map(([key, condition]) => ({
                id: key,
                name: key,
                type: 'button',
                class: 'quick-conditions-button-add',
                dataAction: 'add',
                label: condition.label ?? key
            })).sort((a, b) => genericUtils.translate(a.label).localeCompare(genericUtils.translate(b.label)))
        };
        this.context = context;
    }
    async _prepareContext(options) {
        this.formatInputs();
        return this.context;
    }
    async _preClose(options) {
        options.animate = false;
        await uiUtils.fadeOut(this.element);
    }
    bringToFront() {
        uiUtils.bringToFront(this);
    }
    _onRender(context, options) {
        super._onRender(context, options);
        uiUtils.enableWindowDrag(this, '.cat-embedded-macros-header', {ignore: 'button, a, input, select, textarea, [data-action], multi-select'});
        if (options.isFirstRender) {
            this.bringToFront();
            uiUtils.centerWindow(this, {width: 700, height: 480});
        }
    }
    async _onChangeForm(formConfig, event) {
        let targetInput = event.target;
        let groupId = targetInput.closest('div').id;
        let inputId = targetInput.id;
        let value = targetInput.value;
        let currentContext = this.context;
        let inputs = currentContext.inputs.edit;
        let group = inputs.find(i => i.id === groupId);
        if (group) {
            let input = group.inputs.find(i => i.id === inputId);
            if (input) input.value = value;
        }
        this.terms = currentContext.inputs.edit;
        this.context = currentContext;
    }
}
