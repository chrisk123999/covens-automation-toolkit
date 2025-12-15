import {activityUtils, actorUtils, effectUtils, itemUtils, regionUtils, tokenUtils} from '../utils.mjs';
import {Triggers, Logging, constants} from '../lib.mjs';
class CatEvent {
    constructor(pass) {
        this.pass = pass;
        this.trigger;
    }
    appendData(data = {}) {
        return {
            ...data,
            item: this.item,
            token: this.token,
            actor: this.actor,
            scene: this.scene,
            regions: this.regions,
            groups: this.groups,
            encounters: this.encounters,
            vehicles: this.vehicles
        };
    }
    getActorTriggers(actor, pass, data) {
        const triggers = [];
        if (CatEvent.hasCatFlag(actor)) triggers.push(new this.trigger(actor, pass, data));
        actor.items.forEach(item => {
            if (CatEvent.hasCatFlag(item)) triggers.push(new this.trigger(item, pass, data));
            item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment && CatEvent.hasCatFlag(effect)).forEach(effect => {
                triggers.push(new this.trigger(effect, pass, data));
            });
            item.system.activities?.contents?.filter(activity => CatEvent.hasCatFlag(activity)).forEach(activity => {
                triggers.push(new this.trigger(activity, pass, data));
            });
        });
        actorUtils.getEffects(actor).filter(effect => CatEvent.hasCatFlag(effect)).forEach(effect => {
            triggers.push(new this.trigger(effect, pass, data));
        });
        return triggers;
    }
    getGroupTriggers(group, pass, data) {
        const triggers = [];
        if (CatEvent.hasCatFlag(group)) triggers.push(new this.trigger(group, pass, data));
        group.system.creatures.forEach(actor => {
            triggers.push(...this.getActorTriggers(actor, pass, data));
        });
        return triggers;
    }
    getEncounterTriggers(encounter, pass, data) {
        const triggers = [];
        if (CatEvent.hasCatFlag(encounter)) triggers.push(new this.trigger(encounter, pass, data));
        const creatures = encounter.system.members.uuids.map(uuid => {
            return fromUuidSync(uuid, {strict: false});
        }).filter(i => i);
        creatures.forEach(actor => {
            triggers.push(...this.getActorTriggers(actor, pass, data));
        });
        return triggers;
    }
    getVehicleTriggers(vehicle, pass, data) {
        const triggers = [];
        if (CatEvent.hasCatFlag(vehicle)) triggers.push(new this.trigger(vehicle, pass, data));
        const creatures = [];
        creatures.push(...vehicle.system.crew.value.map(uuid => {
            return fromUuidSync(uuid, {strict: false});
        }).filter(i => i));
        creatures.push(...vehicle.system.passengers.value.map(uuid => {
            return fromUuidSync(uuid, {strict: false});
        }).filter(i => i));
        creatures.push(...vehicle.system.draft.value.map(uuid => {
            return fromUuidSync(uuid, {strict: false});
        }).filter(i => i));
        creatures.forEach(actor => {
            triggers.push(...this.getActorTriggers(actor, pass, data));
        });
        return triggers;
    }
    getSceneTriggers(scene, pass, data) {
        const triggers = [];
        if (CatEvent.hasCatFlag(scene)) triggers.push(new this.trigger(scene, pass, data));
        scene.tokens.forEach(token => {
            if (!token.actor) return;
            if (CatEvent.hasCatFlag(token)) triggers.push(new this.trigger(token, pass, data));
            triggers.push(...this.getActorTriggers(token.actor, pass, data));
        });
        return triggers;
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
                    const data = {
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
        return !!(document.flags.cat?.macros || document.flags.cat?.embeddedMacros);
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
    runSync() {
        Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass);
        for (let trigger of this.sortedTriggers) {
            let result;
            if (typeof trigger.macro === 'string') {
                Logging.addEntry('DEBUG', 'Executing Embedded Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                this.executeScriptSync(trigger.macro, trigger);
            } else {
                Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                try {
                    result = trigger.macro(trigger);
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
    executeScriptSync(script, ...scope) {
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
            result = fn(...argValues);
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
        this.trigger = Triggers.RollTrigger;
    }
    get unsortedTriggers() {
        let triggers = [];
        if (this.activity && CatEvent.hasCatFlag(this.activity)) triggers.push(new Triggers.RollTrigger(this.activity, this.pass));
        if (this.item) {
            if (CatEvent.hasCatFlag(this.item)) triggers.push(new Triggers.RollTrigger(this.item, this.pass));
            this.item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment && CatEvent.hasCatFlag(effect)).forEach(effect => {
                triggers.push(new Triggers.RollTrigger(effect, this.pass));
            });
            const cachedForUuid = this.item.flags.dnd5e?.cachedFor;
            if (cachedForUuid && this.actor) {
                const castActivity = fromUuidSync(cachedForUuid, {relative: this.actor});
                if (castActivity && CatEvent.hasCatFlag(castActivity)) triggers.push(new Triggers.RollTrigger(castActivity, this.pass, {sourceItem: this.item}));
            }
        }
        if (this.actor) triggers.push(...this.getActorTriggers(this.actor, 'actor' + this.pass.capitalize()));
        if (this.token) {
            if (CatEvent.hasCatFlag(this.token)) triggers.push(new Triggers.RollTrigger(this.token, 'token' + this.pass.capitalize()));
        }
        if (this.scene) {
            triggers.push(...this.getSceneTriggers(this.scene, 'scene' + this.pass.capitalize()));
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new Triggers.RollTrigger(region, 'region' + this.pass.capitalize()));
            });
        }
        if (this.targets?.size) {
            this.targets.forEach(token => {
                if (!this.actor) return;
                if (CatEvent.hasCatFlag(token)) triggers.push(new Triggers.RollTrigger(token.document, 'target' + this.pass.capitalize(), token.document));
                triggers.push(...this.getActorTriggers(token.actor, 'target' + this.pass.capitalize(), {sourceToken: token.document}));
                token.document.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                    triggers.push(new Triggers.RollTrigger(region, 'target' + this.pass.capitalize(), {sourceToken: token.document}));
                });
            });
        }
        if (this.groups.length) {
            this.groups.forEach(group => {
                triggers.push(...this.getGroupTriggers(group, 'group' + this.pass.capitalize()));
            });
        }
        if (this.encounters.length) {
            this.encounters.forEach(encounter => {
                triggers.push(...this.getEncounterTriggers(encounter, 'encounter' + this.pass.capitalize()));
            });
        }
        if (this.vehicles.length) {
            this.vehicles.forEach(vehicle => {
                triggers.push(...this.getVehicleTriggers(vehicle, 'vehicle' + this.pass.capitalize()));
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
        this.groups = this.actor ? actorUtils.getGroups(this.actor) : [];
        this.encounters = this.actor ? actorUtils.getEncounters(this.actor) : [];
        this.vehicles = this.actor ? actorUtils.getVehicles(this.actor) : [];
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            workflow: this.workflow,
            activity: this.activity
        };
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
        this.groups = this.actor ? actorUtils.getGroups(this.actor) : [];
        this.encounters = this.actor ? actorUtils.getEncounters(this.actor) : [];
        this.vehicles = this.actor ? actorUtils.getVehicles(this.actor) : [];
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
class MovementEvent extends CatEvent {
    constructor(token, pass, {options}) {
        super(pass);
        this.name = 'Movement';
        this.trigger = Triggers.MoveTrigger;
        this.token = token;
        this.actor = token.actor;
        this.regions = token.regions;
        this.scene = token.parent;
        this.groups = actorUtils.getGroups(this.actor);
        this.encounters = actorUtils.getEncounters(this.actor);
        this.vehicles = actorUtils.getVehicles(this.actor);
        this.options = options;
    }
    get unsortedTriggers() {
        let triggers = [];
        triggers.push(...this.getActorTriggers(this.actor, this.pass));
        this.groups.forEach(group => triggers.push(...this.getGroupTriggers(group, 'group' + this.pass.capitalize())));
        this.vehicles.forEach(vehicle => triggers.push(...this.getVehicleTriggers(vehicle, 'vehicle' + this.pass.capitalize())));
        this.encounters.forEach(encounter => triggers.push(...this.getEncounterTriggers(encounter, 'encounter' + this.pass.capitalize())));
        triggers.push(...this.getSceneTriggers(this.scene, 'scene' + this.pass.capitalize()));
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
}
class MovementNearEvent extends CatEvent {
    constructor(token, pass, {options}) {
        super(pass);
        this.name = 'Movement Near';
        this.trigger = Triggers.MoveTrigger;
        this.token = token;
        this.actor = token.actor;
        this.regions = token.regions;
        this.scene = token.parent;
        this.groups = actorUtils.getGroups(this.actor);
        this.encounters = actorUtils.getEncounters(this.actor);
        this.vehicles = actorUtils.getVehicles(this.actor);
        this.options = options;
        this.tokens = this.token.parent.tokens.filter(token => token.actor && ['npc', 'character'].includes(token.actor.type) && token.id != this.token.id);
        this.distances = {};
        this.tokens.forEach(token => this.distances[token.id] = tokenUtils.getDistance(this.token, token));
        console.log(this.distances);
    }
    get unsortedTriggers() {
        let triggers = [];
        //DO this!
        console.log(triggers);
        return triggers;
    }
}
class RegionEvent extends CatEvent {
    constructor(regions, pass, {tokens}) {
        super(pass);
        this.name = 'Region';
        this.Trigger = Triggers.RegionTrigger;
        this.regions = regions;
        this.tokens = tokens;
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
class EffectEvent extends CatEvent {
    constructor(effect, pass, {options, updates}) {
        super(pass);
        this.name = 'Effect';
        this.trigger = Triggers.EffectTrigger;
        this.effect = effect;
        if (effect.parent instanceof Actor) {
            this.actor = effect.parent;
        }
        if (effect.parent instanceof Item) {
            this.item = effect.parent;
            this.actor = this.item.actor;
        }
        this.token = actorUtils.getFirstToken(this.actor);
        if (this.token) {
            this.scene = this.token.parent;
            this.regions = this.token.regions;
        }
        this.groups = actorUtils.getGroups(this.actor);
        this.encounters = actorUtils.getEncounters(this.actor);
        this.vehicles = actorUtils.getVehicles(this.actor);
        this.options = options;
        this.updates = updates;
    }
    get unsortedTriggers() {
        let triggers = [];
        if (CatEvent.hasCatFlag(this.effect)) triggers.push(new Triggers.EffectTrigger(this.effect, this.pass));
        triggers.push(...this.getActorTriggers(this.actor, 'actor' + this.pass.capitalize()));
        if (this.scene) {
            triggers.push(...this.getSceneTriggers(this.scene, 'scene' + this.pass.capitalize()));
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new Triggers.EffectTrigger(region, 'region' + this.pass.capitalize()));
            });
        }
        this.groups.forEach(group => triggers.push(...this.getGroupTriggers(group, 'group' + this.pass.capitalize())));
        this.vehicles.forEach(vehicle => triggers.push(...this.getVehicleTriggers(vehicle, 'vehicle' + this.pass.capitalize())));
        this.encounters.forEach(encounter => triggers.push(...this.getEncounterTriggers(encounter, 'encounter' + this.pass.capitalize())));
        return triggers;
    }
    appendData(data) {
        data = super.appendData(data);
        data.options = this.options;
        data.updates = this.updates;
        return data;
    }
}
class CombatEvent extends CatEvent {
    constructor(combat, pass, token, {context, combatant, previousCombatant, round, turn, previousRound, previousTurn}) {
        super(pass);
        this.name = 'Combat';
        this.trigger = Triggers.CombatTrigger;
        this.combat = combat;
        this.combatant = combatant;
        this.previousCombatant = previousCombatant;
        this.token = token;
        this.actor = token.actor;
        this.regions = token.regions;
        this.scene = token.parent;
        this.groups = actorUtils.getGroups(this.actor);
        this.encounters = actorUtils.getEncounters(this.actor);
        this.vehicles = actorUtils.getVehicles(this.actor);
        this.context = context;
        this.round = round;
        this.turn = turn;
        this.previousRound = previousRound;
        this.previousTurn = previousTurn;
    }
    get unsortedTriggers() {
        let triggers = [];
        triggers.push(...this.getActorTriggers(this.actor, this.pass));
        if (this.scene) {
            triggers.push(...this.getSceneTriggers(this.scene, 'scene' + this.pass.capitalize()));
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new Triggers.EffectTrigger(region, 'region' + this.pass.capitalize()));
            });
        }
        this.groups.forEach(group => triggers.push(...this.getGroupTriggers(group, 'group' + this.pass.capitalize())));
        this.vehicles.forEach(vehicle => triggers.push(...this.getVehicleTriggers(vehicle, 'vehicle' + this.pass.capitalize())));
        this.encounters.forEach(encounter => triggers.push(...this.getEncounterTriggers(encounter, 'encounter' + this.pass.capitalize())));
        triggers.push(...this.getSceneTriggers(this.scene, 'scene' + this.pass.capitalize()));
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
    appendData(data) {
        data = super.appendData(data);
        data.context = this.context;
        data.combatant = this.combatant;
        data.previousCombatant = this.previousCombatant;
        data.round = this.round;
        data.turn = this.turn;
        data.previousRound = this.previousRound;
        data.previousTurn = this.previousTurn;
        return data;
    }
}
export const Events = {
    WorkflowEvent,
    PreTargetingWorkflowEvent,
    TokenDamageWorkflowEvent,
    MovementEvent,
    MovementNearEvent,
    RegionEvent,
    EffectEvent,
    CombatEvent
};