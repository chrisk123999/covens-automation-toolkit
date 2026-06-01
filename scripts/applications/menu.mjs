import {uiUtils} from '../utilities/_module.mjs';
import {constants} from '../lib/_module.mjs';
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {StringField, BooleanField} = foundry.data.fields;

//TODO: make compendium selector, make dialog/menu css share shared css

export default class MenuApp extends HandlebarsApplicationMixin(ApplicationV2) {
    #context;
    constructor(options) {
        let title, inputs, buttons, config;
        if (options?.length) [title, inputs, buttons, config] = options;
        const init = config?.id ? {id: config.id} : {id: `cat-menu-${title}`};
        if (config?.width != null || config?.height != null) {
            init.position = {};
            if (config.width != null) init.position.width = config.width;
            if (config.height != null) init.position.height = config.height;
        }
        super(init);
        if (!options?.length) return;
        this.windowTitle = _loc(title);
        this.inputs = inputs;
        this.buttons = buttons;
    }

    static DEFAULT_OPTIONS = {
        id: 'cat-dialog-app',
        classes: ['cat', 'cat-dialog'],
        tag: 'form',
        form: {
            handler: MenuApp.#formHandler,
            submitOnChange: false,
            closeOnSubmit: true
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
            template: 'modules/cat/templates/menu.hbs',
            scrollable: ['']
        }
    };

    async _preClose(options) {
        options.animate = false;
        await uiUtils.fadeOut(this.element);
    }

    /** @this {MenuApp} */
    static async #formHandler(event, form, formData) {
        const data = foundry.utils.expandObject(formData.object);
        form.querySelectorAll('.cat-priority-list').forEach(list => {
            const setting = list.dataset.prioritySetting;
            if (!setting) return;
            const sources = {};
            list.querySelectorAll('.cat-priority-row').forEach(row => {
                sources[row.dataset.sourceId] = {
                    enabled: row.querySelector('.cat-priority-enabled').checked,
                    priority: Number(row.querySelector('.cat-priority-rank').value)
                };
            });
            data[setting] = sources;
        });
        this.data = data;
        this.submit(event.submitter?.name);
    }

    get title() {
        return this.windowTitle;
    }

    static #makeButton(label, name) {
        return {type: 'submit', label, name};
    }

    // Convert each declarative input tuple into template-ready entry.
    #formatInputs() {
        const context = {inputs: [], buttons: []};
        for (const input of this.inputs) {
            const entry = this.#buildInput(input);
            if (entry) context.inputs.push(entry);
        }
        switch (this.buttons) {
            case 'yesNo':
                context.buttons.push(MenuApp.#makeButton('Yes', 'true'), MenuApp.#makeButton('No', 'false'));
                break;
            case 'okCancel':
                context.buttons.push(MenuApp.#makeButton('Confirm', 'true'), MenuApp.#makeButton('Cancel', 'false'));
                break;
            case 'ok':
                context.buttons.push(MenuApp.#makeButton('Confirm', 'true'));
                break;
            case 'cancel':
                context.buttons.push(MenuApp.#makeButton('Cancel', 'false'));
                break;
        }
        this.#context = context;
    }

    #buildInput(input) {
        switch (input.type) {
            case 'checkbox': return this.#buildCheckbox(input);
            case 'selectOption': return this.#buildSelectOption(input);
            case 'compendium': return this.#buildCompendium(input);
            case 'priority': return this.#buildPriority(input);
        }
    }

    #buildPriority(input) {
        const stored = input.value ?? {};
        const ids = new Set([...Object.keys(stored), ...(constants.automations?.sources ?? [])]);
        const rows = [...ids].map(id => {
            const cfg = stored[id] ?? {};
            const name = constants.automations?.sourceNames?.[id]
                ?? game.modules.get(id)?.title
                ?? (game.system?.id === id ? game.system.title : null)
                ?? id;
            return {
                id,
                name,
                enabled: cfg.enabled ?? true,
                priority: cfg.priority ?? 50 // CPR defaults non-curated sources to 50.
            };
        }).sort((a, b) => a.priority - b.priority);
        return {isPriority: true, name: input.name, hint: _loc(input.hint), rows};
    }

    #buildCheckbox(input) {
        return {
            useHelper: true,
            options: [{
                field: new BooleanField({label: _loc(input.label), hint: _loc(input.hint)}),
                name: input.name,
                value: input.value ?? false
            }]
        };
    }

    #buildSelectOption(input) {
        const choices = Object.entries(input.options ?? {}).reduce((acc, [value, label]) => {
            acc[value] = _loc(label);
            return acc;
        }, {});
        return {
            useHelper: true,
            options: [{
                field: new StringField({label: _loc(input.label), hint: _loc(input.hint), choices, required: true, blank: false}),
                name: input.name,
                value: input.value ?? ''
            }]
        };
    }

    #buildCompendium(input) { // Have to decide how to do the compendium selection
        return {
            isCompendium: true
        };
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        if (!this.#context) this.#formatInputs();
        return {...context, ...this.#context, title: this.windowTitle};
    }

    #enableDragging() {
        const handle = this.element?.querySelector('.cat-dialog-header');
        if (!handle || handle.dataset.dragWired === '1') return;
        handle.dataset.dragWired = '1';
        const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, handle, false);
        const orig = drag._onDragMouseDown.bind(drag);
        drag._onDragMouseDown = (event) => {
            if (event.target.closest('button, a, input, select, [data-action]')) return;
            orig(event);
        };
    }

    bringToFront() {
        if (!this.element) return;
        this.position.zIndex = ++ApplicationV2._maxZ;
        this.element.style.zIndex = String(this.position.zIndex);
        ui.activeWindow = this;
    }

    #wirePriorityDrag() {
        const list = this.element?.querySelector('.cat-priority-list');
        if (!list || list.dataset.dragWired === '1') return;
        list.dataset.dragWired = '1';
        let dragRow = null;
        list.addEventListener('dragstart', event => {
            dragRow = event.target.closest('.cat-priority-row');
            dragRow?.classList.add('cat-priority-dragging');
        });
        list.addEventListener('dragend', () => {
            dragRow?.classList.remove('cat-priority-dragging');
            dragRow = null;
            list.querySelectorAll('.cat-priority-rank').forEach((input, i) => { input.value = String(i); });
        });
        list.addEventListener('dragover', event => {
            event.preventDefault();
            if (!dragRow) return;
            const after = MenuApp.#dragAfterElement(list, event.clientY);
            if (after) list.insertBefore(dragRow, after);
            else list.appendChild(dragRow);
        });
    }

    static #dragAfterElement(list, y) {
        const rows = [...list.querySelectorAll('.cat-priority-row:not(.cat-priority-dragging)')];
        return rows.reduce((closest, row) => {
            const box = row.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            return (offset < 0 && offset > closest.offset) ? {offset, element: row} : closest;
        }, {offset: Number.NEGATIVE_INFINITY, element: null}).element;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.#enableDragging();
        this.#wirePriorityDrag();
        const counter = this.element?.querySelector('.cat-dialog-body .cat-budget-counter');
        const header = this.element?.querySelector('.cat-dialog-header');
        if (counter && header) header.insertBefore(counter, header.querySelector('.cat-dialog-detach'));
        if (options.isFirstRender) {
            this.bringToFront();
            const win = this.element.ownerDocument.defaultView ?? window;
            const w = this.element.offsetWidth || 400;
            const h = this.element.offsetHeight || 300;
            this.setPosition({left: (win.innerWidth - w) / 2, top: (win.innerHeight - h) / 2});
            this.element.addEventListener('cat-resize', () => {
                this.setPosition({width: 'auto', height: 'auto'});
            });
        }
    }
}