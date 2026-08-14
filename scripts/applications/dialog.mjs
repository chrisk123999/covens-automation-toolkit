import {uiUtils} from '../utilities/_module.mjs';
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {StringField, NumberField, BooleanField, FilePathField, SetField} = foundry.data.fields;

/**
 * @typedef DialogHint
 * @property {string} label
 * @property {string} id Used to fetch the hint and apply updates.
 * @property {string} [icon] Font Awesome css class.
 * @property {string} [image] The path to an image to be used as an icon.
 * @property {string} [tooltip] Tooltip shown on hover.
 */

const INPUTS_TEMPLATE = 'modules/cat/templates/dialog-fields.hbs';
Hooks.once('setup', () => {
    foundry.applications.handlebars.loadTemplates([INPUTS_TEMPLATE]);
});

// Generic dialog for macros. API matches CPR v13 DialogApp.
export default class DialogApp extends HandlebarsApplicationMixin(ApplicationV2) {
    #context;
    #resolveResults;
    #resultsPromise;
    constructor(options) {
        let title, content, inputs, buttons, config;
        if (options?.length) [title, content, inputs, buttons, config] = options;
        const init = config?.id ? {id: config.id} : {};
        if (config?.width != null || config?.height != null) {
            init.position = {};
            if (config.width != null) init.position.width = config.width;
            if (config.height != null) init.position.height = config.height;
        }
        super(init);
        this.#resultsPromise = new Promise(r => this.#resolveResults = r);
        if (!options?.length) return;
        this.windowTitle = _loc(title);
        this.content = content;
        this.inputs = inputs;
        this.buttons = buttons;
    }

    static DEFAULT_OPTIONS = {
        id: 'cat-dialog-app-{id}',
        classes: ['cat', 'cat-dialog'],
        tag: 'form',
        form: {
            handler: DialogApp.#formHandler,
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            confirm: DialogApp.#confirm,
            request: DialogApp.#request,
            toggleDetach: DialogApp.#onToggleDetach,
            toggleCollapsed: DialogApp.#toggleCollapsed
        },
        window: {
            frame: false,
            positioned: true,
            contentClasses: ['standard-form']
        },
        position: {
            width: 'auto',
            height: 'auto'
        }
    };

    static PARTS = {
        form: {
            template: 'modules/cat/templates/dialog-app.hbs',
            scrollable: ['.scrollable']
        }
    };

    static get SUBINPUT_SEPARATOR() { return '-'; }
    static get GROUP_ID() { return 'g'; }
    static get INPUT_ID() { return 'i'; }

    /** @this {DialogApp} */
    async _preClose(options) {
        options.animate = false;
        await uiUtils.fadeOut(this.element);
    }

    /** @this {DialogApp} */
    static #onToggleDetach() {
        if (this.window.windowId) return this.attachWindow();
        const rect = this.element.getBoundingClientRect();
        // Popup outer dims must include browser chrome so the inner viewport fits the dialog.
        // Foundry's #applyDetachedConstraints clamps to inner viewport, so under-sizing here truncates the dialog.
        const chromeW = (window.outerWidth - window.innerWidth) || 16;
        const chromeH = (window.outerHeight - window.innerHeight) || 80;
        return this.detachWindow({position: {
            width: Math.round(rect.width) + chromeW,
            height: Math.round(rect.height) + chromeH
        }});
    }

    #expandedSections = new Map();
    #queuedOpenSections = new Set();

    /** @this {DialogApp} */
    static #toggleCollapsed(_event, target) {
        const collapsible = target.closest('.cat-form-group');
        if (!collapsible) return;
        collapsible.classList.toggle('collapsed');
        this.#expandedSections.set(
            target.closest('[data-collapsible-id]')?.dataset.collapsibleId,
            !collapsible.classList.contains('collapsed')
        );
    }

    #queueOpenCollapsible(target) {
        const id = target.closest('[data-collapsible-id]')?.dataset.collapsibleId;
        if (!id) return;
        this.#queuedOpenSections.add(id);
    }

    #openCollapsible(target) {
        const collapsible = target.closest('.cat-form-group');
        if (!collapsible) return;
        collapsible.classList.remove('collapsed');
        this.#expandedSections.set(collapsible.dataset.collapsibleId, true);
    }

    _replaceHTML(result, content, options) {
        for (const part of Object.values(result)) {
            for (const element of part.querySelectorAll('[data-collapsible-id]')) {
                element.classList.toggle('collapsed', !this.#expandedSections.get(element.dataset.collapsibleId));
            }
        }
        super._replaceHTML(result, content, options);
    }

    /**
     * @param {string} title - Window title (localization key).
     * @param {string} content - Header content (HTML or localization key).
     * @param {Array} inputs - [type, fields[], options][]. Types: button, checkbox, radio, selectAmount, selectMany, selectOption, combobox, text, number, filePicker.
     * @param {'yesNo'|'okCancel'|'ok'|'cancel'} [buttons]
     * @param {{id?: string, width?: number|string, height?: number|string}} [config]
     * @returns {Promise<object|null>}
     */
    static async dialog(...options) {
        return new Promise((resolve) => {
            const dialog = new DialogApp(options);
            dialog.addEventListener('close', () => resolve(null), {once: true});
            // Inherit detached-window context from the currently active app (so dialogs spawned
            // from a detached popup open in that popup, not the main client).
            const windowId = ui.activeWindow?.window?.windowId;
            const renderOptions = windowId ? {force: true, window: {windowId}} : {force: true};
            dialog.render(renderOptions);
            dialog.submit = result => {
                resolve(result);
                dialog.close();
            };
        });
    }

    /** @this {DialogApp} */
    static async #formHandler(event, form, formData) {
        const results = foundry.utils.expandObject(formData.object);
        this.#context?.inputs?.forEach(inp => inp.options?.forEach(o => {
            if (o.locked && o.isChecked && !(o.name in results)) results[o.name] = true;
        }));
        this.#resolveResults(results);
    }

    /** @this {DialogApp} */
    static async #confirm(event, target) {
        await this.mergeResults(target.name);
    }

    async mergeResults(name) {
        if (name === 'false') {
            this.submit({buttons: false});
            return false;
        }
        const results = await this.#resultsPromise;
        results.buttons = (name === 'true') ? true : name;
        this.submit(results);
    }

    get title() {
        return this.windowTitle;
    }

    static #makeButton(label, name) {
        return {type: 'submit', action: 'confirm', label, name};
    }

    static #makeRange(firstNum, lastNum) {
        const arr = [];
        for (let i = firstNum; i <= lastNum; i++) arr.push(i);
        return arr;
    }

    static #ID_REGEX = new RegExp(`${DialogApp.GROUP_ID}(\\d+)${DialogApp.INPUT_ID}(\\d+)`);

    static #makeID(groupIndex, inputIndex, parentIndex = '') {
        if (parentIndex) parentIndex += DialogApp.SUBINPUT_SEPARATOR;
        return parentIndex + DialogApp.GROUP_ID + groupIndex + DialogApp.INPUT_ID + inputIndex;
    }

    // Convert each declarative input tuple into template-ready entry.
    #formatInputs() {
        const context = {content: this.content, inputs: [], buttons: []};
        context.inputs = this.#buildInputs(this.inputs);
        switch (this.buttons) {
            case 'yesNo':
                context.buttons.push(DialogApp.#makeButton('Yes', 'true'), DialogApp.#makeButton('No', 'false'));
                break;
            case 'okCancel':
                context.buttons.push(DialogApp.#makeButton('Confirm', 'true'), DialogApp.#makeButton('Cancel', 'false'));
                break;
            case 'ok':
                context.buttons.push(DialogApp.#makeButton('Confirm', 'true'));
                break;
            case 'cancel':
                context.buttons.push(DialogApp.#makeButton('Cancel', 'false'));
                break;
        }
        context.inputTemplate = INPUTS_TEMPLATE;
        this.#context = context;
    }

    #buildInputs(inputs, parentIndex = '') {
        if (!inputs?.length) return;
        const built = [];
        for (let i = 0; i < inputs.length; i++) {
            const [inputType, inputFields, inputOptions] = inputs[i];
            const entry = this.#buildInput(inputType, inputFields, inputOptions, i, parentIndex);
            if (entry) built.push(entry);
        }
        return built;
    }

    #buildInput(type, ...args) {
        switch (type) {
            case 'text': return this.#buildText(...args);
            case 'dice': return this.#buildDice(...args);
            case 'radio': return this.#buildRadio(...args);
            case 'button': return this.#buildButton(...args);
            case 'number': return this.#buildNumber(...args);
            case 'slider': return this.#buildSlider(...args);
            case 'formula': return this.#buildFormula(...args);
            case 'request': return this.#buildRequest(...args);
            case 'checkbox': return this.#buildCheckbox(...args);
            case 'combobox': return this.#buildCombobox(...args);
            case 'filePicker': return this.#buildFilePicker(...args);
            case 'selectMany': return this.#buildSelectMany(...args);
            case 'selectOption': return this.#buildSelectOption(...args);
            case 'selectAmount': return this.#buildSelectAmount(...args);
            case 'comboboxMulti': return this.#buildComboboxMulti(...args);
        }
    }

    #buildSlider(fields, opts, index, parentIndex) {
        return {
            isSlider: true,
            options: fields.map((f, i) => ({
                name: f.name,
                label: f.label,
                hints: f.hints?.map(h => ({
                    label: h.label,
                    icon: h.icon,
                    tooltip: h.tooltip,
                    id: h.id
                })),
                value: f.value,
                min: f.options?.min,
                max: f.options?.max,
                step: f.options?.step,
                image: f.options?.image,
                tooltip: f.options?.tooltip,
                reference: f.options?.reference,
                invertColor: f.options?.invertColor,
                onchange: f.options?.onchange,
                id: DialogApp.#makeID(index, i, parentIndex),
                subinputs: this.#buildInputs(f.options?.subinputs, DialogApp.#makeID(index, i, parentIndex))
            })),
            hasSubinputs: fields.some(f => f.options?.subinputs?.length),
            legend: opts?.legend
        };
    }

    #buildDice(fields, opts, _index, _parentIndex) {
        const standardFaces = new Set([4, 6, 8, 10, 12, 20]);
        const groups = new Map();
        for (const f of fields) {
            const key = f.typeLabel ?? '';
            if (!groups.has(key)) groups.set(key, {label: key, icon: f.typeIcon, total: 0, dice: []});
            const g = groups.get(key);
            g.total += f.result;
            g.dice.push({
                name: f.name,
                faces: f.faces,
                result: f.result,
                isStandard: standardFaces.has(f.faces),
                isMin: f.result === 1,
                isMax: f.result === f.faces
            });
        }
        const grandTotal = fields.reduce((acc, f) => acc + f.result, 0);
        return {
            isDice: true,
            totalMax: opts?.totalMax ?? 99,
            showCounter: opts?.totalMax != null,
            currentNum: 0,
            grandTotal,
            groups: Array.from(groups.values()),
            options: fields.map((f, i) => ({name: f.name, isChecked: false})),
            legend: opts?.legend
        };
    }

    #buildFormula(fields, opts, index, parentIndex) {
        const groups = fields.map((f, i) => {
            const dice = [];
            for(let j = 0; j < f.terms.length; j++) {
                const t = f.terms[j];
                if (t instanceof foundry.dice.terms.OperatorTerm) continue;
                const add = j === 0 || f.terms[j - 1]?.operator === '+';
                if (t.faces) dice.push(...new Array(t.number).fill({
                    tooltip: t.denomination,
                    faces: t.faces,
                    add
                }));
                else dice.push({
                    tooltip: t.formula,
                    value: t.formula,
                    add
                });
            }
            const type = f.options?.type;
            const cfg = CONFIG.DND5E.damageTypes[type] ?? CONFIG.DND5E.healingTypes[type];
            return {
                id: DialogApp.#makeID(index, i, parentIndex),
                formula: f.formula,
                label: cfg?.label,
                icon: cfg?.icon,
                dice
            };
        });
        return {
            isFormula: true,
            groups,
            header: opts?.header,
            legend: opts?.legend
        };
    }

    #buildButton(fields, opts, index, parentIndex) {
        return {
            isButton: true,
            displayAsRows: opts?.displayAsRows ?? false,
            options: fields.map((f, i) => ({
                label: f.label,
                name: f.name,
                image: f.options?.image,
                invertColor: f.options?.invertColor,
                tooltip: f.options?.tooltip,
                reference: f.options?.reference,
                id: DialogApp.#makeID(index, i, parentIndex)
            })),
            legend: opts?.legend
        };
    }

    #buildCheckbox(fields, opts, index, parentIndex) {
        // Single checkbox with no totalMax / image → helper route (BooleanField).
        if (fields.length === 1 && opts?.totalMax == null && !fields[0].options?.image) {
            const f = fields[0];
            return {
                useHelper: true,
                options: [{
                    field: new BooleanField({label: f.label}),
                    name: f.name,
                    value: f.options?.isChecked ?? false,
                    onchange: f.options?.onchange,
                    id: DialogApp.#makeID(index, 0, parentIndex)
                }]
            };
        }
        const options = fields.map((f, i) => ({
            label: f.label,
            name: f.name,
            isChecked: f.options?.isChecked ?? false,
            image: f.options?.image,
            tooltip: f.options?.tooltip,
            reference: f.options?.reference,
            invertColor: f.options?.invertColor,
            hints: f.hints?.map(h => ({
                label: h.label,
                icon: h.icon,
                tooltip: h.tooltip,
                id: h.id
            })),
            subinputs: this.#buildInputs(f.options?.subinputs, DialogApp.#makeID(index, i, parentIndex)),
            locked: f.options?.locked ?? false,
            onchange: f.options?.onchange,
            tags: f.options?.tags?.map(t => ({
                tooltip: t.tooltip,
                label: t.label,
                image: t.image,
                icon: t.icon,
                id: t.id
            })),
            id: DialogApp.#makeID(index, i, parentIndex)
        }));
        return {
            isCheckbox: true,
            options,
            totalMax: opts?.totalMax ?? 99,
            showCounter: opts?.totalMax != null,
            currentNum: options.filter(i => i.isChecked).length,
            hasSubinputs: options.some(i => i.subinputs?.length),
            legend: opts?.legend
        };
    }

    static get requestStates() {
        return {
            idle: {key: 'idle', label: _loc('CAT.Dialog.Request.Request')},
            pending: {key: 'pending', label: _loc('CAT.Dialog.Request.Pending'), icon: 'fas fa-circle-notch fa-spin'},
            approved: {key: 'approved', label: _loc('CAT.Dialog.Request.Approved')},
            declined: {key: 'declined', label: _loc('CAT.Dialog.Request.Declined')}
        };
    }

    /** @this {DialogApp} */
    static async #request(_event, target) {
        const states = DialogApp.requestStates;
        const input = this.#getContextByID(target.id)?.input;
        if (input?.state.key !== states.idle.key) return;
        input.state = states.pending;
        await this.render(true);
        let result = await input.onrequest?.();
        let reason;
        if (typeof result === 'object') ({result, reason} = result);
        if (!this.rendered) return;
        input.state = result ? states.approved : states.declined;
        input.stateReason = reason;
        input.isChecked = result;
        await this.render(true);
    }

    #buildRequest(fields, opts, index, parentIndex) {
        const states = DialogApp.requestStates;
        const options = fields.map((f, i) => ({
            label: f.label,
            name: f.name,
            state: states.idle,
            stateReason: f.options?.stateReason,
            isChecked: false,
            onrequest: f.onrequest,
            image: f.options?.image,
            tooltip: f.options?.tooltip,
            reference: f.options?.reference,
            invertColor: f.options?.invertColor,
            hints: f.hints?.map(h => ({
                label: h.label,
                icon: h.icon,
                tooltip: h.tooltip,
                id: h.id
            })),
            subinputs: this.#buildInputs(f.options?.subinputs, DialogApp.#makeID(index, i, parentIndex)),
            onchange: f.options?.onchange,
            tags: f.options?.tags?.map(t => ({
                tooltip: t.tooltip,
                label: t.label,
                image: t.image,
                icon: t.icon,
                id: t.id
            })),
            id: DialogApp.#makeID(index, i, parentIndex)
        }));
        return {
            isRequest: true,
            options,
            hasSubinputs: options.some(i => i.subinputs?.length),
            legend: opts?.legend
        };
    }

    #buildRadio(fields, opts, index, parentIndex) {
        return {
            isRadio: true,
            options: fields.map((f, i) => ({
                label: f.label,
                hints: f.hints?.map(h => ({
                    label: h.label,
                    icon: h.icon,
                    tooltip: h.tooltip,
                    id: h.id
                })),
                name: f.name,
                isChecked: f.options?.isChecked ?? false,
                image: f.options?.image,
                tooltip: f.options?.tooltip,
                reference: f.options?.reference,
                invertColor: f.options?.invertColor,
                subinputs: this.#buildInputs(f.options?.subinputs, DialogApp.#makeID(index, i, parentIndex)),
                onchange: f.options?.onchange,
                tags: f.options?.tags?.map(t => ({
                    tooltip: t.tooltip,
                    label: t.label,
                    image: t.image,
                    icon: t.icon,
                    id: t.id
                })),
                id: DialogApp.#makeID(index, i, parentIndex)
            })),
            hasSubinputs: fields.some(f => f.options?.subinputs?.length),
            radioName: opts?.radioName ?? 'radio',
            legend: opts?.legend
        };
    }

    #buildSelectAmount(fields, opts, index, parentIndex) {
        const options = fields.map((f, i) => {
            const min = f.options?.minAmount ?? 0;
            const max = f.options?.maxAmount ?? 10;
            const id = DialogApp.#makeID(index, i, parentIndex);
            return {
                id,
                label: f.label,
                hints: f.hints?.map(h => ({
                    label: h.label,
                    icon: h.icon,
                    tooltip: h.tooltip,
                    id: h.id
                })),
                name: f.name,
                minAmount: min,
                maxAmount: max,
                currentAmount: f.options?.currentAmount ?? 0,
                weight: f.options?.weight ?? 1,
                options: DialogApp.#makeRange(min, max),
                image: f.options?.image,
                tooltip: f.options?.tooltip,
                reference: f.options?.reference,
                invertColor: f.options?.invertColor,
                subinputs: this.#buildInputs(f.options?.subinputs, id),
                tags: f.options?.tags?.map(t => ({
                    tooltip: t.tooltip,
                    label: t.label,
                    image: t.image,
                    icon: t.icon,
                    id: t.id
                })),
                onchange: f.options?.onchange
            };
        });
        return this.#currentMaxAmounts({
            hasSubinputs: options.some(o => o.subinputs?.length),
            isSelectAmount: true,
            totalMax: opts?.totalMax,
            options,
            legend: opts?.legend
        });
    }

    #buildSelectMany(fields, opts, index, parentIndex) {
        return {
            useHelper: true,
            options: fields.map((f, i) => {
                const choices = (f.options?.options ?? []).reduce((acc, i) => {
                    acc[i.value] = i.label;
                    return acc;
                }, {});
                return {
                    field: new SetField(new StringField({choices}), {label: f.label, hint: f.hint}),
                    name: f.name,
                    value: f.options?.value ?? [],
                    id: DialogApp.#makeID(index, i, parentIndex),
                    onchange: f.options?.onchange
                };
            }),
            legend: opts?.legend
        };
    }

    #buildSelectOption(fields, opts, _index, _parentIndex) {
        return {
            useHelper: true,
            options: fields.map(f => {
                const choices = (f.options?.options ?? []).reduce((acc, i) => {
                    if (typeof i === 'string') acc[i] = i;
                    else acc[i.value] = i.label;
                    return acc;
                }, {});
                return {
                    field: new StringField({label: f.label, hint: f.hint, choices, required: true, blank: false}),
                    name: f.name,
                    value: f.options?.currentValue ?? '',
                    onchange: f.options?.onchange
                };
            }),
            legend: opts?.legend
        };
    }

    #buildCombobox(fields, opts, index, parentIndex) {
        return {
            isCombobox: true,
            options: fields.map((f, i) => ({
                label: f.label,
                hints: f.hints?.map(h => ({
                    label: h.label,
                    icon: h.icon,
                    tooltip: h.tooltip,
                    id: h.id
                })),
                name: f.name,
                tooltip: f.options?.tooltip,
                reference: f.options?.reference,
                value: f.options?.value ?? '',
                placeholder: f.options?.placeholder ?? '',
                options: (f.options?.options ?? []).map(o => ({
                    value: o.value,
                    label: o.label,
                    image: o.image ?? '',
                    tag: o.tag ?? ''
                })),
                subinputs: this.#buildInputs(f.options?.subinputs, DialogApp.#makeID(index, i, parentIndex)),
                id: DialogApp.#makeID(index, i, parentIndex),
                onchange: f.options?.onchange
            })),
            hasSubinputs: fields.some(f => f.options?.subinputs?.length),
            legend: opts?.legend
        };
    }

    #buildComboboxMulti(fields, opts, index, parentIndex) {
        return {
            isComboboxMulti: true,
            options: fields.map((f, i) => ({
                label: f.label,
                hints: f.hints?.map(h => ({
                    label: h.label,
                    icon: h.icon,
                    tooltip: h.tooltip,
                    id: h.id
                })),
                name: f.name,
                tooltip: f.options?.tooltip,
                reference: f.options?.reference,
                placeholder: f.options?.placeholder ?? '',
                amounts: !!f.options?.amounts,
                maxTotal: f.options?.maxTotal ?? null,
                options: (f.options?.options ?? []).map(o => ({
                    value: o.value,
                    label: o.label,
                    image: o.image ?? '',
                    tag: o.tag ?? '',
                    weight: o.weight ?? 1,
                    max: o.max ?? null,
                    selected: o.selected,
                    amount: o.amount
                })),
                subinputs: this.#buildInputs(f.options?.subinputs, DialogApp.#makeID(index, i, parentIndex)),
                id: DialogApp.#makeID(index, i, parentIndex),
                onchange: f.options?.onchange
            })),
            hasSubinputs: fields.some(f => f.options?.subinputs?.length),
            legend: opts?.legend
        };
    }

    #buildText(fields, opts, _index, _parentIndex) {
        return {
            useHelper: true,
            options: fields.map(f => ({
                field: new StringField({label: f.label, hint: f.hint}),
                name: f.name,
                value: f.options?.currentValue ?? '',
                onchange: f.options?.onchange
            })),
            legend: opts?.legend
        };
    }

    #buildNumber(fields, opts, _index, _parentIndex) {
        return {
            useHelper: true,
            options: fields.map(f => ({
                field: new NumberField({label: f.label, hint: f.hint}),
                name: f.name,
                value: f.options?.currentValue ?? 0,
                onchange: f.options?.onchange
            })),
            legend: opts?.legend
        };
    }

    #buildFilePicker(fields, opts, _index, _parentIndex) {
        return {
            useHelper: true,
            options: fields.map(f => {
                const type = (f.options?.type ?? 'image').toUpperCase();
                const categories = type === 'ANY' ? CONST.MEDIA_FILE_CATEGORIES
                    : type === 'IMAGEVIDEO' ? ['IMAGE', 'VIDEO']
                        : type in CONST.FILE_CATEGORIES ? [type] : ['IMAGE'];
                return {
                    field: new FilePathField({label: f.label, categories, hint: f.hint}),
                    name: f.name,
                    value: f.options?.currentValue ?? '',
                    onchange: f.options?.onchange
                };
            }),
            legend: opts?.legend
        };
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        if (!this.#context) this.#formatInputs();
        const detached = options.window?.attach ? false : options.window?.detach ? true : !!this.window.windowId;
        return {...context, ...this.#context, title: this.windowTitle, detached};
    }

    // Cap each option's max so combined weighted amounts stay under totalMax.
    #currentMaxAmounts(input) {
        const clone = foundry.utils.deepClone(input);
        let max = clone.totalMax;
        clone.options.forEach(o => max -= o.currentAmount * o.weight);
        for (const i of clone.options) {
            i.currentMaxAmount = Math.floor((max + (i.currentAmount * i.weight)) / i.weight);
        }
        clone.currentSpent = (clone.totalMax ?? 0) - max;
        clone.atMax = clone.totalMax != null && clone.currentSpent >= clone.totalMax;
        return clone;
    }

    #getContextByID(id) {
        const groups = id?.split(DialogApp.SUBINPUT_SEPARATOR);
        if (!groups?.length) return;
        let ctx = this.#context;
        let group, input;
        for (let i = 0; i < groups.length; i++) {
            const idx = groups[i].match(DialogApp.#ID_REGEX);
            if (!idx) return;
            group = parseInt(idx[1]);
            input = parseInt(idx[2]);
            if (groups.length > 1 && i !== groups.length - 1)
                ctx = {inputs: ctx.inputs[group].options[input].subinputs};
        }
        return {
            fullContext: this.#context,
            thisContext: ctx,
            groupIndex: group,
            inputIndex: input,
            group: ctx.inputs[group],
            input: ctx.inputs[group].options[input],
            getInputById: (id) => this.#getContextByID(id).input
        };
    }

    async _onChangeForm(formConfig, event) {
        super._onChangeForm(formConfig, event);
        const targetInput = event.target;
        const dicePicker = targetInput.closest?.('.cat-dice-picker');
        if (dicePicker && targetInput.type === 'checkbox') {
            const totalMax = Number(dicePicker.dataset.totalMax);
            if (!totalMax) return;
            const checked = dicePicker.querySelectorAll('input[type=checkbox]:checked').length;
            if (checked > totalMax) {
                targetInput.checked = false;
                return;
            }
            const counter = this.element?.querySelector('.cat-budget-counter');
            if (counter) {
                counter.textContent = `${checked}/${totalMax}`;
                counter.classList.toggle('at-max', checked >= totalMax);
            }
            return;
        }
        const ctx = this.#getContextByID(targetInput.id);
        if (!ctx) return;
        let changed = false;
        switch (targetInput.type || targetInput.localName) {
            case 'checkbox':
                ctx.input.isChecked = targetInput.checked;
                ctx.group.currentNum = ctx.group.options.reduce((acc, c) => acc += c.isChecked, 0);
                if (ctx.group.showCounter) changed = true;
                break;
            case 'select-one':
                if (ctx.group.isSelectAmount) {
                    ctx.input.currentAmount = Number(targetInput.value);
                    if (ctx.input?.weight) ctx.group = this.#currentMaxAmounts(ctx.group);
                    changed = true;
                }
                break;
            case 'radio':
                ctx.group.options.forEach(o => o.isChecked = false);
                ctx.input.isChecked = targetInput.checked;
                changed = true;
                break;
            case 'range-picker':
                ctx.input.value = targetInput.value;
                break;
            case 'cat-combobox':
                ctx.input.value = targetInput.value;
                break;
            case 'cat-multi-combobox': {
                const selected = targetInput.selected;
                for (const option of ctx.input.options) {
                    option.selected = selected.has(option.value);
                    option.amount = selected.get(option.value);
                }
                break;
            }
        }
        if (ctx.input.onchange) changed ||= ctx.input.onchange(ctx);
        if (ctx.group.hasSubinputs && ctx.input.isChecked) {
            if (!changed) this.#openCollapsible(targetInput);
            else this.#queueOpenCollapsible(targetInput);
        }

        if (changed) this.render(true);
    }

    // dnd5e fills the tooltip on hover via this placeholder.
    #applyTooltip(element) {
        if ('tooltip' in element.dataset) return;
        const uuid = element.dataset.referenceTooltip;
        element.dataset.tooltip = `<section class="loading" data-uuid="${uuid}"><i class="fas fa-spinner fa-spin-pulse"></i></section>`;
        if (element.dataset.attribution) element.dataset.tooltipClass = 'property-attribution';
    }

    bringToFront() {
        uiUtils.bringToFront(this);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        uiUtils.enableWindowDrag(this, '.cat-dialog-header');
        const header = this.element?.querySelector('.cat-dialog-header');
        if (header) {
            const moveToHeader = this.element?.querySelectorAll('.cat-dialog-body .cat-dialog-subheader');
            const counter = this.element?.querySelector('.cat-dialog-body .cat-budget-counter');
            if (counter) header.insertBefore(counter, header.querySelector('.cat-dialog-detach'));
            if (moveToHeader?.length) header.after(...moveToHeader);
        }
        if (options.isFirstRender) {
            this.bringToFront();
            uiUtils.centerWindow(this, {width: 400, height: 300});
            this.element.addEventListener('cat-resize', () => {
                this.setPosition({width: 'auto', height: 'auto'});
            });
        }
        for (const elem of this.element.querySelectorAll('.label-image[data-token-id]')) {
            const id = elem.dataset.tokenId;
            elem.addEventListener('click', async () => {
                const token = canvas.tokens.get(id);
                if (token) await canvas.ping(token.center);
            });
            elem.addEventListener('mouseover', () => {
                const token = canvas.tokens.get(id);
                if (!token) return;
                token.hover = true;
                token.refresh();
            });
            elem.addEventListener('mouseout', () => {
                const token = canvas.tokens.get(id);
                if (!token) return;
                token.hover = false;
                token.refresh();
            });
        }
        for (const id of this.#queuedOpenSections) {
            const collapsible = this.element.querySelector('#' + id);
            if (!collapsible) continue;
            this.#openCollapsible(collapsible);
        }
        this.#queuedOpenSections.clear();
        this.element.querySelectorAll('[data-reference-tooltip]').forEach(el => this.#applyTooltip(el));
    }
}

// Queue dialogs so two never stack at once.
export class DialogManager {
    #queue = Promise.resolve();
    async showDialog(dialogFunction, ...args) {
        const previous = this.#queue;
        let releaseSlot;
        this.#queue = new Promise(resolve => { releaseSlot = resolve; });
        try {
            await previous;
            await new Promise(resolve => setTimeout(resolve, 500));
            return await dialogFunction(...args);
        } finally {
            releaseSlot();
        }
    }
}

export const dialogQueue = new DialogManager();
