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
        const fnMacroData = this.document.flags?.cat?.macros?.activityRoll ?? [];
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
        const fnMacroData = this.document.flags?.cat?.macros?.castRoll ?? [];
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
class TokenMoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.tokenMove ?? [];
        this.processFnMacros(fnMacroData, 'tokenMove', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('tokenMove', this.pass);
    }
}
class ActorMoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.actorMove ?? [];
        this.processFnMacros(fnMacroData, 'actorMove', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('actorMove', this.pass);
    }
}
class ItemMoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.itemMove ?? [];
        this.processFnMacros(fnMacroData, 'itemMove', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('itemMove', this.pass);
    }
}
class ActivityMoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.activityMove ?? [];
        this.processFnMacros(fnMacroData, 'activityMove', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('activityMove', this.pass);
    }
}
class EffectMoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.effectMove ?? [];
        this.processFnMacros(fnMacroData, 'effectMove', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('effectMove', this.pass);
    }
}
class EnchantmentMoveTrigger extends Trigger {

}
class SceneMoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.sceneMove ?? [];
        this.processFnMacros(fnMacroData, 'sceneMove', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('sceneMove', this.pass);
    }
}
class GroupMoveTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.name = this.document.name.slugify();
        const fnMacroData = this.document.flags.cat?.macros?.groupMove ?? [];
        this.processFnMacros(fnMacroData, 'groupMove', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('groupMove', this.pass);
    }
}
export const Triggers = {
    ItemRollTrigger,
    ActivityRollTrigger,
    CastRollTrigger,
    TokenRollTrigger,
    ActorRollTrigger,
    GroupRollTrigger,
    EffectRollTrigger,
    EnchantmentRollTrigger,
    RegionRollTrigger,
    SceneRollTrigger,
    TokenMoveTrigger,
    ActorMoveTrigger,
    ItemMoveTrigger,
    ActivityMoveTrigger,
    SceneMoveTrigger,
    EffectMoveTrigger,
    EnchantmentMoveTrigger,
    GroupMoveTrigger
};