class fnMacro {
    constructor(source, identifier, rules, {rollMacros = []} = {}) {
        this.source = source;
        this.identifier = identifier;
        this.rules = rules;
        this.rollMacros = rollMacros;
    }
    getRollMacros(pass) {
        return this.rollMacros.filter(data => data.pass === pass);
    }
}