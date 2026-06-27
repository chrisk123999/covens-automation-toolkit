import {constants} from '../lib/_module.mjs';
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
    #onSubmit;
    #attribute;
    #titleName;

    constructor({type, entry, onSubmit, titleName, ...options}) {
        super({...options});
        this.#type = type;
        this.#onSubmit = onSubmit;
        this.#titleName = titleName ?? '';
        this.#attribute = constants.alternateAttributes[type];
        this.#entry = entry ?? this.#attribute?.create();
        if (!this.#attribute) ui.notifications.error(_loc('CAT.MEDKIT.DocProps.NotDefined', {type}));
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
        return _loc('CAT.MEDKIT.DocProps.Title', {type: _loc(`CAT.MEDKIT.DocProps.Props.${this.#type}.Label`), name: this.#titleName});
    }

    #fetchChoices(choices, values = []) {
        let options = typeof choices === 'function' ? choices() : choices;
        if (typeof options === 'object') 
            return Object.entries(options).map(([value, label]) => ({value, label, selected: values.includes(value)}));
        else options.forEach(o => o.selected = values.includes(o.value));
        return options;
    }

    #prepBasicField(schema) {
        if (schema.hint) schema.hint = _loc(schema.hint);
        if (schema.label) schema.label = _loc(schema.label);
        return schema;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.title = this.title;
        context.type = this.#type;
        const e = this.#entry;
        const schema = this.#attribute.schema.fields;
        if (schema.value instanceof fields.ArrayField) {
            context.value = csv(e.value);
            context.valueHint = schema.value.element.hint;
            context.valueLabel = schema.value.element.label;
            const choices = schema.value.element.choices;
            if (choices) {
                context.valueChoices = this.#fetchChoices(choices, e.value);
            } else {
                context.valueField = this.#prepBasicField(schema.value.element);
            }
        } else {
            context.value = e.value ?? '';
            context.valueField = this.#prepBasicField(schema.value);
        }
        context.restrictions = schema.restrictions.entries().map(([key, restrictionSchema]) => {
            const {value, requireAll} = restrictionSchema.fields;
            const config = {
                key,
                hint: value.element.hint,
                label: value.element.label,
                hasRequireAll: !!requireAll,
                requireAll: foundry.utils.getProperty(e, requireAll?.fieldPath)
            };
            const data = foundry.utils.getProperty(e, value.fieldPath);
            if (value.element.choices) {
                config.options = this.#fetchChoices(value.element.choices, data);
            } else {
                config.value = csv(data);
                config.field = this.#prepBasicField(value.element);
            }
            return config;
        });
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
