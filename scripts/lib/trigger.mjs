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
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros(this.type, this.pass);
    }
    processDistanceMacros() {
        if (this.fnMacros.length) {
            this.fnMacros.forEach(fnMacro => {
                fnMacro.macros = fnMacro.macros.map(macro => {
                    if (!macro.distance && !macro.configDistance) return macro;
                    const maxDistance = macro.configDistance ? documentUtils.getConfigValue(this.document, macro.configDistance) : macro.distance;
                    const distance = this.distances[this.targetToken.id];
                    if (maxDistance >= distance) return macro;
                    return false;
                }).filter(i => i);
            });
        }
    }
}
class RollTrigger extends Trigger {
    constructor(document, pass, data, distances) {
        super(document, pass, data, distances);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.roll ?? [];
        this.processFnMacros(fnMacroData, 'roll', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class MoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.move ?? [];
        this.processFnMacros(fnMacroData, 'move', pass);
        this.type = 'move';
    }
}
class RegionTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.region ?? [];
        this.processFnMacros(fnMacroData, 'region', pass);
        this.type = 'region';
    }
}
class EffectTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.effect ?? [];
        this.processFnMacros(fnMacroData, 'effect', pass);
        this.type = 'effect';
    }
}
class CombatTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.effect ?? [];
        this.processFnMacros(fnMacroData, 'combat', pass);
        this.type = 'combat';
    }
}
export const Triggers = {
    Trigger,
    RollTrigger,
    MoveTrigger,
    RegionTrigger,
    EffectTrigger,
    CombatTrigger
};