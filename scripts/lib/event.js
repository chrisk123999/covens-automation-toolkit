import {actorUtils} from '../utils.js';
import {Triggers} from './trigger.js';
class CatEvent {
    constructor(pass) {
        this.pass = pass;
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
                    sortedTriggers.push(this.appendData(data));
                });
                
            });
        });
        return sortedTriggers.sort((a, b) => a.priority - b.priority);
    }
    get unsortedTriggers() {
        return [];
    }
    execute() {
        return this.sortedTriggers;
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
    getActorTriggers(actor, pass) {
        let triggers = [];
        triggers.push(new Triggers.ActorRollTrigger(actor, pass));
        actor.items.forEach(item => {
            triggers.push(new Triggers.ItemRollTrigger(item, pass));
            item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment).forEach(effect => {
                triggers.push(new Triggers.EnchantmentRollTrigger(effect, pass));
            });
        });
        actorUtils.getEffects(actor).forEach(effect => {
            triggers.push(new Triggers.EffectRollTrigger(effect, pass));
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
                triggers.push(new Triggers.TokenRollTrigger(token, 'scene' + this.pass.capitalize()));
                triggers.push(...this.getActorTriggers(token.actor, 'scene' + this.pass.capitalize()));
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
                triggers.push(new Triggers.TokenRollTrigger(token.document, 'target' + this.pass.capitalize()));
                triggers.push(...this.getActorTriggers(token.actor, 'target' + this.pass.capitalize()));
                token.document.regions.forEach(region => {
                    triggers.push(new Triggers.RegionRollTrigger(region, 'target' + this.pass.capitalize()));
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