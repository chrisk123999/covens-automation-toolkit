import {documentUtils, genericUtils} from '../utils.mjs';
import {constants, EmbeddedMacros} from '../lib.mjs';
class Trigger {
    constructor(document, pass, data) {
        this.document = document;
        this.identifier = documentUtils.getIdentifier(document);
        this.name = this.document.name.slugify();
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
                    const distance = this.distances[this.targetToken.id];
                    if (distance < 0) return false;
                    const maxDistance = macro.configDistance ? documentUtils.getConfigValue(this.document, macro.configDistance) : macro.distance;
                    if (maxDistance < distance) return false;
                    const dispositions = macro.configDispositions ? documentUtils.getConfigValue(this.document, macro.configDispositions) : macro.dispositions;
                    if (dispositions) {
                        const isAlly = this.token.disposition == this.targetToken.disposition;
                        const isEnemy = this.token.disposition != this.targetToken.disposition;
                        if (!(dispositions.includes('all') || (dispositions.includes('ally') && isAlly) || (dispositions.includes('enemy') && isEnemy))) return false;
                    }
                    return macro;
                }).filter(i => i);
            });
        }
        if (this.embeddedMacros.length) {
            this.embeddedMacros.forEach(embeddedMacro => {
                embeddedMacro.macros = embeddedMacro.macros.map(macro => {
                    if (!macro.distance) return macro;
                    const distance = this.distances[this.targetToken.id];
                    if (distance < 0) return;
                    const maxDistance = macro.distance;
                    if (genericUtils.convertDistance(this.scene, maxDistance) >= genericUtils.convertDistance(this.scene, distance)) return macro;
                    return false;
                }).filter(i => i);
            });
        }
    }
}
class RollTrigger extends Trigger {
    constructor(document, pass, data, distances) {
        super(document, pass, data, distances);
        const fnMacroData = this.document.flags.cat?.macros?.roll ?? [];
        this.processFnMacros(fnMacroData, 'roll', pass);
        if (this.distances) this.processDistanceMacros();
        this.type = 'roll';
    }
}
class MoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.move ?? [];
        this.processFnMacros(fnMacroData, 'move', pass);
        this.processDistanceMacros();
        this.type = 'move';
    }
}
class RegionTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.region ?? [];
        this.processFnMacros(fnMacroData, 'region', pass);
        this.type = 'region';
    }
}
class EffectTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.effect ?? [];
        this.processFnMacros(fnMacroData, 'effect', pass);
        if (this.distances) this.processDistanceMacros();
        this.type = 'effect';
    }
}
class CombatTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.combat ?? [];
        this.processFnMacros(fnMacroData, 'combat', pass);
        if (this.distances) this.processDistanceMacros();
        this.type = 'combat';
    }
}
class AuraTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.aura ?? [];
        this.processFnMacros(fnMacroData, 'aura', pass);
        if (this.distances) this.processDistanceMacros();
        this.type = 'aura';
    }
}
class ItemTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.item ?? [];
        this.processFnMacros(fnMacroData, 'item', pass);
        if (this.distances) this.processDistanceMacros();
        this.type = 'item';
    }
}
class RestTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.rest ?? [];
        this.processFnMacros(fnMacroData, 'rest', pass);
        if (this.distances) this.processDistanceMacros();
        this.type = 'rest';
    }
}
export const Triggers = {
    Trigger,
    RollTrigger,
    MoveTrigger,
    RegionTrigger,
    EffectTrigger,
    CombatTrigger,
    AuraTrigger,
    ItemTrigger,
    RestTrigger
};