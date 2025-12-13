import {activityUtils, actorUtils, effectUtils, itemUtils, regionUtils, tokenUtils} from '../utils.mjs';
import {Triggers, Logging, constants} from '../lib.mjs';
class CatEvent {
    constructor(pass) {
        this.pass = pass;
    }
    appendData(data) {
        return data;
    }
    get sortedTriggers() {
        const startTime = performance.now();
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
            [...trigger.fnMacros, ...trigger.embeddedMacros].forEach(fnMacro => {
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
        sortedTriggers = sortedTriggers.sort((a, b) => a.priority - b.priority);
        const endTime = performance.now();
        Logging.addEntry('DEBUG', 'Trigger Collection Time: ' + (endTime - startTime) + ' milliseconds');
        return sortedTriggers;
    }
    get unsortedTriggers() {
        return [];
    }
    static hasCatFlag(document) {
        return !!document.flags.cat;
    }
    async run() {
        Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass);
        for (let trigger of this.sortedTriggers) {
            let result;
            if (typeof trigger.macro === 'string') {
                Logging.addEntry('DEBUG', 'Executing Embedded Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                await this.executeScript(trigger.macro, trigger);
            } else {
                Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                try {
                    result = await trigger.macro(trigger);
                } catch (error) {
                    Logging.addMacroError(error);
                }
            }
            if (result) return result;
        }
    }
    async executeScript(script, ...scope) {
        const defaultScope = {
            activityUtils,
            actorUtils,
            effectUtils,
            itemUtils,
            regionUtils,
            tokenUtils,
            constants
        };
        scope = {...defaultScope, ...scope};
        let argNames = Object.keys(scope);
        if (argNames.some(k => Number.isNumeric(k))) throw new Error('Illegal numeric Macro parameter passed to execution scope.');
        let argValues = Object.values(scope);
        let fn = new foundry.utils.AsyncFunction(...argNames, '{' + script + '}\n');
        let result;
        try {
            result = await fn(...argValues);
        } catch (error) {
            Logging.addMacroError(error);
        }
        return result;
    }
}
class BaseWorkflowEvent extends CatEvent {
    constructor(pass) {
        super(pass);
        this.name = 'Workflow';
    }
    getActorTriggers(actor, pass, sourceToken) {
        let triggers = [];
        if (CatEvent.hasCatFlag(actor)) triggers.push(new Triggers.ActorRollTrigger(actor, pass, {sourceToken}));
        actor.items.forEach(item => {
            if (CatEvent.hasCatFlag(item)) triggers.push(new Triggers.ItemRollTrigger(item, pass, {sourceToken}));
            item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment && CatEvent.hasCatFlag(effect)).forEach(effect => {
                triggers.push(new Triggers.EnchantmentRollTrigger(effect, pass, {sourceToken}));
            });
            item.system.activities?.contents?.filter(activity => CatEvent.hasCatFlag(activity)).forEach(activity => {
                triggers.push(new Triggers.ActivityRollTrigger(activity, pass, {sourceToken}));
            });
        });
        actorUtils.getEffects(actor).filter(effect => CatEvent.hasCatFlag(effect)).forEach(effect => {
            triggers.push(new Triggers.EffectRollTrigger(effect, pass, {sourceToken}));
        });
        actorUtils.getGroups(actor).forEach(group => {
            if (CatEvent.hasCatFlag(group)) triggers.push(new Triggers.GroupRollTrigger(group, pass, {sourceToken}));
        });
        actorUtils.getEncounters(actor).forEach(encounter => {
            if (CatEvent.hasCatFlag(encounter)) triggers.push(new Triggers.EncounterRollTrigger(encounter, pass, {sourceToken}));
        });
        actorUtils.getVehicles(actor).forEach(vehicle => {
            if (CatEvent.hasCatFlag(vehicle)) triggers.push(new Triggers.VehicleRollTrigger(vehicle, pass, {sourceToken}));
        });
        return triggers;
    }
    get unsortedTriggers() {
        let triggers = [];
        if (this.activity && CatEvent.hasCatFlag(this.activity)) triggers.push(new Triggers.ActivityRollTrigger(this.activity, this.pass));
        if (this.item) {
            if (CatEvent.hasCatFlag(this.item)) triggers.push(new Triggers.ItemRollTrigger(this.item, this.pass));
            this.item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment && CatEvent.hasCatFlag(effect)).forEach(effect => {
                triggers.push(new Triggers.EnchantmentRollTrigger(effect, this.pass));
            });
            const cachedForUuid = this.item.flags.dnd5e?.cachedFor;
            if (cachedForUuid && this.actor) {
                const castActivity = fromUuidSync(cachedForUuid, {relative: this.actor});
                if (castActivity && CatEvent.hasCatFlag(castActivity)) triggers.push(new Triggers.CastRollTrigger(castActivity, this.pass, {sourceItem: this.item}));
            }
        }
        if (this.actor && CatEvent.hasCatFlag(this.actor)) triggers.push(...this.getActorTriggers(this.actor, 'actor' + this.pass.capitalize()));
        if (this.token) {
            if (CatEvent.hasCatFlag(this.token)) triggers.push(new Triggers.TokenRollTrigger(this.token, 'token' + this.pass.capitalize()));
            this.scene = this.token.parent;
        }
        if (this.scene) {
            if (CatEvent.hasCatFlag(this.scene)) triggers.push(new Triggers.SceneRollTrigger(this.scene, 'scene' + this.pass.capitalize()));
            this.scene.tokens.forEach(token => {
                if (!token.actor) return;
                if (CatEvent.hasCatFlag(token)) triggers.push(new Triggers.TokenRollTrigger(token, 'scene' + this.pass.capitalize(), token));
                triggers.push(...this.getActorTriggers(token.actor, 'scene' + this.pass.capitalize(), token));
            });
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new Triggers.RegionRollTrigger(region, 'region' + this.pass.capitalize()));
            });
        }
        if (this.targets?.size) {
            this.targets.forEach(token => {
                if (!this.actor) return;
                if (CatEvent.hasCatFlag(token)) triggers.push(new Triggers.TokenRollTrigger(token.document, 'target' + this.pass.capitalize(), token.document));
                triggers.push(...this.getActorTriggers(token.actor, 'target' + this.pass.capitalize(), token.document));
                token.document.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                    triggers.push(new Triggers.RegionRollTrigger(region, 'target' + this.pass.capitalize(), token.document));
                });
            });
        }
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
}
class WorkflowEvent extends BaseWorkflowEvent {
    constructor(pass, workflow) {
        super(pass);
        this.workflow = workflow;
        this.activity = workflow.activity;
        this.item = workflow.item;
        this.actor = workflow.actor;
        this.token = workflow.token?.document;
        this.scene = workflow.token?.document?.parent;
        this.regions = workflow.token?.document?.regions;
        this.targets = workflow.targets;
        this.groups = this.actor ? actorUtils.getGroups(this.actor) : undefined;
        this.encounters = this.actor ? actorUtils.getEncounters(this.actor) : undefined;
        this.vehicles = this.actor ? actorUtils.getVehicles(this.actor) : undefined;
    }
    appendData(data) {
        data.workflow = this.workflow;
        data.activity = this.activity;
        data.item = this.item;
        data.token = this.token;
        data.actor = this.actor;
        data.scene = this.scene;
        data.regions = this.regions;
        data.groups = this.groups;
        data.encounters = this.encounters;
        data.vehicles = this.vehicles;
        return data;
    }
}
class PreTargetingWorkflowEvent extends BaseWorkflowEvent {
    constructor(pass, {activity, token, config, dialog, message}) {
        super(pass);
        this.activity = activity;
        this.item = activity.item;
        this.actor = this.item?.actor;
        this.token = token?.document;
        this.scene = token?.document?.parent;
        this.regions = token?.document?.regions;
        this.config = config;
        this.dialog = dialog;
        this.message = message;
    }
    appendData(data) {
        data = super.appendData(data);
        data.config = this.config;
        data.dialog = this.dialog;
        data.message = this.message;
        return data;
    }
}
class TokenDamageWorkflowEvent extends BaseWorkflowEvent {
    constructor(pass, workflow, token, ditem) {
        super(pass, workflow);
        this.ditem = ditem;
        this.targetToken = token?.document;
    }
    appendData(data) {
        data = super.appendData(data);
        data.ditem = this.ditem;
        data.targetToken = this.targetToken;
        return data;
    }
}
class TokenMovementEvent extends CatEvent {
    constructor(token, pass) {
        super(pass);
        this.token = token;
        this.actor = token.actor;
        this.scene = token.parent;
        this.groups = actorUtils.getGroups(this.actor);
        this.name = 'Movement';
    }
    appendData(data) {
        data = super.appendData(data);
        data.groups = this.groups;
    }
    getActorTriggers(actor, pass, data) {
        let triggers = [];
        if (CatEvent.hasCatFlag(actor)) triggers.push(new Triggers.ActorMoveTrigger(actor, pass));
        actor.items.forEach(item => {
            if (CatEvent.hasCatFlag(item)) triggers.push(new Triggers.ItemMoveTrigger(item, pass));
            item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment && CatEvent.hasCatFlag(effect)).forEach(effect => {
                triggers.push(new Triggers.EnchantmentMoveTrigger(effect, pass));
            });
            item.system.activities.filter(activity => CatEvent.hasCatFlag(activity)).forEach(activity => {
                triggers.push(new Triggers.ActivityMoveTrigger(activity, pass, data));
            });
        });
        actorUtils.getEffects(actor).filter(effect => CatEvent.hasCatFlag(effect)).forEach(effect => {
            triggers.push(new Triggers.EffectRollTrigger(effect, pass));
        });
        actorUtils.getGroups(actor).forEach(group => {
            if (CatEvent.hasCatFlag(group)) triggers.push(new Triggers.GroupMoveTrigger(group, pass));
        });
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
    get unsortedTriggers() {
        let triggers = [];
        triggers.push(...this.getActorTriggers(this.actor, this.pass));
        if (CatEvent.hasCatFlag(this.scene)) triggers.push(new Triggers.SceneMoveTrigger(this.scene, this.pass));
        this.scene.tokens.forEach(token => {
            if (!token.actor) return;
            if (CatEvent.hasCatFlag(token)) triggers.push(new Triggers.TokenMoveTrigger(token, 'scene' + this.pass.capitalize(), token));
            triggers.push(...this.getActorTriggers(token.actor, 'scene' + this.pass.capitalize(), token));
        });
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
}
class RegionTokenEvent extends CatEvent {
    constructor(regions, pass, tokens) {
        super(pass);
        this.regions = regions;
        this.tokens = tokens;
        this.name = 'Region';
    }
    get unsortedTriggers() {
        let triggers = [];
        this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
            triggers.push(new Triggers.RegionTrigger(region, this.pass, {tokens: this.tokens}));
        });
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
    appendData(data) {
        data = super.appendData(data);
        data.tokens = this.tokens;
    }
}
export const Events = {
    WorkflowEvent,
    PreTargetingWorkflowEvent,
    TokenDamageWorkflowEvent,
    TokenMovementEvent,
    RegionTokenEvent
};