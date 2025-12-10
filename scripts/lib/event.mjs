import {actorUtils} from '../utils.mjs';
import {Triggers, Logging} from '../lib.mjs';
class CatEvent {
    constructor(pass) {
        this.pass = pass;
        this.name = '';
    }
    appendData(data) {
        return data;
    }
    get sortedTriggers() {
        let unsortedTriggers = this.unsortedTriggers;
        const names = new Set(unsortedTriggers.map(trigger => trigger.name));
        unsortedTriggers = Object.fromEntries(names.map(name => [name, unsortedTriggers.filter(trigger => trigger.name === name)]));
        let maxMap = {};
        names.forEach(name => {
            let maxLevel = Math.max(...unsortedTriggers[name].map(trigger => trigger.castData.castLevel));
            let maxDC = Math.max(...unsortedTriggers[name].map(trigger => trigger.castData.saveDC));
            maxMap[name] = {
                maxLevel: maxLevel,
                maxDC: maxDC
            };
        });
        let triggers = [];
        names.forEach(name => {
            let maxLevel = maxMap[name].maxLevel;
            let maxDC = maxMap[name].maxDC;
            let maxDCTrigger = unsortedTriggers[name].find(trigger => trigger.castData.saveDC === maxDC);
            let selectedTrigger;
            if (maxDCTrigger.castData.castLevel === maxLevel) {
                selectedTrigger = maxDCTrigger;
            } else {
                selectedTrigger = unsortedTriggers[name].find(j => j.castData.castLevel === maxLevel);
            }
            triggers.push(selectedTrigger);
        });
        let sortedTriggers = [];
        let uniqueMacros = new Set();
        triggers.forEach(trigger => {
            trigger.fnMacros.forEach(fnMacro => {
                fnMacro.macros.forEach(macro => {
                    if (macro.unique) {
                        if (uniqueMacros.has(macro.unique)) return;
                        uniqueMacros.add(macro.unique);
                    }
                    let data = {
                        macro: macro.macro,
                        priority: macro.priority,
                        castData: trigger.castData,
                        document: trigger.document,
                        identifier: trigger.identifier,
                        name: trigger.name
                    };
                    if (trigger.sourceToken) data.sourceToken = trigger.sourceToken;
                    sortedTriggers.push(this.appendData(data));
                });
                
            });
        });
        return sortedTriggers.sort((a, b) => a.priority - b.priority);
    }
    get unsortedTriggers() {
        return [];
    }
    async execute() {
        Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass);
        for (let trigger of this.sortedTriggers) {
            Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macro.name + ' from ' + trigger.name);
            let result;
            try {
                result = await trigger.macro(trigger);
            } catch (error) {
                Logging.addMacroError(error);
            }
            if (result) return result;
        }
    }
}
class WorkflowEvent extends CatEvent {
    constructor(pass, workflow) {
        super(pass);
        this.workflow = workflow;
        this.activity = workflow.activity;
        this.item = workflow.item;
        this.actor = workflow.actor;
        this.token = workflow.token?.document;
        this.scene;
        this.regions = workflow.token?.document?.regions;
        this.targets = workflow.targets;
        this.name = 'Workflow';
    }
    appendData(data) {
        data.workflow = this.workflow;
        data.activity = this.activity;
        data.item = this.item;
        data.token = this.token;
        data.scene = this.scene;
        data.regions = this.regions;
        return data;
    }
    getActorTriggers(actor, pass, sourceToken) {
        let triggers = [];
        triggers.push(new Triggers.ActorRollTrigger(actor, pass, {sourceToken}));
        actor.items.forEach(item => {
            triggers.push(new Triggers.ItemRollTrigger(item, pass, {sourceToken}));
            item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment).forEach(effect => {
                triggers.push(new Triggers.EnchantmentRollTrigger(effect, pass, {sourceToken}));
            });
        });
        actorUtils.getEffects(actor).forEach(effect => {
            triggers.push(new Triggers.EffectRollTrigger(effect, pass, {sourceToken}));
        });
        return triggers;
    }
    get unsortedTriggers() {
        let triggers = [];
        if (this.activity) triggers.push(new Triggers.ActivityRollTrigger(this.activity, this.pass));
        if (this.item) {
            triggers.push(new Triggers.ItemRollTrigger(this.item, this.pass));
            this.item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment).forEach(effect => {
                triggers.push(new Triggers.EnchantmentRollTrigger(effect, this.pass));
            });
        }
        if (this.actor) triggers.push(...this.getActorTriggers(this.actor, 'actor' + this.pass.capitalize()));
        if (this.token) {
            triggers.push(new Triggers.TokenRollTrigger(this.token, 'token' + this.pass.capitalize()));
            this.scene = this.token.parent;
        }
        if (this.scene) {
            triggers.push(new Triggers.SceneRollTrigger(this.scene, 'scene' + this.pass.capitalize()));
            this.scene.tokens.forEach(token => {
                if (!token.actor) return;
                triggers.push(new Triggers.TokenRollTrigger(token, 'scene' + this.pass.capitalize(), token));
                triggers.push(...this.getActorTriggers(token.actor, 'scene' + this.pass.capitalize(), token));
            });
        }
        if (this.regions) {
            this.regions.forEach(region => {
                triggers.push(new Triggers.RegionRollTrigger(region, 'region' + this.pass.capitalize()));
            });
        }
        if (this.targets.size) {
            this.targets.forEach(token => {
                if (!this.actor) return;
                triggers.push(new Triggers.TokenRollTrigger(token.document, 'target' + this.pass.capitalize(), token.document));
                triggers.push(...this.getActorTriggers(token.actor, 'target' + this.pass.capitalize(), token.document));
                token.document.regions.forEach(region => {
                    triggers.push(new Triggers.RegionRollTrigger(region, 'target' + this.pass.capitalize(), token.document));
                });
            });
        }
        triggers = triggers.filter(trigger => trigger.fnMacros.length);
        return triggers;
    }
}
export const Events = {
    WorkflowEvent
};