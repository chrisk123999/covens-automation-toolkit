import {documentUtils} from '../utils.mjs';
import {constants, EmbeddedMacros} from '../lib.mjs';
class Trigger {
    constructor(document, pass, data) {
        this.document = document;
        this.identifier = documentUtils.getIdentifier(document);
        this.name;
        this.castData = documentUtils.getSavedCastData(document);
        this.pass = pass;
        this.fnMacros = [];
        this.embeddedMacros = [];
        if (data && typeof data === 'object') Object.entries(data).forEach(([key, value]) => this[key] = value);
        this.processEmbeddedMacro();
    }
    processFnMacros(data, type, pass) {
        this.fnMacros = data.map(i => constants.registeredMacros.getFnMacros(i.source, i.rules, i.identifier, type, pass)).filter(i => i);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = [];
    }
}
class RollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.roll ?? [];
        this.processFnMacros(fnMacroData, 'roll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('roll', this.pass);
    }
}
class MoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.move ?? [];
        this.processFnMacros(fnMacroData, 'move', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('move', this.pass);
    }
}
class RegionTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.region ?? [];
        this.processFnMacros(fnMacroData, 'region', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('region', this.pass);
    }
}
class EffectTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.effect ?? [];
        this.processFnMacros(fnMacroData, 'effect', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('effect', this.pass);
    }
}
export const Triggers = {
    Trigger,
    RollTrigger,
    MoveTrigger,
    RegionTrigger,
    EffectTrigger
};