class RegisteredMacros {
    constructor() {
        this.fnMacros = [];
    }
    getFnMacros(source, rules, identifier, type, pass) {
        let fnMacro = this.fnMacros.find(fnMacro => fnMacro.source === source && fnMacro.identifier === identifier && (fnMacro.rules === rules || fnMacro.rules === 'all'));
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
        //TODO: Validate data!
        this.fnMacros.push(new FnMacro(data.source, data.identifier, data.rules, {
            activityRoll: data.activityRoll ?? [],
            itemRoll: data.itemRoll ?? []
        }));
    }
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