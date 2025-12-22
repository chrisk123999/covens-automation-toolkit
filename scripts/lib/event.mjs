import {activityUtils, actorUtils, documentUtils, effectUtils, genericUtils, itemUtils, regionUtils, tokenUtils} from '../utils.mjs';
import {Triggers, Logging, constants} from '../lib.mjs';
class CatEvent {
    constructor(pass) {
        this.pass = pass;
        this.trigger;
        this._sortedTriggers;
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
    getNearbyTriggers(scene, pass, data) {
        const triggers = [];
        scene.tokens.forEach(token => {
            if (!token.actor) return;
            if (CatEvent.hasCatFlag(token)) triggers.push(new this.trigger(token, pass, {...data, targetToken: token, distances: this.distances, token: this.token}));
            triggers.push(...this.getActorTriggers(token.actor, pass, {...data, targetToken: token, distances: this.distances, token: this.token}));
        });
        return triggers;
    }
    get sortedTriggers() {
        if (this._sortedTriggers) return this._sortedTriggers;
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
        this._sortedTriggers = sortedTriggers;
        return this._sortedTriggers;
    }
    get unsortedTriggers() {
        return [];
    }
    static hasCatFlag(document) {
        return !!(document.flags.cat?.macros || document.flags.cat?.embeddedMacros);
    }
    async run() {
        Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass);
        const results = [];
        for (let trigger of this.sortedTriggers) {
            let result;
            if (typeof trigger.macro === 'string') {
                Logging.addEntry('DEBUG', 'Executing Embedded Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                result = await this.executeScript(trigger.macro, trigger);
            } else {
                Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                try {
                    result = await trigger.macro(trigger);
                } catch (error) {
                    Logging.addMacroError(error);
                }
            }
            if (result) results.push(result);
        }
        return results;
    }
    runSync() {
        Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass);
        const results = [];
        for (let trigger of this.sortedTriggers) {
            let result;
            if (typeof trigger.macro === 'string') {
                Logging.addEntry('DEBUG', 'Executing Embedded Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                result = this.executeScriptSync(trigger.macro, trigger);
            } else {
                Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                try {
                    result = trigger.macro(trigger);
                } catch (error) {
                    Logging.addMacroError(error);
                }
            }
            if (result) results.push(result);
        }
        return results;
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
        if (this.activity && CatEvent.hasCatFlag(this.activity)) triggers.push(new this.trigger(this.activity, this.pass));
        if (this.item) {
            if (CatEvent.hasCatFlag(this.item)) triggers.push(new this.trigger(this.item, this.pass));
            this.item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment && CatEvent.hasCatFlag(effect)).forEach(effect => {
                triggers.push(new this.trigger(effect, this.pass));
            });
            const cachedForUuid = this.item.flags.dnd5e?.cachedFor;
            if (cachedForUuid && this.actor) {
                const castActivity = fromUuidSync(cachedForUuid, {relative: this.actor});
                if (castActivity && CatEvent.hasCatFlag(castActivity)) triggers.push(new this.trigger(castActivity, this.pass, {sourceItem: this.item}));
            }
        }
        if (this.actor) triggers.push(...this.getActorTriggers(this.actor, 'actor' + this.pass.capitalize()));
        if (this.token) {
            if (CatEvent.hasCatFlag(this.token)) triggers.push(new this.trigger(this.token, 'token' + this.pass.capitalize()));
        }
        if (this.scene) {
            triggers.push(...this.getSceneTriggers(this.scene, 'scene' + this.pass.capitalize()));
            triggers.push(...this.getNearbyTriggers(this.scene, 'nearby' + this.pass.capitalize()));
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new this.trigger(region, 'region' + this.pass.capitalize()));
            });
        }
        if (this.targets?.size) {
            this.targets.forEach(token => {
                if (!this.actor) return;
                if (CatEvent.hasCatFlag(token)) triggers.push(new this.trigger(token.document, 'target' + this.pass.capitalize(), {sourceToken: token.document}, this.distances));
                triggers.push(...this.getActorTriggers(token.actor, 'target' + this.pass.capitalize(), {sourceToken: token.document}, this.distances));
                token.document.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                    triggers.push(new this.trigger(region, 'target' + this.pass.capitalize(), {sourceToken: token.document}, this.distances));
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
        if (this.token && this.scene) {
            this.distances = {};
            this.scene.tokens.forEach(token => this.distances[token.id] = tokenUtils.getDistance(this.token, token));
        }
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
        if (this.token && this.scene) {
            this.distances = {};
            this.scene.tokens.forEach(token => this.distances[token.id] = tokenUtils.getDistance(this.token, token));
        }
    }
    appendData(data) {
        data = super.appendData(data);
        data.config = this.config;
        data.dialog = this.dialog;
        data.message = this.message;
        return data;
    }
}
class TokenDamageWorkflowEvent extends WorkflowEvent {
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
        this.distances = {};
        this.scene.tokens.forEach(token => this.distances[token.id] = tokenUtils.getDistance(this.token, token));
    }
    get unsortedTriggers() {
        let triggers = [];
        triggers.push(...this.getActorTriggers(this.actor, this.pass));
        this.groups.forEach(group => triggers.push(...this.getGroupTriggers(group, 'group' + this.pass.capitalize())));
        this.vehicles.forEach(vehicle => triggers.push(...this.getVehicleTriggers(vehicle, 'vehicle' + this.pass.capitalize())));
        this.encounters.forEach(encounter => triggers.push(...this.getEncounterTriggers(encounter, 'encounter' + this.pass.capitalize())));
        triggers.push(...this.getSceneTriggers(this.scene, 'scene' + this.pass.capitalize()));
        triggers.push(...this.getNearbyTriggers(this.scene, 'nearby' + this.pass.capitalize()));
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
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
            this.distances = {};
            this.scene.tokens.forEach(token => this.distances[token.id] = tokenUtils.getDistance(this.token, token));
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
            triggers.push(...this.getNearbyTriggers(this.scene, 'nearby' + this.pass.capitalize()));
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new Triggers.EffectTrigger(region, 'region' + this.pass.capitalize()));
            });
        }
        this.groups.forEach(group => triggers.push(...this.getGroupTriggers(group, 'group' + this.pass.capitalize())));
        this.vehicles.forEach(vehicle => triggers.push(...this.getVehicleTriggers(vehicle, 'vehicle' + this.pass.capitalize())));
        this.encounters.forEach(encounter => triggers.push(...this.getEncounterTriggers(encounter, 'encounter' + this.pass.capitalize())));
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
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
        this.distances = {};
        this.scene.tokens.forEach(token => this.distances[token.id] = tokenUtils.getDistance(this.token, token));
    }
    get unsortedTriggers() {
        let triggers = [];
        triggers.push(...this.getActorTriggers(this.actor, this.pass));
        if (this.scene) {
            triggers.push(...this.getSceneTriggers(this.scene, 'scene' + this.pass.capitalize()));
            triggers.push(...this.getNearbyTriggers(this.scene, 'nearby' + this.pass.capitalize()));
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new this.trigger(region, 'region' + this.pass.capitalize()));
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
class AuraEvent extends CatEvent {
    constructor(token, pass, {options, targetToken}) {
        super(pass);
        this.name = 'Aura';
        this.trigger = Triggers.AuraTrigger;
        this.token = token;
        this.actor = token.actor;
        this.regions = token.regions;
        this.scene = token.parent;
        this.groups = actorUtils.getGroups(this.actor);
        this.encounters = actorUtils.getEncounters(this.actor);
        this.vehicles = actorUtils.getVehicles(this.actor);
        this.options = options;
        this.distances = {};
        this.scene.tokens.forEach(token => {
            this.distances[token.id] = tokenUtils.getDistance(this.token, token);
        });
        this.targetToken = targetToken;
    }
    async run() {
        Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass);
        const removedEffects = [];
        const effects = actorUtils.getEffects(this.actor).filter(effect => effect.flags.cat?.auraEffect);
        await Promise.all(effects.map(async effect => {
            let identifier = documentUtils.getIdentifier(effect);
            if (!identifier) {
                removedEffects.push(effect);
                return;
            }
            let origin = await fromUuid(effect.origin);
            if (!origin) {
                removedEffects.push(effect);
                return;
            }
            let originIdentifier = documentUtils.getIdentifier(origin);
            if (!originIdentifier) {
                removedEffects.push(effect);
                return;
            }
            const trigger = this.sortedTriggers.find(trigger => trigger.identifier === originIdentifier);
            if (!trigger) {
                removedEffects.push(effect);
                return;
            }
            if (trigger.document.uuid != effect.origin) removedEffects.push(effect);
        }));
        if (removedEffects.length) await documentUtils.deleteEmbeddedDocuments(this.actor, 'ActiveEffect', removedEffects.map(effect => effect.id));
        const effectDatas = [];
        const results = [];
        for (let trigger of this.sortedTriggers) {
            let result;
            if (typeof trigger.macro === 'string') {
                Logging.addEntry('DEBUG', 'Executing Embedded Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                result = await this.executeScript(trigger.macro, trigger);
            } else {
                Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macro.name + ' from ' + trigger.name);
                try {
                    result = await trigger.macro(trigger);
                } catch (error) {
                    Logging.addMacroError(error);
                }
            }
            if (result) {
                if (result.effectData) {
                    genericUtils.setProperty(result.effectData, 'flags.cat.auraEffect', true);
                    genericUtils.setProperty(result.effectData, 'origin', trigger.document.uuid);
                    genericUtils.setProperty(result.effectData, 'flags.cat.identifier', trigger.identifier + 'Aura');
                    effectDatas.push(result.effectData);
                }
                results.push(result);
            }
        }
        if (effectDatas.length) await effectUtils.createEffects(this.actor, effectDatas);
        return results;
    }
    get unsortedTriggers() {
        let triggers = this.getNearbyTriggers(this.scene, this.pass);
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
    appendData(data) {
        data = super.appendData(data);
        data.targetToken = this.targetToken;
        data.options = this.options;
        return data;
    }
}
class ItemEvent extends CatEvent {
    constructor(item, pass, {options, updates}) {
        super(pass);
        this.name = 'Item';
        this.trigger = Triggers.ItemTrigger;
        this.item = item;
        this.actor = this.item.actor;
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
        if (CatEvent.hasCatFlag(this.item)) triggers.push(new Triggers.ItemTrigger(this.item, this.pass));
        triggers.push(...this.getActorTriggers(this.actor, 'actor' + this.pass.capitalize()));
        if (this.scene) {
            triggers.push(...this.getSceneTriggers(this.scene, 'scene' + this.pass.capitalize()));
            triggers.push(...this.getNearbyTriggers(this.scene, 'nearby' + this.pass.capitalize()));
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new Triggers.EffectTrigger(region, 'region' + this.pass.capitalize()));
            });
        }
        this.groups.forEach(group => triggers.push(...this.getGroupTriggers(group, 'group' + this.pass.capitalize())));
        this.vehicles.forEach(vehicle => triggers.push(...this.getVehicleTriggers(vehicle, 'vehicle' + this.pass.capitalize())));
        this.encounters.forEach(encounter => triggers.push(...this.getEncounterTriggers(encounter, 'encounter' + this.pass.capitalize())));
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
    appendData(data) {
        data = super.appendData(data);
        data.options = this.options;
        data.updates = this.updates;
        return data;
    }
}
class ItemsEvent extends CatEvent {
    constructor(items, pass, {ddbCharacter} = {}) {
        super(pass);
        this.name = 'Item';
        this.trigger = Triggers.ItemTrigger;
        this.items = items;
        this.ddbCharacter = ddbCharacter;
    }
    get unsortedTriggers() {
        let triggers = [];
        this.items.forEach(item => {
            if (CatEvent.hasCatFlag(item)) triggers.push(new Triggers.ItemTrigger(item, this.pass));
        });
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
    appendData(data) {
        super.appendData(data);
        data.ddbCharacter = this.ddbCharacter;
        return data;
    }
    get sortedTriggers() {
        if (this._sortedTriggers) return this._sortedTriggers;
        const startTime = performance.now();
        let unsortedTriggers = this.unsortedTriggers;
        let sortedTriggers = [];
        unsortedTriggers.forEach(trigger => {
            [...trigger.fnMacros, ...trigger.embeddedMacros].forEach(fnMacro => {
                fnMacro.macros.forEach(macro => {
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
        this._sortedTriggers = sortedTriggers;
        return this._sortedTriggers;
    }
}
export const Events = {
    WorkflowEvent,
    PreTargetingWorkflowEvent,
    TokenDamageWorkflowEvent,
    MovementEvent,
    RegionEvent,
    EffectEvent,
    CombatEvent,
    AuraEvent,
    ItemEvent,
    ItemsEvent
};