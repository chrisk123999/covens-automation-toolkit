import {Logging} from '../lib/_module.mjs';
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
            roll: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false})
        });
        this.#multiMacrosSchema = new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}));
    }
    getFnMacros(source, rules, identifier, type, pass) {
        let fnMacro = this.overwriteMacros.find(oMacro => oMacro.source === source && oMacro.identifier === identifier && (oMacro.rules === rules || oMacro.rules === 'all')) ?? this.fnMacros.find(fnMacro => fnMacro.source === source && fnMacro.identifier === identifier && (fnMacro.rules === rules || fnMacro.rules === 'all'));
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
    registerFnMacro(data, overwrite = false) {
        const validationError = this.#macrosSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, validationError.asError());
            return false;
        }
        let fnArray = !overwrite ? this.fnMacros : this.overwriteMacros;
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
            roll: data.roll ?? []
        }));
    }
    registerFnMacros(data = [], overwrite = false) {
        const validationError = this.#multiMacrosSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, validationError.asError());
            return false;
        }
        return data.map(i => this.registerFnMacro(i), overwrite);
    }
}
class FnMacro {
    constructor(source, identifier, rules, {roll = [], move = [], combat = [], effect = [], aura = [], check = [], region = [], rest = [], save = [], skill = [], time = [], tool = []} = {}) {
        this.source = source;
        this.identifier = identifier;
        this.rules = rules;
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
            roll
        };
    }
}
export default {
    RegisteredMacros
};