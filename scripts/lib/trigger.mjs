import {automationUtils, documentUtils, tokenUtils} from '../utilities/_module.mjs';
import {constants, EmbeddedMacros} from '../lib/_module.mjs';
class Trigger {
    static get type() { throw new Error (`${this.name} must define a type!`); }
    constructor(document, pass, data) {
        this.type = this.constructor.type;
        this.document = document;
        this.identifier = documentUtils.getIdentifier(document);
        this.name = this.document.name.slugify();
        this.pass = pass;
        this.fnMacros = [];
        this.embeddedMacros = [];
        if (data && typeof data === 'object') Object.entries(data).forEach(([key, value]) => this[key] = value);
        if (!this.castData) this.castData = documentUtils.getSavedCastData(document);
        if (!this.castData.saveDC) this.castData.saveDC = documentUtils.getSavedCastData(document).saveDC;
        const fnMacroData = this.document.flags.cat?.macros?.[this.constructor.type] ?? [];
        this.processFnMacros(fnMacroData, pass);
        this.processEmbeddedMacro();
        if (this.distances) this.processDistanceMacros();
    }
    processFnMacros(data, pass) {
        this.fnMacros = data.map(i => constants.macros.getFnMacros(i.source, i.rules, i.identifier, this.constructor.type, pass)).filter(i => i);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros(this.constructor.type, this.pass);
    }
    processDistanceMacros() {
        const filterFn = (macro) => {
            const target = this.targetToken || this.sourceToken;
            if (!this.distances || !target) return false;
            const disabled = macro.configDisabled ? automationUtils.getConfigValue(this.document, macro.configDisabled) : macro.disabled;
            if (disabled) {
                const actor = this.targetToken.actor;
                if (actor && disabled.some(reason => actor.statuses.has(reason))) return false;
            }
            const dispositions = macro.configDispositions ? automationUtils.getConfigValue(this.document, macro.configDispositions) : macro.dispositions;
            if (dispositions) {
                const isEnemy = tokenUtils.isEnemy(this.token, this.targetToken);
                const isAlly = !isEnemy;
                if (!(dispositions.includes('all') || (dispositions.includes('ally') && isAlly) || (dispositions.includes('enemy') && isEnemy))) return false;
            }
            const maxDistance = macro.configDistance ? automationUtils.getConfigValue(this.document, macro.configDistance) : macro.distance;
            if (maxDistance !== undefined) {
                const distance = this.distances[target.id] ?? Infinity;
                if (distance < 0 || maxDistance < distance) return false;
            }
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
    static get type() { return 'roll'; }
}
class MoveTrigger extends Trigger {
    static get type() { return 'move'; }
}
class RegionTrigger extends Trigger {
    static get type() { return 'region'; }
}
class EffectTrigger extends Trigger {
    static get type() { return 'effect'; }
}
class CombatTrigger extends Trigger {
    static get type() { return 'combat'; }
}
class AuraTrigger extends Trigger {
    static get type() { return 'aura'; }
}
class ItemTrigger extends Trigger {
    static get type() { return 'item'; }
}
class RestTrigger extends Trigger {
    static get type() { return 'rest'; }
}
class CheckTrigger extends Trigger {
    static get type() { return 'check'; }
}
class SkillTrigger extends Trigger {
    static get type() { return 'skill'; }
}
class SaveTrigger extends Trigger {
    static get type() { return 'save'; }
}
class ToolTrigger extends Trigger {
    static get type() { return 'tool'; }
}
class TimeTrigger extends Trigger {
    static get type() { return 'time'; }
}
class SummonTrigger extends Trigger {
    static get type() { return 'summon'; }
}
class CalledTrigger extends Trigger {
    static get type() { return 'called'; }
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