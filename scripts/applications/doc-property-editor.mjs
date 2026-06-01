import {uiUtils, genericUtils} from '../utilities/_module.mjs';
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {fields} = foundry.data;

const CHOICE_RESTRICTIONS = ['type', 'property', 'school', 'ability', 'damageTypes', 'level', 'method'];
const REQUIRE_ALL = ['property'];
const FREEFORM_RESTRICTIONS = ['identifier'];
const NUMERIC_RESTRICTIONS = ['level'];

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
                options: Object.entries(this.#choices[key] ?? {}).map(([value, label]) => ({value, label, selected: e.lists[key].map(String).includes(value)})),
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
        const data = genericUtils.expandObject(formData.object);
        const parseMulti = raw => { try { return raw ? JSON.parse(raw) : []; } catch { return []; } };
        let entry;
        if (this.#type === 'rollModifiers') {
            const modifiers = splitCsv(data.modifiers);
            if (!modifiers.length) return ui.notifications.error(_loc('CAT.MEDKIT.DocProps.rollModifiers.Invalid'));
            const restrictions = {};
            for (const key of CHOICE_RESTRICTIONS) {
                let values = parseMulti(data[key]);
                if (NUMERIC_RESTRICTIONS.includes(key)) values = values.map(Number).filter(n => !Number.isNaN(n));
                if (!values.length) continue;
                restrictions[key] = {value: values};
                if (REQUIRE_ALL.includes(key)) restrictions[key].requireAll = !!data.requireAll?.[key];
            }
            for (const key of FREEFORM_RESTRICTIONS) {
                const values = splitCsv(data[key]);
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

    async _preClose(options) {
        options.animate = false;
        await uiUtils.fadeOut(this.element);
    }

    bringToFront() {
        uiUtils.bringToFront(this);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        uiUtils.enableWindowDrag(this, '.cat-embedded-macros-header', {ignore: 'button, a, input, select, textarea, [data-action], cat-multi-combobox'});
        if (options.isFirstRender) {
            this.bringToFront();
            uiUtils.centerWindow(this, {width: 560, height: 480});
        }
    }
}
