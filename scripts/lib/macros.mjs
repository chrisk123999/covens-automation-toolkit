import {constants, Logging} from '../lib/_module.mjs';
import {documentUtils} from '../utilities/_module.mjs';
const fields = foundry.data.fields;
export class RegisteredMacros {
    #macrosSchema;
    #multiMacrosSchema;
    constructor() {
        this.fnMacros = new Map();
        this.overwriteMacros = new Map();
        const makeEventGroup = () => new fields.ArrayField(new fields.ObjectField(), {required: false, nullable: true});
        this.#macrosSchema = new fields.SchemaField({
            source: new fields.StringField({required: true, nullable: false}),
            rules: new RulesField({required: true}),
            identifier: new fields.StringField({required: true, nullable: false}),
            generic: new fields.BooleanField({required: false, nullable: false}),
            ...constants.triggerTypes().reduce((schema, trigger) => (schema[trigger] = makeEventGroup(), schema), {}),
            genericConfig: new fields.ObjectField({required: false, nullable: false}),
            documents: new fields.ArrayField(new fields.StringField({required: true, nullable: false}), {required: false})
        });
        this.#multiMacrosSchema = new fields.ArrayField(this.#macrosSchema);
    }
    #getMacroKey(source, identifier, rules) {
        return source + '|' + identifier + '|' + rules;
    }
    getFnMacros(source, rules, identifier, type, pass) {
        const key = this.#getMacroKey(source, identifier, rules);
        const fnMacro = this.overwriteMacros.get(key) ?? this.fnMacros.get(key);
        if (!fnMacro) return;
        if (!fnMacro.macros[type]?.length) return;
        const macros = fnMacro.macros[type].filter(i => i.pass === pass);
        if (!macros.length) return;
        return {
            source,
            rules,
            identifier,
            macros
        };
    }
    getAllMacros({genericOnly = false, documentType} = {}) {
        const uniqueMacros = new Map();
        this.fnMacros.forEach((macro, key) => uniqueMacros.set(key, macro));
        this.overwriteMacros.forEach((macro, key) => uniqueMacros.set(key, macro));
        const result = [];
        uniqueMacros.forEach(macro => {
            if (!!macro.generic === genericOnly) {
                if (documentType && !macro.documents?.includes(documentType)) return;
                result.push(macro);
            }
        });
        return result;
    }
    registerFnMacro(data, overwrite = false) {
        const cleaned = this.#macrosSchema.clean(data, {migrate: true, prune: false});
        const validationError = this.#macrosSchema.validate(cleaned);
        if (validationError) {
            Logging.addRegistrationError(cleaned, 'macro', validationError.asError());
            return false;
        }
        const fnMap = !overwrite ? this.fnMacros : this.overwriteMacros;
        const fnMacro = new FnMacro(cleaned.source, cleaned.identifier, cleaned.rules, cleaned);
        const key = this.#getMacroKey(cleaned.source, cleaned.identifier, cleaned.rules);
        fnMap.set(key, fnMacro);
        return fnMacro;
    }
    registerFnMacros(data = [], overwrite = false) {
        const validationError = this.#multiMacrosSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'macro', validationError.asError());
            return false;
        }
        return data.map(i => this.registerFnMacro(i, overwrite));
    }
    getGenericConfigValue(document, source, identifier, key) {
        const value = document.flags.cat?.genericConfig?.[source]?.[identifier]?.[key];
        if (value != undefined) return value;
        const rules = documentUtils.getRules(document);
        const macroKey = this.#getMacroKey(source, identifier, rules);
        const macro = this.overwriteMacros.get(macroKey) ?? this.fnMacros.get(macroKey);
        return macro?.genericConfig?.[key]?.default;
    }
}
class FnMacro {
    constructor(source, identifier, rules, {generic, genericConfig, documents, ...triggers} = {}) {
        this.source = source;
        this.identifier = identifier;
        this.rules = rules;
        this.generic = generic;
        this.genericConfig = genericConfig;
        this.documents = documents;
        this.macros = {};
        for (const [key, list] of Object.entries(triggers)) {
            if (!list?.length) continue;
            if (!constants.triggerTypes().has(key)) continue;
            this.macros[key] = list;
        }
    }
    get flagData() {
        const entry = {
            source: this.source,
            identifier: this.identifier,
            rules: this.rules
        };
        const flags = {};
        for (const [event, triggers] of Object.entries(this.macros)) {
            if (triggers && triggers.length > 0) {
                flags[event] = [entry];
            }
        }
        return flags;
    }
}
class RulesField extends fields.StringField {
    static get _defaults() {
        return Object.assign(super._defaults, {
            choices: constants.rules,
            validationError: 'is not a valid ruleset. Use one of: ' + Object.values(constants.rules).join(', ')
        });
    }
    _validateType(value, _options) {
        if (!this._isValidChoice(value)) throw new Error(value + ' ' + this.validationError);
    }
    _isValidChoice(value){
        return !!this.choices[value];
    }
    _migrate(value, _options, _state) {
        if (this._isValidChoice(value)) return value;
        switch(value) {
            case 'modern': return '2024';
            case 'legacy': return '2014';
            default: return 'all';
        }
    }
}
export default {
    RegisteredMacros
};