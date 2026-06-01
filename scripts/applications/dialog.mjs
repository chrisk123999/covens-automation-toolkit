import {uiUtils} from '../utilities/_module.mjs';
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {StringField, NumberField, BooleanField, FilePathField, SetField} = foundry.data.fields;

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
        id: 'cat-dialog-app',
        classes: ['cat', 'cat-dialog'],
        tag: 'form',
        form: {
            handler: DialogApp.#formHandler,
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            confirm: DialogApp.#confirm,
            toggleDetach: DialogApp.#onToggleDetach
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
            scrollable: ['']
        }
    };

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
        this.#resolveResults(foundry.utils.expandObject(formData.object));
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

    // Convert each declarative input tuple into template-ready entry.
    #formatInputs() {
        const context = {content: this.content, inputs: [], buttons: []};
        for (const [inputType, inputFields, inputOptions] of this.inputs) {
            const entry = this.#buildInput(inputType, inputFields, inputOptions);
            if (entry) context.inputs.push(entry);
        }
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
        this.#context = context;
    }

    #buildInput(type, fields, opts) {
        switch (type) {
            case 'button': return this.#buildButton(fields, opts);
            case 'checkbox': return this.#buildCheckbox(fields, opts);
            case 'radio': return this.#buildRadio(fields, opts);
            case 'selectAmount': return this.#buildSelectAmount(fields, opts);
            case 'selectMany': return this.#buildSelectMany(fields, opts);
            case 'selectOption': return this.#buildSelectOption(fields, opts);
            case 'combobox': return this.#buildCombobox(fields, opts);
            case 'comboboxMulti': return this.#buildComboboxMulti(fields, opts);
            case 'text': return this.#buildText(fields);
            case 'number': return this.#buildNumber(fields);
            case 'filePicker': return this.#buildFilePicker(fields);
            case 'dice': return this.#buildDice(fields, opts);
        }
    }

    #buildDice(fields, opts) {
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
            options: fields.map(f => ({name: f.name, isChecked: false}))
        };
    }

    #buildButton(fields, opts) {
        return {
            isButton: true,
            displayAsRows: opts?.displayAsRows ?? false,
            options: fields.map(f => ({
                label: f.label,
                name: f.name,
                image: f.options?.image,
                imageClass: f.options?.imageClass,
                tooltip: f.options?.tooltip,
                reference: f.options?.reference
            }))
        };
    }

    #buildCheckbox(fields, opts) {
        // Single checkbox with no totalMax / image → helper route (BooleanField).
        if (fields.length === 1 && opts?.totalMax == null && !fields[0].options?.image) {
            const f = fields[0];
            return {
                useHelper: true,
                options: [{
                    field: new BooleanField({label: f.label}),
                    name: f.name,
                    value: f.options?.isChecked ?? false
                }]
            };
        }
        const options = fields.map(f => ({
            label: f.label,
            name: f.name,
            isChecked: f.options?.isChecked ?? false,
            image: f.options?.image
        }));
        return {
            isCheckbox: true,
            options,
            totalMax: opts?.totalMax ?? 99,
            showCounter: opts?.totalMax != null,
            currentNum: options.filter(i => i.isChecked).length
        };
    }

    #buildRadio(fields, opts) {
        return {
            isRadio: true,
            options: fields.map(f => ({
                label: f.label,
                name: f.name,
                isChecked: f.options?.isChecked ?? false,
                image: f.options?.image
            })),
            radioName: opts?.radioName ?? 'radio'
        };
    }

    #buildSelectAmount(fields, opts) {
        const options = fields.map(f => {
            const min = f.options?.minAmount ?? 0;
            const max = f.options?.maxAmount ?? 10;
            return {
                label: f.label,
                name: f.name,
                minAmount: min,
                maxAmount: max,
                currentAmount: f.options?.currentAmount ?? 0,
                weight: f.options?.weight ?? 1,
                options: DialogApp.#makeRange(min, max),
                image: f.options?.image
            };
        });
        return this.#currentMaxAmounts({
            isSelectAmount: true,
            totalMax: opts?.totalMax,
            options
        });
    }

    #buildSelectMany(fields) {
        return {
            useHelper: true,
            options: fields.map(f => {
                const choices = (f.options?.options ?? []).reduce((acc, i) => {
                    acc[i.value] = i.label;
                    return acc;
                }, {});
                return {
                    field: new SetField(new StringField({choices}), {label: f.label}),
                    name: f.name,
                    value: f.options?.value ?? []
                };
            })
        };
    }

    #buildSelectOption(fields) {
        return {
            useHelper: true,
            options: fields.map(f => {
                const choices = (f.options?.options ?? []).reduce((acc, i) => {
                    if (typeof i === 'string') acc[i] = i;
                    else acc[i.value] = i.label;
                    return acc;
                }, {});
                return {
                    field: new StringField({label: f.label, choices, required: true, blank: false}),
                    name: f.name,
                    value: f.options?.currentValue ?? ''
                };
            })
        };
    }

    #buildCombobox(fields) {
        return {
            isCombobox: true,
            options: fields.map(f => ({
                label: f.label,
                name: f.name,
                value: f.options?.value ?? '',
                placeholder: f.options?.placeholder ?? '',
                options: (f.options?.options ?? []).map(o => ({
                    value: o.value,
                    label: o.label,
                    image: o.image ?? '',
                    tag: o.tag ?? ''
                }))
            }))
        };
    }

    #buildComboboxMulti(fields) {
        return {
            isComboboxMulti: true,
            options: fields.map(f => ({
                label: f.label,
                name: f.name,
                placeholder: f.options?.placeholder ?? '',
                amounts: !!f.options?.amounts,
                maxTotal: f.options?.maxTotal ?? null,
                options: (f.options?.options ?? []).map(o => ({
                    value: o.value,
                    label: o.label,
                    image: o.image ?? '',
                    tag: o.tag ?? '',
                    weight: o.weight ?? 1,
                    max: o.max ?? null
                }))
            }))
        };
    }

    #buildText(fields) {
        return {
            useHelper: true,
            options: fields.map(f => ({
                field: new StringField({label: f.label}),
                name: f.name,
                value: f.options?.currentValue ?? ''
            }))
        };
    }

    #buildNumber(fields) {
        return {
            useHelper: true,
            options: fields.map(f => ({
                field: new NumberField({label: f.label}),
                name: f.name,
                value: f.options?.currentValue ?? 0
            }))
        };
    }

    #buildFilePicker(fields) {
        return {
            useHelper: true,
            options: fields.map(f => {
                const type = (f.options?.type ?? 'image').toUpperCase();
                const categories = type === 'ANY' ? CONST.MEDIA_FILE_CATEGORIES
                    : type === 'IMAGEVIDEO' ? ['IMAGE', 'VIDEO']
                        : type in CONST.FILE_CATEGORIES ? [type] : ['IMAGE'];
                return {
                    field: new FilePathField({label: f.label, categories}),
                    name: f.name,
                    value: f.options?.currentValue ?? ''
                };
            })
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
        const ctx = this.#context;
        const idMatch = targetInput.id?.match(/i(\d+)j(\d+)/);
        if (!idMatch) return;
        const [i, j] = [parseInt(idMatch[1]), parseInt(idMatch[2])];
        switch (targetInput.type) {
            case 'checkbox': {
                ctx.inputs[i].options[j].isChecked = targetInput.checked;
                ctx.inputs[i].currentNum = ctx.inputs[i].options.reduce((acc, c) => c.isChecked ? acc + 1 : acc, 0);
                this.render(true);
                break;
            }
            case 'select-one': {
                if (ctx.inputs[i].isSelectAmount) {
                    ctx.inputs[i].options[j].currentAmount = Number(targetInput.value);
                    if (ctx.inputs[i].options[j]?.weight) ctx.inputs[i] = this.#currentMaxAmounts(ctx.inputs[i]);
                    this.render(true);
                }
                break;
            }
            case 'radio': {
                ctx.inputs[i].options.forEach(o => o.isChecked = false);
                ctx.inputs[i].options[j].isChecked = targetInput.checked;
                this.render(true);
                break;
            }
        }
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
        const counter = this.element?.querySelector('.cat-dialog-body .cat-budget-counter');
        const header = this.element?.querySelector('.cat-dialog-header');
        if (counter && header) header.insertBefore(counter, header.querySelector('.cat-dialog-detach'));
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
