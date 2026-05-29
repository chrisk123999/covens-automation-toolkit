import {documentUtils, genericUtils} from '../utilities/_module.mjs';
import {constants, EmbeddedMacros} from '../lib/_module.mjs';
class Trigger {
    constructor(document, pass, data, type) {
        this.document = document;
        this.identifier = documentUtils.getIdentifier(document);
        this.name = this.document.name.slugify();
        this.castData = documentUtils.getSavedCastData(document);
        this.pass = pass;
        this.fnMacros = [];
        this.embeddedMacros = [];
        if (data && typeof data === 'object') Object.entries(data).forEach(([key, value]) => this[key] = value);
        this.type = type;
        this.processEmbeddedMacro();
    }
    processFnMacros(data, type, pass) {
        this.fnMacros = data.map(i => constants.macros.getFnMacros(i.source, i.rules, i.identifier, type, pass)).filter(i => i);
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
                }).filter(Boolean);
            });
        }
        if (this.embeddedMacros.length) {
            this.embeddedMacros.forEach(embeddedMacro => {
                embeddedMacro.macros = embeddedMacro.macros.map(macro => {
                    if (macro.distance != null && this.targetToken) {
                        const distance = this.distances[this.targetToken.id];
                        if (distance < 0 || macro.distance < distance) return false;
                    }
                    if (macro.disposition && macro.disposition !== 'all' && this.token && this.targetToken) {
                        const isAlly = this.token.disposition === this.targetToken.disposition;
                        if (macro.disposition === 'ally' && !isAlly) return false;
                        if (macro.disposition === 'enemy' && isAlly) return false;
                    }
                    return macro;
                }).filter(Boolean);
            });
        }
    }
}
class RollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'roll');
        const fnMacroData = this.document.flags.cat?.macros?.roll ?? [];
        this.processFnMacros(fnMacroData, 'roll', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class MoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'move');
        const fnMacroData = this.document.flags.cat?.macros?.move ?? [];
        this.processFnMacros(fnMacroData, 'move', pass);
        this.processDistanceMacros();
    }
}
class RegionTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'region');
        const fnMacroData = this.document.flags.cat?.macros?.region ?? [];
        this.processFnMacros(fnMacroData, 'region', pass);
    }
}
class EffectTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'effect');
        const fnMacroData = this.document.flags.cat?.macros?.effect ?? [];
        this.processFnMacros(fnMacroData, 'effect', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class CombatTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'combat');
        const fnMacroData = this.document.flags.cat?.macros?.combat ?? [];
        this.processFnMacros(fnMacroData, 'combat', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class AuraTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'aura');
        const fnMacroData = this.document.flags.cat?.macros?.aura ?? [];
        this.processFnMacros(fnMacroData, 'aura', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class ItemTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'item');
        const fnMacroData = this.document.flags.cat?.macros?.item ?? [];
        this.processFnMacros(fnMacroData, 'item', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class RestTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'rest');
        const fnMacroData = this.document.flags.cat?.macros?.rest ?? [];
        this.processFnMacros(fnMacroData, 'rest', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class CheckTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'check');
        const fnMacroData = this.document.flags.cat?.macros?.check ?? [];
        this.processFnMacros(fnMacroData, 'check', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class SkillTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'skill');
        const fnMacroData = this.document.flags.cat?.macros?.skill ?? [];
        this.processFnMacros(fnMacroData, 'skill', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class SaveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'save');
        const fnMacroData = this.document.flags.cat?.macros?.save ?? [];
        this.processFnMacros(fnMacroData, 'save', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class ToolTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'tool');
        const fnMacroData = this.document.flags.cat?.macros?.tool ?? [];
        this.processFnMacros(fnMacroData, 'tool', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class TimeTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'time');
        const fnMacroData = this.document.flags.cat?.macros?.time ?? [];
        this.processFnMacros(fnMacroData, 'time', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class SummonTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'summon');
        const fnMacroData = this.document.flags.cat?.macros?.summon ?? [];
        this.processFnMacros(fnMacroData, 'summon', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
class CalledTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data, 'called');
        const fnMacroData = this.document.flags.cat?.macros?.called ?? [];
        this.processFnMacros(fnMacroData, 'called', pass);
        if (this.distances) this.processDistanceMacros();
    }
}
export default {
    Trigger,
    RollTrigger,
    MoveTrigger,
    RegionTrigger,
    EffectTrigger,
    CombatTrigger,
    AuraTrigger,
    ItemTrigger,
    RestTrigger,
    CheckTrigger,
    SkillTrigger,
    SaveTrigger,
    ToolTrigger,
    TimeTrigger,
    SummonTrigger,
    CalledTrigger
};
