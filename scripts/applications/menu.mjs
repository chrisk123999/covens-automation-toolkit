import {uiUtils, genericUtils} from '../utilities/_module.mjs';
import {constants} from '../lib/_module.mjs';
import {ddbi} from '../integration/_modules.mjs';
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {StringField, BooleanField} = foundry.data.fields;

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
        const data = genericUtils.expandObject(formData.object);
        form.querySelectorAll('.cat-settings-priority').forEach(widget => {
            const setting = widget.dataset.prioritySetting;
            if (!setting) return;
            const sources = {};
            widget.querySelectorAll('.cat-priority-list').forEach(list => {
                const enabled = list.dataset.list === 'enabled';
                list.querySelectorAll('.cat-priority-row').forEach(row => {
                    sources[row.dataset.sourceId] = {enabled, priority: Number(row.querySelector('.cat-priority-rank').value), pack: row.dataset.pack === 'true'};
                });
            });
            data[setting] = sources;
        });
        form.querySelectorAll('.cat-settings-compendiums').forEach(widget => {
            const setting = widget.dataset.compendiumSetting;
            if (!setting) return;
            const packs = {};
            widget.querySelectorAll('.cat-compendium-row').forEach(row => {
                if (row.querySelector('.cat-compendium-checked').checked) packs[row.dataset.packId] = Number(row.querySelector('.cat-compendium-priority').value);
            });
            data[setting] = packs;
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
            return {id, name, enabled: cfg.enabled ?? true, priority: cfg.priority ?? 50, pack: cfg.pack ?? false};
        }).sort((a, b) => a.priority - b.priority);
        return {
            isPriority: true,
            name: input.name,
            hint: _loc(input.hint),
            enabledRows: rows.filter(r => r.enabled),
            disabledRows: rows.filter(r => !r.enabled)
        };
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

    #buildCompendium(input) {
        const stored = input.value ?? {};
        const registered = new Set(constants.automations?.sources ?? []);
        const configured = new Set(Object.keys(game.settings.get('cat', 'automationSources') ?? {}));
        const owned = new Set(ddbi.getCompendiumIds());
        const rows = game.packs
            .filter(pack => pack.metadata.type === 'Item'
                && !registered.has(pack.metadata.packageName)
                && !configured.has(pack.metadata.id)
                && !owned.has(pack.metadata.id))
            .map(pack => ({
                id: pack.metadata.id,
                label: pack.metadata.label,
                checked: pack.metadata.id in stored,
                priority: stored[pack.metadata.id] ?? 50
            }))
            .sort((a, b) => {
                if (a.checked !== b.checked) return a.checked ? -1 : 1;
                return (a.priority - b.priority) || a.label.localeCompare(b.label);
            });
        return {isCompendium: true, name: input.name, hint: _loc(input.hint), rows};
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        if (!this.#context) this.#formatInputs();
        return {...context, ...this.#context, title: this.windowTitle};
    }

    bringToFront() {
        uiUtils.bringToFront(this);
    }

    #wirePriority() {
        const widget = this.element?.querySelector('.cat-settings-priority');
        if (!widget || widget.dataset.wired === '1') return;
        widget.dataset.wired = '1';
        const enabledList = widget.querySelector('.cat-priority-list[data-list="enabled"]');
        const disabledList = widget.querySelector('.cat-priority-list[data-list="disabled"]');
        let dragRow = null;
        enabledList.addEventListener('dragstart', event => {
            if (event.target.closest('input, button')) {
                event.preventDefault();
                return;
            }
            dragRow = event.target.closest('.cat-priority-row');
            dragRow?.classList.add('cat-priority-dragging');
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', dragRow?.dataset.sourceId ?? '');
            }
        });
        enabledList.addEventListener('keydown', event => {
            if (event.key === 'Enter' && event.target.classList.contains('cat-priority-rank')) {
                event.preventDefault();
                MenuApp.#sortByRank(enabledList);
            }
        });
        const clearMarkers = () => {
            enabledList.querySelectorAll('.cat-priority-drop-before').forEach(el => el.classList.remove('cat-priority-drop-before'));
            enabledList.classList.remove('cat-priority-drop-end');
        };
        enabledList.addEventListener('dragend', () => {
            dragRow?.classList.remove('cat-priority-dragging');
            dragRow = null;
            clearMarkers();
        });
        enabledList.addEventListener('dragenter', event => event.preventDefault());
        enabledList.addEventListener('dragover', event => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
            if (!dragRow) return;
            const after = MenuApp.#dragAfterElement(enabledList, event.clientY);
            clearMarkers();
            if (after) after.classList.add('cat-priority-drop-before');
            else enabledList.classList.add('cat-priority-drop-end');
        });
        enabledList.addEventListener('drop', event => {
            event.preventDefault();
            if (!dragRow) return;
            const after = MenuApp.#dragAfterElement(enabledList, event.clientY);
            clearMarkers();
            if (after) enabledList.insertBefore(dragRow, after);
            else enabledList.appendChild(dragRow);
            MenuApp.#reposition(dragRow);
        });
        enabledList.addEventListener('change', event => {
            if (event.target.classList.contains('cat-priority-rank')) MenuApp.#sortByRank(enabledList);
        });
        widget.addEventListener('click', event => {
            const button = event.target.closest('[data-priority-action]');
            if (!button) return;
            MenuApp.#toggleRow(widget, button.closest('.cat-priority-row'), button.dataset.priorityAction === 'enable', enabledList, disabledList);
            this.setPosition({height: 'auto'});
        });
        widget.querySelector('.cat-priority-disabled-section')?.addEventListener('toggle', () => {
            this.setPosition({height: 'auto'});
        });
    }

    static #toggleRow(widget, row, enable, enabledList, disabledList) {
        const rank = row.querySelector('.cat-priority-rank');
        const button = row.querySelector('.cat-priority-toggle');
        const icon = button.querySelector('i');
        if (enable) {
            row.setAttribute('draggable', 'true');
            rank.hidden = false;
            button.dataset.priorityAction = 'disable';
            button.dataset.tooltip = _loc('CAT.Settings.AutomationSources.Disable');
            icon.className = 'fas fa-xmark';
            enabledList.appendChild(row);
            MenuApp.#reposition(row);
        } else {
            row.removeAttribute('draggable');
            rank.hidden = true;
            button.dataset.priorityAction = 'enable';
            button.dataset.tooltip = _loc('CAT.Settings.AutomationSources.Enable');
            icon.className = 'fas fa-plus';
            disabledList.appendChild(row);
        }
        const count = disabledList.querySelectorAll('.cat-priority-row').length;
        const counter = widget.querySelector('.cat-priority-disabled-count');
        if (counter) counter.textContent = String(count);
    }

    #wireCompendium() {
        const widget = this.element?.querySelector('.cat-settings-compendiums');
        if (!widget || widget.dataset.wired === '1') return;
        widget.dataset.wired = '1';
        widget.addEventListener('change', event => {
            if (!event.target.classList.contains('cat-compendium-checked')) return;
            event.target.closest('.cat-compendium-row').querySelector('.cat-compendium-priority').disabled = !event.target.checked;
        });
    }

    static #reposition(row) {
        const rankOf = el => Number(el.querySelector('.cat-priority-rank').value);
        const setRank = (el, v) => { el.querySelector('.cat-priority-rank').value = String(v); };
        const prev = row.previousElementSibling;
        const next = row.nextElementSibling;
        const prevVal = prev ? rankOf(prev) : null;
        const nextVal = next ? rankOf(next) : null;
        let value;
        if (prevVal === null && nextVal === null) value = 10;
        else if (prevVal === null) value = nextVal - 10;
        else if (nextVal === null) value = prevVal + 10;
        else if (nextVal - prevVal >= 2) value = Math.floor((prevVal + nextVal) / 2);
        else value = nextVal;
        setRank(row, value);
        let cursor = row;
        let last = value;
        while ((cursor = cursor.nextElementSibling)) {
            if (rankOf(cursor) > last) break;
            setRank(cursor, ++last);
        }
    }

    static #sortByRank(list) {
        [...list.querySelectorAll('.cat-priority-row')]
            .sort((a, b) => Number(a.querySelector('.cat-priority-rank').value) - Number(b.querySelector('.cat-priority-rank').value))
            .forEach(row => list.appendChild(row));
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
        uiUtils.enableWindowDrag(this, '.cat-dialog-header');
        this.#wirePriority();
        this.#wireCompendium();
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
    }
}