import {actorUtils} from '../utils.js';
import {Triggers} from './trigger.js';
class Event {
    constructor(pass) {
        this.pass = pass;
    }
    get sortedTriggers() {
        let unsortedTriggers = this.triggers;
        // Do sort here!
        return unsortedTriggers;
    }
    execute() {
        let sortedTriggers = this.sortedTriggers;
    }
}
class WorkflowEvent extends Event {
    constructor(workflow, pass) {
        super();
        this.workflow = workflow;
        this.activity = workflow.activity;
        this.item = workflow.item;
        this.actor = workflow.actor;
        this.token = workflow.token?.document;
        this.scene;
        this.regions = workflow.token?.document?.regions;
        this.targets = workflow.targets;
        this.pass = pass;
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
    get triggers() {
        let triggers = [];
        if (this.activity) triggers.push(new Triggers.ActivityRollTrigger(this.activity, this.pass));
        if (this.item) {
            triggers.push(new Triggers.ItemRollTrigger(this.item, this.pass));
            this.item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment).forEach(effect => {
                triggers.push(new Triggers.EnchantmentRollTrigger(effect, this.pass));
            });
        }
        if (this.actor) triggers.push(...this.getActorTriggers(this.actor, this.pass));
        if (this.token) {
            triggers.push(new Triggers.TokenRollTrigger(this.token, this.pass));
            this.scene = this.token.parent;
        }
        if (this.scene) {
            triggers.push(new Triggers.SceneRollTrigger(this.scene, this.pass));
            this.scene.tokens.forEach(token => {
                if (!token.actor) return;
                triggers.push(new Triggers.TokenRollTrigger(token.document, 'scene' + this.pass.capitalize()));
                triggers.push(...this.getActorTriggers(token.actor, 'scene' + this.pass.capitalize()));
            });
        }
        if (this.regions) {
            this.regions.forEach(region => {
                triggers.push(new Triggers.RegionRollTrigger(region, this.pass));
            });
        }
        if (this.targets.size) {
            this.targets.forEach(token => {
                if (!this.actor) return;
                triggers.push(new Triggers.TokenRollTrigger(token.document, 'target' + this.pass.capitalize()));
                triggers.push(...WorkflowEvent.getActorTriggers(token.actor, 'target' + this.pass.capitalize()));
                token.document.regions.forEach(region => {
                    triggers.push(new Triggers.RegionRollTrigger(region, 'target' + this.pass.capitalize()));
                });
            });
        }
        this.initialized = true;
        console.log(triggers);
        return triggers;
    }
}
export const Events = {
    WorkflowEvent
};