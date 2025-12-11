import {activityUtils, actorUtils, documentUtils, effectUtils, itemUtils, regionUtils, tokenUtils} from '../utils.mjs';
import {constants, EmbeddedMacros} from '../lib.mjs';
class Trigger {
    constructor(document, pass, {sourceToken} = {}) {
        this.document = document;
        this.identifier;
        this.name;
        this.castData;
        this.pass = pass;
        this.fnMacros = [];
        this.embeddedMacros = [];
        this.sourceToken = sourceToken;
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
        this.identifier = documentUtils.getIdentifier(this.document);
        this.name = this.document.name.slugify();
        this.castData = {
            castLevel: -1,
            baseLevel: -1,
            saveDC: activityUtils.getSaveDC(this.document)
        };
        let fnMacroData = this.document.flags?.cat?.macros?.activityRoll ?? [];
        this.processFnMacros(fnMacroData, 'activityRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('activityRoll', this.pass);
    }
}
class ItemRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.identifier = documentUtils.getIdentifier(this.document);
        this.name = this.document.name.slugify();
        this.castData = {
            castLevel: -1,
            baseLevel: -1,
            saveDC: itemUtils.getSaveDC(this.document)
        };
        let fnMacroData = this.document.flags.cat?.macros?.itemRoll ?? [];
        this.processFnMacros(fnMacroData, 'itemRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('itemRoll', this.pass);
    }
}
class TokenRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.identifier = documentUtils.getIdentifier(this.document);
        this.name = this.document.name.slugify();
        this.castData = tokenUtils.getCastData(this.document);
        let fnMacroData = this.document.flags.cat?.macros?.tokenRoll ?? [];
        this.processFnMacros(fnMacroData, 'tokenRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('tokenRoll', this.pass);
    }
}
class ActorRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.identifier = documentUtils.getIdentifier(this.document);
        this.name = this.document.name.slugify();
        this.castData = actorUtils.getCastData(this.document);
        let fnMacroData = this.document.flags.cat?.macros?.actorRoll ?? [];
        this.processFnMacros(fnMacroData, 'actorRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('actorRoll', this.pass);
    }
}
class EffectRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.identifier = documentUtils.getIdentifier(this.document);
        this.name = this.document.name.slugify();
        this.castData = effectUtils.getCastData(this.document);
        let fnMacroData = this.document.flags.cat?.macros?.effectRoll ?? [];
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
        this.identifier = documentUtils.getIdentifier(this.document);
        this.name = this.document.name.slugify();
        this.castData = regionUtils.getCastData(this.document);
        let fnMacroData = this.document.flags.cat?.macros?.regionRoll ?? [];
        this.processFnMacros(fnMacroData, 'regionRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('regionRoll', this.pass);
    }
}
class SceneRollTrigger extends Trigger {
    constructor(document, pass, data) {
        super(document, pass, data);
        this.identifier = documentUtils.getIdentifier(this.document);
        this.name = this.document.name.slugify();
        this.castData = {
            castLevel: -1,
            baseLevel: -1,
            saveDC: -1
        };
        let fnMacroData = this.document.flags.cat?.macros?.sceneRoll ?? [];
        this.processFnMacros(fnMacroData, 'sceneRoll', pass);
    }
    processEmbeddedMacro() {
        this.embeddedMacros = new EmbeddedMacros(this.document).getMacros('sceneRoll', this.pass);
    }
}
export const Triggers = {
    ItemRollTrigger,
    ActivityRollTrigger,
    TokenRollTrigger,
    ActorRollTrigger,
    EffectRollTrigger,
    EnchantmentRollTrigger,
    RegionRollTrigger,
    SceneRollTrigger
};