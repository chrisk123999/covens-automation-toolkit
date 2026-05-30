import {documentUtils, tokenUtils} from '../utilities/_module.mjs';
import {constants, EmbeddedMacros} from '../lib/_module.mjs';
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
    }
    processFnMacros(data, type, pass) {
        this.fnMacros = data.map(i => constants.macros.getFnMacros(i.source, i.rules, i.identifier, type, pass)).filter(i => i);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros(this.type, this.pass);
    }
    processDistanceMacros() {
        const filterFn = (macro) => {
            if (!this.distances || !this.targetToken) return false;
            const disabled = macro.configDisabled ? documentUtils.getConfigValue(this.document, macro.configDisabled) : macro.disabled;
            if (disabled) {
                const actor = this.targetToken.actor;
                if (actor && disabled.some(reason => actor.statuses.has(reason))) return false;
            }
            const dispositions = macro.configDispositions ? documentUtils.getConfigValue(this.document, macro.configDispositions) : macro.dispositions;
            if (dispositions) {
                const isEnemy = tokenUtils.isEnemy(this.token, this.targetToken);
                const isAlly = !isEnemy;
                if (!(dispositions.includes('all') || (dispositions.includes('ally') && isAlly) || (dispositions.includes('enemy') && isEnemy))) return false;
            }
            const maxDistance = (macro.configDistance ? documentUtils.getConfigValue(this.document, macro.configDistance) : macro.distance) ?? 0;
            const distance = this.distances[this.targetToken.id] ?? Infinity;
            if (distance < 0) return false;
            if (maxDistance < distance) return false;
            return macro;
        };
        if (this.fnMacros.length) {
            this.fnMacros.forEach(fnMacro => fnMacro.macros = fnMacro.macros.map(filterFn).filter(Boolean));
            this.fnMacros = this.fnMacros.filter(fnMacro => fnMacro.macros.length);
        }
        if (this.embeddedMacros.length) {
            this.embeddedMacros.forEach(embeddedMacro => embeddedMacro.macros = embeddedMacro.macros.map(filterFn).filter(Boolean));
            this.embeddedMacros = this.embeddedMacros.filter(embeddedMacro => embeddedMacro.macros.length);
        }
    }
}
class RollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.roll ?? [];
        this.processFnMacros(fnMacroData, 'roll', pass);
        this.type = 'roll';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class MoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.move ?? [];
        this.processFnMacros(fnMacroData, 'move', pass);
        this.type = 'move';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class RegionTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.region ?? [];
        this.processFnMacros(fnMacroData, 'region', pass);
        this.type = 'region';
        this.processEmbeddedMacro();
    }
}
class EffectTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.effect ?? [];
        this.processFnMacros(fnMacroData, 'effect', pass);
        this.type = 'effect';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class CombatTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.combat ?? [];
        this.processFnMacros(fnMacroData, 'combat', pass);
        this.type = 'combat';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class AuraTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.aura ?? [];
        this.processFnMacros(fnMacroData, 'aura', pass);
        this.type = 'aura';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class ItemTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.item ?? [];
        this.processFnMacros(fnMacroData, 'item', pass);
        this.type = 'item';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class RestTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.rest ?? [];
        this.processFnMacros(fnMacroData, 'rest', pass);
        this.type = 'rest';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class CheckTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.check ?? [];
        this.processFnMacros(fnMacroData, 'check', pass);
        this.type = 'check';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class SkillTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.skill ?? [];
        this.processFnMacros(fnMacroData, 'skill', pass);
        this.type = 'skill';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class SaveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.save ?? [];
        this.processFnMacros(fnMacroData, 'save', pass);
        this.type = 'save';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class ToolTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.tool ?? [];
        this.processFnMacros(fnMacroData, 'tool', pass);
        this.type = 'tool';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class TimeTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.time ?? [];
        this.processFnMacros(fnMacroData, 'time', pass);
        this.type = 'time';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class SummonTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.summon ?? [];
        this.processFnMacros(fnMacroData, 'summon', pass);
        this.type = 'summon';
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
}
class CalledTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        const fnMacroData = this.document.flags.cat?.macros?.called ?? [];
        this.processFnMacros(fnMacroData, 'called', pass);
        this.type = 'called';
        this.processEmbeddedMacro();
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