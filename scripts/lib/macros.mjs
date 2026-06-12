import {Logging} from '../lib/_module.mjs';
import {documentUtils} from '../utilities/_module.mjs';
const fields = foundry.data.fields;
export class RegisteredMacros {
    #macrosSchema;
    #multiMacrosSchema;
    constructor() {
        this.fnMacros = [];
        this.overwriteMacros = [];
        this.#macrosSchema = new fields.SchemaField({
            source: new fields.StringField({required: true, nullable: false}),
            rules: new fields.StringField({required: true, nullable: false}),
            identifier: new fields.StringField({required: true, nullable: false}),
            generic: new fields.BooleanField({required: false, nullable: false}),
            aura: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            check: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            combat: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            effect: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            move: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            region: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            rest: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            save: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            skill: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            time: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            tool: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            roll: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            summon: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            genericConfig: new fields.ObjectField({required: false, nullable: false}),
            documents: new fields.ArrayField(new fields.StringField({required: true, nullable: false}), {required: false})
        });
        this.#multiMacrosSchema = new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}));
    }
    getFnMacros(source, rules, identifier, type, pass) {
        const predicate = macro => macro.source === source && macro.identifier === identifier && (macro.rules === rules || macro.rules === 'all');
        let fnMacro = this.overwriteMacros.find(predicate) ?? this.fnMacros.find(predicate);
        if (!fnMacro) return;
        if (!fnMacro.macros[type].length) return;
        let macros = fnMacro.macros[type].filter(i => i.pass === pass);
        if (!macros.length) return;
        return {
            source,
            rules,
            identifier,
            macros
        };
    }
    getAllMacros({genericOnly = false} = {}) {
        const allMacros = [...this.fnMacros, ...this.overwriteMacros];
        const uniqueMacros = new Map();
        allMacros.forEach(macro => {
            if (!!macro.generic === genericOnly) {
                const compositeKey = macro.source + '|' + macro.identifier + '|' + macro.rules;
                uniqueMacros.set(compositeKey, macro);
            }
        });
        return Array.from(uniqueMacros.values());
    }
    registerFnMacro(data, overwrite = false) {
        const validationError = this.#macrosSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, validationError.asError());
            return false;
        }
        const fnArray = !overwrite ? this.fnMacros : this.overwriteMacros;
        fnArray.push(new FnMacro(data.source, data.identifier, data.rules, {
            aura: data.aura ?? [],
            check: data.check ?? [],
            combat: data.combat ?? [],
            effect: data.effect ?? [],
            move: data.move ?? [],
            region: data.region ?? [],
            rest: data.rest ?? [],
            save: data.save ?? [],
            skill: data.skill ?? [],
            time: data.time ?? [],
            tool: data.tool ?? [],
            roll: data.roll ?? [],
            summon: data.summon ?? [],
            generic: data.generic,
            genericConfig: data.genericConfig,
            documents: data.documents
        }));
    }
    registerFnMacros(data = [], overwrite = false) {
        const validationError = this.#multiMacrosSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, validationError.asError());
            return false;
        }
        return data.map(i => this.registerFnMacro(i, overwrite));
    }
    getGenericConfigValue(document, source, identifier, key) {
        const value = document.flags.cat?.genericConfig?.[source]?.[identifier]?.[key];
        if (value != undefined) return value;
        const rules = documentUtils.getRules(document);
        const predicate = macro => macro.source === source && macro.rules === rules && macro.identifier === identifier;
        const macro = this.overwriteMacros.find(predicate) ?? this.fnMacros.find(predicate);
        return macro?.genericConfig?.[key]?.default;
    }
}
class FnMacro {
    constructor(source, identifier, rules, {roll = [], move = [], combat = [], effect = [], aura = [], check = [], region = [], rest = [], save = [], skill = [], time = [], tool = [], summon = [], generic, genericConfig, documents} = {}) {
        this.source = source;
        this.identifier = identifier;
        this.rules = rules;
        this.generic = generic;
        this.genericConfig = genericConfig;
        this.documents = documents;
        this.macros = {
            aura,
            check,
            combat,
            effect,
            move,
            region,
            rest,
            save,
            skill,
            time,
            tool,
            roll,
            summon
        };
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
export default {
    RegisteredMacros
};