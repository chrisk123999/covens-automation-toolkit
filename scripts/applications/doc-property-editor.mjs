import {uiUtils} from '../utilities/_module.mjs';
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {fields} = foundry.data;

// Restriction categories rendered as fixed-choice multi-selects (the rest are free-form text).
const CHOICE_RESTRICTIONS = ['type', 'property', 'school', 'ability', 'damageTypes'];
// Restrictions that also expose a requireAll toggle (identifier/level/method are OR-only or free-form).
const REQUIRE_ALL = ['type', 'property', 'school', 'ability', 'method', 'damageTypes'];
const FREEFORM_RESTRICTIONS = ['identifier', 'level', 'method'];

const csv = arr => (Array.isArray(arr) ? arr : []).join(', ');
const splitCsv = raw => String(raw ?? '').split(',').map(s => s.trim()).filter(Boolean);

// Popup editor for a single document-property entry.
export default class DocPropertyEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
    #type;
    #entry;
    #choices;
    #onSubmit;
    #titleName;

    constructor({type, entry, choices, onSubmit, titleName, ...options}) {
        super({...options});
        this.#type = type;
        this.#choices = choices ?? {};
        this.#onSubmit = onSubmit;
        this.#titleName = titleName ?? '';
        this.#entry = this.#hydrate(entry);
    }

    // Normalize an incoming entry (or a blank one) into the flat working shape the form edits.
    #hydrate(entry) {
        const e = entry ?? {};
        if (this.#type === 'rollModifiers') {
            const r = e.restrictions ?? {};
            const lists = {};
            const requireAll = {};
            for (const key of [...CHOICE_RESTRICTIONS, ...FREEFORM_RESTRICTIONS]) lists[key] = [...(r[key]?.value ?? [])];
            for (const key of REQUIRE_ALL) requireAll[key] = !!r[key]?.requireAll;
            return {modifiers: [...(e.modifiers ?? [])], lists, requireAll};
        }
        if (this.#type === 'alternateFormula') return {value: e.value ?? '', identifiers: [...(e.identifiers ?? [])]};
        return {identifier: e.identifier ?? '', value: [...(e.value ?? [])]}; // alternateAbilities
    }

    static DEFAULT_OPTIONS = {
        id: 'cat-doc-property-editor',
        classes: ['cat', 'cat-embedded-macros'],
        tag: 'form',
        window: {frame: false, positioned: true},
        position: {width: 560, height: 'auto'},
        form: {handler: DocPropertyEditorApp.#onFormSubmit, submitOnChange: false, closeOnSubmit: false}
    };

    static PARTS = {
        body: {template: 'modules/cat/templates/doc-property-editor.hbs', scrollable: ['.cat-embedded-macros-body']}
    };

    get title() {
        return _loc(`CAT.MEDKIT.DocProps.${this.#type}.Title`, {name: this.#titleName});
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.title = this.title;
        context.type = this.#type;
        const e = this.#entry;
        if (this.#type === 'rollModifiers') {
            context.modifiers = csv(e.modifiers);
            context.choiceRestrictions = CHOICE_RESTRICTIONS.map(key => ({
                key,
                label: _loc(`CAT.MEDKIT.DocProps.Restrictions.${key}`),
                options: Object.entries(this.#choices[key] ?? {}).map(([value, label]) => ({value, label, selected: e.lists[key].includes(value)})),
                requireAll: e.requireAll[key],
                hasRequireAll: REQUIRE_ALL.includes(key)
            }));
            context.freeformRestrictions = FREEFORM_RESTRICTIONS.map(key => ({
                key,
                label: _loc(`CAT.MEDKIT.DocProps.Restrictions.${key}`),
                value: csv(e.lists[key])
            }));
        } else if (this.#type === 'alternateFormula') {
            context.formulaField = new fields.StringField({label: _loc('CAT.MEDKIT.DocProps.alternateFormula.Field')});
            context.formula = e.value;
            context.identifiers = csv(e.identifiers);
        } else {
            context.identifierField = new fields.StringField({label: _loc('CAT.MEDKIT.DocProps.Identifier')});
            context.identifier = e.identifier;
            context.abilityOptions = Object.entries(this.#choices.ability ?? {}).map(([value, label]) => ({value, label, selected: e.value.includes(value)}));
        }
        return context;
    }

    /** @this {DocPropertyEditorApp} */
    static #onFormSubmit(_event, _form, formData) {
        const data = foundry.utils.expandObject(formData.object);
        const parseMulti = raw => { try { return raw ? JSON.parse(raw) : []; } catch { return []; } };
        let entry;
        if (this.#type === 'rollModifiers') {
            const modifiers = splitCsv(data.modifiers);
            if (!modifiers.length) return ui.notifications.error(_loc('CAT.MEDKIT.DocProps.rollModifiers.Invalid'));
            const restrictions = {};
            for (const key of CHOICE_RESTRICTIONS) {
                const values = parseMulti(data[key]);
                if (values.length) restrictions[key] = {value: values, requireAll: !!data.requireAll?.[key]};
            }
            for (const key of FREEFORM_RESTRICTIONS) {
                let values = splitCsv(data[key]);
                if (key === 'level') values = values.map(Number).filter(n => !Number.isNaN(n));
                if (values.length) restrictions[key] = {value: values};
            }
            entry = {modifiers, restrictions};
        } else if (this.#type === 'alternateFormula') {
            const value = String(data.value ?? '').trim();
            const identifiers = splitCsv(data.identifiers);
            if (!value) return ui.notifications.error(_loc('CAT.MEDKIT.DocProps.InvalidValue'));
            if (!identifiers.length) return ui.notifications.error(_loc('CAT.MEDKIT.DocProps.InvalidIdentifier'));
            entry = {value, identifiers};
        } else {
            const identifier = String(data.identifier ?? '').trim();
            if (!identifier) return ui.notifications.error(_loc('CAT.MEDKIT.DocProps.InvalidIdentifier'));
            const value = parseMulti(data.value);
            if (!value.length) return ui.notifications.error(_loc('CAT.MEDKIT.DocProps.InvalidValue'));
            entry = {identifier, value};
        }
        if (this.#onSubmit?.(entry) !== false) this.close();
    }

    #enableDragging() {
        const handle = this.element?.querySelector('.cat-embedded-macros-header');
        if (!handle || handle.dataset.dragWired === '1') return;
        handle.dataset.dragWired = '1';
        const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, handle, false);
        const orig = drag._onDragMouseDown.bind(drag);
        drag._onDragMouseDown = (event) => {
            if (event.target.closest('button, a, input, select, textarea, [data-action], cat-multi-combobox')) return;
            orig(event);
        };
    }

    async _preClose(options) {
        options.animate = false;
        await uiUtils.fadeOut(this.element);
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
        if (options.isFirstRender) {
            this.bringToFront();
            const win = this.element.ownerDocument.defaultView ?? window;
            const w = this.element.offsetWidth || 560;
            const h = this.element.offsetHeight || 480;
            this.setPosition({left: (win.innerWidth - w) / 2, top: (win.innerHeight - h) / 2});
        }
    }
}
