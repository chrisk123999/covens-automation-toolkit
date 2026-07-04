import {constants} from '../lib/_module.mjs';
import {uiUtils, genericUtils} from '../utilities/_module.mjs';
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {fields} = foundry.data;

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
        this.#entry = entry ?? this.#attribute?.validate().cleaned;
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

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.title = this.title;
        context.type = this.#type;
        const e = this.#entry;
        const schema = this.#attribute.schema.fields;
        context.valueHint = _loc(`CAT.MEDKIT.DocProps.Props.${this.#attribute.type}.Hint`);
        context.valueLabel = _loc(`CAT.MEDKIT.DocProps.Props.${this.#attribute.type}.Field`);
        context.valuePath = schema.value.fieldPath;
        if (schema.value instanceof fields.ArrayField) {
            context.value = csv(e.value);
            const choices = schema.value.element.choices;
            if (choices) context.valueChoices = this.#fetchChoices(choices, e.value);
            else context.valueField = schema.value.element;
        } else {
            context.value = e.value ?? '';
            context.valueField = schema.value;
        }
        context.restrictions = schema.restrictions.entries().map(([key, restrictionSchema]) => {
            const {value, requireAll, invert} = restrictionSchema.fields;
            const inverted = foundry.utils.getProperty(e, invert?.fieldPath);
            const config = {
                key,
                hint: _loc(`CAT.MEDKIT.DocProps.Restrictions.${key}.${inverted ? 'Inverted' : ''}Hint`),
                label: _loc(`CAT.MEDKIT.DocProps.Restrictions.${key}.Label`),
                valuePath: value.fieldPath,
                requireAllPath: requireAll?.fieldPath,
                requireAll: foundry.utils.getProperty(e, requireAll?.fieldPath),
                requireAllLabel: _loc(`CAT.MEDKIT.DocProps.Restrictions.${inverted ? 'ExcludeAll' : 'RequireAll'}`),
                invertPath: invert?.fieldPath,
                invert: inverted
            };
            const data = foundry.utils.getProperty(e, value.fieldPath);
            if (value.element.choices) {
                config.options = this.#fetchChoices(value.element.choices, data);
            } else {
                config.value = csv(data);
                config.field = value.element;
            }
            return config;
        });
        return context;
    }

    _onChangeForm(formConfig, event) {
        super._onChangeForm(formConfig, event);
        const invert = event.target?.closest?.('.cat-docprop-invert');
        if (!invert) return;
        const restrictionType = this.#attribute.schema.getField(invert.name)?.parent.name;
        if (!restrictionType) return;
        const hint = this.element.querySelector(`#cat-docprop-hint-${restrictionType}`);
        const label = this.element.querySelector(`#cat-docprop-requireAllLabel-${restrictionType}`);
        if (hint) hint.innerHTML = _loc(`CAT.MEDKIT.DocProps.Restrictions.${restrictionType}.${invert.checked ? 'Inverted' : ''}Hint`);
        if (label) label.innerHTML = _loc(`CAT.MEDKIT.DocProps.Restrictions.${invert.checked ? 'ExcludeAll' : 'RequireAll'}`);
    }

    /** @this {DocPropertyEditorApp} */
    static #onFormSubmit(_event, _form, formData) {
        const parseArray = (field, path, parser) => {
            const data = parser(formData.object[path]);
            if (data?.length) formData.object[path] = data;
            else {
                if (!field.parent.fieldPath)
                    return delete formData.object[path];
                for (const property of Object.values(field.parent.fields))
                    delete formData.object[property.fieldPath];
            }
        };

        const schema = this.#attribute.schema;
        for (const path of Object.keys(formData.object)) {
            const field = schema.getField(path);
            if (!(field instanceof fields.ArrayField)) continue;
            if (field.element.choices) parseArray(field, path, JSON.parse);
            else parseArray(field, path, splitCsv);
        }
        const entry = genericUtils.expandObject(formData.object);
        if (!entry.value?.length) return ui.notifications.error(_loc('CAT.MEDKIT.DocProps.InvalidValue'));
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
