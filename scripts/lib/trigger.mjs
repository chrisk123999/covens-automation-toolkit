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
class ActivityRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.activityRoll ?? [];
        this.processFnMacros(fnMacroData, 'activityRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('activityRoll', this.pass);
    }
}
class CastRollTrigger extends ActivityRollTrigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.sourceItem = data.sourceItem;
        const fnMacroData = this.document.flags.cat?.macros?.castRoll ?? [];
        this.processFnMacros(fnMacroData, 'castRoll', pass);
    }
}
class ItemRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.itemRoll ?? [];
        this.processFnMacros(fnMacroData, 'itemRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('itemRoll', this.pass);
    }
}
class TokenRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.tokenRoll ?? [];
        this.processFnMacros(fnMacroData, 'tokenRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('tokenRoll', this.pass);
    }
}
class ActorRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.actorRoll ?? [];
        this.processFnMacros(fnMacroData, 'actorRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('actorRoll', this.pass);
    }
}
class GroupRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.groupRoll ?? [];
        this.processFnMacros(fnMacroData, 'groupRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('groupRoll', this.pass);
    }
}
class EncounterRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.encounterRoll ?? [];
        this.processFnMacros(fnMacroData, 'encounterRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('encounterRoll', this.pass);
    }
}
class VehicleRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.vehicleRoll ?? [];
        this.processFnMacros(fnMacroData, 'vehicleRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('vehicleRoll', this.pass);
    }
}
class EffectRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.effectRoll ?? [];
        this.processFnMacros(fnMacroData, 'effectRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('effectRoll', this.pass);
    }
}
class EnchantmentRollTrigger extends EffectRollTrigger {

}
class RegionRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.regionRoll ?? [];
        this.processFnMacros(fnMacroData, 'regionRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('regionRoll', this.pass);
    }
}
class SceneRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.sceneRoll ?? [];
        this.processFnMacros(fnMacroData, 'sceneRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('sceneRoll', this.pass);
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
        super(document, pass);
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
    ItemRollTrigger,
    ActivityRollTrigger,
    CastRollTrigger,
    TokenRollTrigger,
    ActorRollTrigger,
    GroupRollTrigger,
    EncounterRollTrigger,
    VehicleRollTrigger,
    EffectRollTrigger,
    EnchantmentRollTrigger,
    RegionRollTrigger,
    SceneRollTrigger,
    MoveTrigger,
    RegionTrigger,
    EffectTrigger
};