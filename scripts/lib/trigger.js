import { activityUtils, actorUtils, effectUtils, itemUtils, regionUtils, tokenUtils } from '../utils.js';
class Trigger {
    constructor(document, pass) {
        this.document = document;
        this.identifier;
        this.name;
        this.castData;
        this.macros;
        this.pass = pass;
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
        this.fnMacros = this.document.flags.cat?.activityRoll ?? [];
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
        this.fnMacros = this.document.flags.cat?.itemRoll ?? [];
    }
}
class TokenRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.flags.cat?.identifier ?? this.document.name.slugify();
        this.name = this.document.name.slugify();
        this.castData = tokenUtils.getCastData(this.document);
        this.fnMacros = this.document.flags.cat?.tokenRoll ?? [];
    }
}
class ActorRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.flags.cat?.identifier ?? this.document.name.slugify();
        this.name = this.document.name.slugify();
        this.castData = actorUtils.getCastData(this.document);
        this.fnMacros = this.document.flags.cat?.actorRoll ?? [];
    }
}
class EffectRollTrigger extends Trigger {
    constructor(document, pass) {
        super(document, pass);
        this.identifier = this.document.flags.cat?.identifier ?? this.document.name.slugify();
        this.name = this.document.name.slugify();
        this.castData = effectUtils.getCastData(this.document);
        this.fnMacros = this.document.flags.cat?.effectRoll ?? [];
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
        this.fnMacros = this.document.flags.cat?.regionRoll ?? [];
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
        this.fnMacros = this.document.flags.cat?.sceneRoll ?? [];
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