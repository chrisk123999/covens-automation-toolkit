import {activityUtils, actorUtils, effectUtils, itemUtils, regionUtils, tokenUtils} from '../utils.mjs';
import {constants} from './constants.mjs';
class Trigger {
    constructor(document, pass) {
        this.document = document;
        this.identifier;
        this.name;
        this.castData;
        this.pass = pass;
        this.fnMacros = [];
    }
    processFnMacros(data, type, pass) {
        this.fnMacros = data.map(i => constants.registeredMacros().getFnMacros(i.source, i.rules, i.identifier, type, pass)).filter(i => i);
    }
}
class ActivityRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.midiProperties.identifier;
        this.name = this.document.name.slugify();
        this.castData = {
            castLevel: -1,
            baseLevel: -1,
            saveDC: activityUtils.getSaveDC(this.document)
        };
        let fnMacroData = this.document.flags?.cat?.macros?.activityRoll ?? [];
        this.processFnMacros(fnMacroData, 'activityRoll', pass);
    }
}
class ItemRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.system.identifier;
        this.name = this.document.name.slugify();
        this.castData = {
            castLevel: -1,
            baseLevel: -1,
            saveDC: itemUtils.getSaveDC(this.document)
        };
        let fnMacroData = this.document.flags.cat?.macros?.itemRoll ?? [];
        this.processFnMacros(fnMacroData, 'itemRoll', pass);
    }
}
class TokenRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.flags.cat?.identifier ?? this.document.name.slugify();
        this.name = this.document.name.slugify();
        this.castData = tokenUtils.getCastData(this.document);
        let fnMacroData = this.document.flags.cat?.macros?.tokenRoll ?? [];
        this.processFnMacros(fnMacroData, 'tokenRoll', pass);
    }
}
class ActorRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.flags.cat?.identifier ?? this.document.name.slugify();
        this.name = this.document.name.slugify();
        this.castData = actorUtils.getCastData(this.document);
        let fnMacroData = this.document.flags.cat?.macros?.actorRoll ?? [];
        this.processFnMacros(fnMacroData, 'actorRoll', pass);
    }
}
class EffectRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.flags.cat?.identifier ?? this.document.name.slugify();
        this.name = this.document.name.slugify();
        this.castData = effectUtils.getCastData(this.document);
        let fnMacroData = this.document.flags.cat?.macros?.effectRoll ?? [];
        this.processFnMacros(fnMacroData, 'effectRoll', pass);
    }
}
class EnchantmentRollTrigger extends EffectRollTrigger {

}
class RegionRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.flags.cat?.identifier ?? this.document.name.slugify();
        this.name = this.document.name.slugify();
        this.castData = regionUtils.getCastData(this.document);
        let fnMacroData = this.document.flags.cat?.macros?.regionRoll ?? [];
        this.processFnMacros(fnMacroData, 'regionRoll', pass);
    }
}
class SceneRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.flags.cat?.identifier ?? this.document.name.slugify();
        this.name = this.document.name.slugify();
        this.castData = {
            castLevel: -1,
            baseLevel: -1,
            saveDC: -1
        };
        let fnMacroData = this.document.flags.cat?.macros?.sceneRoll ?? [];
        this.processFnMacros(fnMacroData, 'sceneRoll', pass);
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