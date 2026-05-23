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
        actions: {
            confirm: MenuApp.#confirm,
            close: MenuApp.#onCloseAction
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

    /** @this {MenuApp} */
    static async #onCloseAction() {
        this.element?.classList.add('closing');
        await new Promise(resolve => setTimeout(resolve, 200));
        await this.close({animate: false});
    }

    /** @this {MenuApp} */
    static async #formHandler(event, form, formData) {
        this.data = foundry.utils.expandObject(formData.object);
    }

    /** @this {MenuApp} */
    static async #confirm(event, target) {
        this.submit(target.name);
    }

    get title() {
        return this.windowTitle;
    }

    static #makeButton(label, name) {
        return {type: 'submit', action: 'confirm', label, name};
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
        }
    }

    #buildCheckbox(input) {
        return {
            useHelper: true,
            options: [{
                field: new BooleanField({label: input.label, hint: input.hint}),
                name: input.name,
                value: input.value ?? false
            }]
        };
    }

    #buildSelectOption(input) {
        return {
            useHelper: true,
            options: input.fields.map(f => {
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

    _onRender(context, options) {
        super._onRender(context, options);
        this.#enableDragging();
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