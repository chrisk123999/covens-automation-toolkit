import CatApp from './cat-app.mjs';
import {uiUtils, genericUtils, automationUtils} from '../utilities/_module.mjs';
import {constants} from '../lib/_module.mjs';
import {ddbi} from '../integration/_modules.mjs';
const {StringField, BooleanField, SetField} = foundry.data.fields;

export default class MenuApp extends CatApp {
    #context;
    #spellPacks = new Set();
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
        id: 'cat-menu-app',
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
        header: CatApp.HEADER_PART,
        body: {
            template: 'modules/cat/templates/menu/body.hbs',
            scrollable: ['']
        },
        footer: CatApp.FOOTER_PART
    };

    static #BUTTON_SETS = {
        yesNo: [['Yes', 'true'], ['No', 'false']],
        okCancel: [['Confirm', 'true'], ['Cancel', 'false']],
        ok: [['Confirm', 'true']],
        cancel: [['Cancel', 'false']]
    };

    get footerButtons() {
        return this.#context?.buttons ?? [];
    }

    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        if (!(this.buttons in MenuApp.#BUTTON_SETS)) delete parts.footer;
        return parts;
    }


    /** @this {MenuApp} */
    static async #formHandler(event, form, formData) {
        const data = genericUtils.expandObject(formData.object);
        form.querySelectorAll('.priority').forEach(widget => {
            const sourceSetting = widget.dataset.sourceSetting;
            if (!sourceSetting) return;
            const sources = {};
            widget.querySelectorAll('ul[data-list]').forEach(list => {
                const enabled = list.dataset.list === 'enabled';
                list.querySelectorAll('.row').forEach(row => {
                    const priority = Number(row.querySelector('.rank').value);
                    const id = row.dataset.sourceId;
                    sources[id] = {
                        enabled: enabled, 
                        priority: priority, 
                        pack: id.includes('.')
                    };
                });
            });
            data[sourceSetting] = sources;
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
        for (const [label, value] of MenuApp.#BUTTON_SETS[this.buttons] ?? []) context.buttons.push(MenuApp.#makeButton(label, value));
        context.tabbed = context.inputs.length > 1 && context.inputs.every(input => input.isPriority);
        this.#context = context;
    }

    #buildInput(input) {
        switch (input.type) {
            case 'checkbox': return this.#buildCheckbox(input);
            case 'selectOption': return this.#buildSelectOption(input);
            case 'priority': return this.#buildPriority(input);
            case 'users': return this.#buildUsers(input);
        }
    }

    #buildUsers(input) {
        const choices = game.users.reduce((acc, user) => { acc[user.id] = user.name; return acc; }, {});
        return {
            useHelper: true,
            options: [{
                field: new SetField(new StringField({choices, blank: false}), {label: _loc(input.label), hint: _loc(input.hint)}),
                name: input.name,
                value: input.value ?? []
            }]
        };
    }

    #buildPackPriority(input) {
        const sources = input.value ?? {};
        const packTag = _loc('CAT.Settings.AutomationSources.PackTag');
        const rows = [];
        for (const pack of game.packs) {
            if (pack.metadata.type !== input.packType) continue;
            if (input.packFilter === 'spells' && !this.#spellPacks.has(pack.metadata.id)) continue;
            if (input.packFilter === 'items' && this.#spellPacks.has(pack.metadata.id)) continue;
            const cfg = sources[pack.metadata.id] ?? {};
            rows.push({
                id: pack.metadata.id,
                kind: 'pack',
                kindLabel: packTag,
                name: pack.metadata.label,
                enabled: cfg.enabled ?? false,
                priority: cfg.priority ?? 50
            });
        }
        rows.sort((a, b) => a.priority - b.priority);
        return {
            isPriority: true,
            name: input.name,
            label: _loc(input.label),
            hint: _loc(input.hint),
            enabledRows: rows.filter(r => r.enabled),
            disabledRows: rows.filter(r => !r.enabled)
        };
    }

    #buildPriority(input) {
        if (input.packType) return this.#buildPackPriority(input);
        const sources = input.value ?? {};
        const registered = new Set(Object.keys(constants.automations?.sourceNames ?? {}));
        const owned = new Set(ddbi.getCompendiumIds());
        const sourceTag = _loc('CAT.Settings.AutomationSources.SourceTag');
        const packTag = _loc('CAT.Settings.AutomationSources.PackTag');
        const rows = [];
        const sourceIds = new Set([...Object.keys(sources), ...registered]);
        for (const id of sourceIds) {
            const cfg = sources[id] ?? {};
            const isPack = id.includes('.');
            if (isPack) {
                const pack = game.packs.get(id);
                if (!pack || sourceIds.has(pack.metadata.packageName)) continue;
            }
            rows.push({
                id, 
                kind: isPack ? 'pack' : 'source', 
                kindLabel: isPack ? packTag : sourceTag, 
                name: automationUtils.getSourceName(id), 
                enabled: cfg.enabled ?? false, 
                priority: cfg.priority ?? 50
            });
        }
        for (const pack of game.packs) {
            const id = pack.metadata.id;
            if (pack.metadata.type !== 'Item' || sourceIds.has(pack.metadata.packageName) || owned.has(id) || sourceIds.has(id)) continue;
            rows.push({
                id, 
                kind: 'pack', 
                kindLabel: packTag, 
                name: pack.metadata.label, 
                enabled: false, 
                priority: 50
            });
        }
        rows.sort((a, b) => a.priority - b.priority);
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

    async _prepareContext(options) {
        if (!this.#context) {
            if (this.inputs?.some(input => input.packFilter)) await this.#loadSpellPacks();
            this.#formatInputs();
        }
        const context = await super._prepareContext(options);
        return {...this.#context, ...context};
    }

    async #loadSpellPacks() {
        this.#spellPacks = new Set();
        for (const pack of game.packs) {
            if (pack.metadata.type !== 'Item') continue;
            const index = await pack.getIndex({fields: ['type']});
            const spells = index.contents.filter(entry => entry.type === 'spell').length;
            if (spells * 2 > index.size) this.#spellPacks.add(pack.metadata.id);
        }
    }

    bringToFront() {
        uiUtils.bringToFront(this);
    }

    #wireTabs() {
        const nav = this.element?.querySelector('nav');
        if (!nav || nav.dataset.wired === '1') return;
        nav.dataset.wired = '1';
        nav.addEventListener('click', event => {
            const tab = event.target.closest('.tab-link');
            if (!tab) return;
            const name = tab.dataset.tab;
            nav.querySelectorAll('.tab-link').forEach(t => t.classList.toggle('active', t === tab));
            this.element.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.tabPanel === name));
            this.setPosition({width: 'auto', height: 'auto'});
        });
    }

    #wirePriority() {
        this.element?.querySelectorAll('.priority').forEach(widget => this.#wirePriorityWidget(widget));
    }

    #wirePriorityWidget(widget) {
        if (!widget || widget.dataset.wired === '1') return;
        widget.dataset.wired = '1';
        const enabledList = widget.querySelector('ul[data-list="enabled"]');
        const disabledList = widget.querySelector('ul[data-list="disabled"]');
        let dragRow = null;
        enabledList.addEventListener('dragstart', event => {
            if (event.target.closest('input, button')) {
                event.preventDefault();
                return;
            }
            dragRow = event.target.closest('.row');
            dragRow?.classList.add('dragging');
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', dragRow?.dataset.sourceId ?? '');
            }
        });
        enabledList.addEventListener('keydown', event => {
            if (event.key === 'Enter' && event.target.classList.contains('rank')) {
                event.preventDefault();
                MenuApp.#sortByRank(enabledList);
            }
        });
        const clearMarkers = () => {
            enabledList.querySelectorAll('.drop-before').forEach(el => el.classList.remove('drop-before'));
            enabledList.classList.remove('drop-end');
        };
        enabledList.addEventListener('dragend', () => {
            dragRow?.classList.remove('dragging');
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
            if (after) after.classList.add('drop-before');
            else enabledList.classList.add('drop-end');
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
            if (event.target.classList.contains('rank')) MenuApp.#sortByRank(enabledList);
        });
        widget.addEventListener('click', event => {
            const button = event.target.closest('[data-priority-action]');
            if (!button) return;
            MenuApp.#toggleRow(widget, button.closest('.row'), button.dataset.priorityAction === 'enable', enabledList, disabledList);
            this.setPosition({height: 'auto'});
        });
        widget.querySelector('details')?.addEventListener('toggle', () => {
            this.setPosition({height: 'auto'});
        });
    }

    static #toggleRow(widget, row, enable, enabledList, disabledList) {
        const rank = row.querySelector('.rank');
        const button = row.querySelector('[data-priority-action]');
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
        const count = disabledList.querySelectorAll('.row').length;
        const counter = widget.querySelector('.disabled-count');
        if (counter) counter.textContent = String(count);
    }


    static #reposition(row) {
        const rankOf = el => Number(el.querySelector('.rank').value);
        const setRank = (el, v) => { el.querySelector('.rank').value = String(v); };
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
        [...list.querySelectorAll('.row')]
            .sort((a, b) => Number(a.querySelector('.rank').value) - Number(b.querySelector('.rank').value))
            .forEach(row => list.appendChild(row));
    }

    static #dragAfterElement(list, y) {
        const rows = [...list.querySelectorAll('.row:not(.dragging)')];
        return rows.reduce((closest, row) => {
            const box = row.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            return (offset < 0 && offset > closest.offset) ? {offset, element: row} : closest;
        }, {offset: Number.NEGATIVE_INFINITY, element: null}).element;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.#wireTabs();
        this.#wirePriority();
        if (options.isFirstRender) {
            this.element.addEventListener('cat-resize', () => {
                this.setPosition({width: 'auto', height: 'auto'});
            });
        }
    }
}