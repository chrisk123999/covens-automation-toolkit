import {Logging} from '../lib.mjs';
const fields = foundry.data.fields;
class RegisteredMacros {
    #macrosSchema;
    #multiMacrosSchema;
    constructor() {
        this.fnMacros = [];
        this.overwriteMacros = [];
        this.#macrosSchema = new fields.SchemaField({
            source: new fields.StringField({required: true, nullable: false}),
            rules: new fields.StringField({required: true, nullable: false}),
            identifier: new fields.StringField({required: true, nullable: false}),
            activityRoll: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            itemRoll: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            tokenRoll: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            actorRoll: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            effectRoll: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            regionRoll: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
            sceneRoll: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false})
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
    registerFnMacro(data) {
        const validationError = this.#macrosSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, validationError.asError());
            return false;
        }
        this.fnMacros.push(new FnMacro(data.source, data.identifier, data.rules, {
            activityRoll: data.activityRoll ?? [],
            itemRoll: data.itemRoll ?? [],
            tokenRoll: data.tokenRoll ?? [],
            actorRoll: data.actorRoll ?? [],
            effectRoll: data.effectRoll ?? [],
            regionRoll: data.regionRoll ?? [],
            sceneRoll: data.sceneRoll ?? []
        }));
    }
    registerFnMacros(data = []) {
        const validationError = this.#multiMacrosSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, validationError.asError());
            return false;
        }
        return data.map(i => this.registerFnMacro(i));
    }
    // TODO: Overwrite Macros
}
class FnMacro {
    constructor(source, identifier, rules, {activityRoll = [], itemRoll = []} = {}) {
        this.source = source;
        this.identifier = identifier;
        this.rules = rules;
        this.macros = {
            activityRoll,
            itemRoll
        };
    }
}
export const Macros = {
    RegisteredMacros
};