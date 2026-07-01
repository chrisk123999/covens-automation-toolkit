import {actorUtils, documentUtils, effectUtils, genericUtils, tokenUtils} from '../utilities/_module.mjs';
import * as utils from '../utilities/_module.mjs';
import {Triggers, Logging, constants} from '../lib/_module.mjs';
class CatEvent {
    constructor(pass) {
        this.pass = pass;
        this.trigger;
        this._sortedTriggers;
        this.multiResult = false;
    }
    setContext(actor, {token} = {}) {
        this.actor = actor;
        this.token = token || (this.actor ? actorUtils.getFirstToken(this.actor) : undefined);
        this.groups = this.actor ? actorUtils.getGroups(this.actor) : [];
        this.encounters = this.actor ? actorUtils.getEncounters(this.actor) : [];
        this.vehicles = this.actor ? actorUtils.getVehicles(this.actor) : [];
        if (this.token) {
            this.scene = this.token.parent;
            this.regions = this.token.regions;
        }
        this.distances = {};
        if (this.token && this.scene) {
            this.scene.tokens.forEach(t => this.distances[t.id] = tokenUtils.getDistance(this.token, t));
            this.level = this.scene.levels.get(this.token.level);
        }
    }
    buildScriptFunction(script, scope) {
        const defaultScope = {
            ...utils,
            constants
        };
        scope = {...defaultScope, ...scope};
        let argNames = Object.keys(scope);
        if (argNames.some(k => Number.isNumeric(k))) throw new Error('Illegal numeric Macro parameter passed to execution scope.');
        return {
            fn: new foundry.utils.AsyncFunction(...argNames, '{' + script + '}\n'),
            argValues: Object.values(scope)
        };
    }
    buildSyncScriptFunction(script, scope) {
        const defaultScope = {
            ...utils,
            constants
        };
        scope = {...defaultScope, ...scope};
        let argNames = Object.keys(scope);
        if (argNames.some(k => Number.isNumeric(k))) throw new Error('Illegal numeric Macro parameter passed to execution scope.');
        return {
            fn: new Function(...argNames, '{' + script + '}\n'),
            argValues: Object.values(scope)
        };
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
            vehicles: this.vehicles,
            level: this.level
        };
    }
    getActorTriggers(actor, pass, data) {
        const triggers = [];
        if (CatEvent.hasCatFlag(actor)) triggers.push(new this.trigger(actor, pass, data));
        if (this.token && CatEvent.hasCatFlag(this.token)) triggers.push(new this.trigger(this.token, pass, data));
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
    getLevelTriggers(level, pass, data) {
        const triggers = [];
        if (CatEvent.hasCatFlag(level)) triggers.push(new this.trigger(level, pass, data));
        level.parent.tokens.filter(token => token.level === level.id).forEach(token => {
            if (!token.actor) return;
            if (CatEvent.hasCatFlag(token)) triggers.push(new this.trigger(token, pass, {...data, targetToken: token, distances: this.distances, token: this.token}));
            triggers.push(...this.getActorTriggers(token.actor, pass, {...data, targetToken: token, distances: this.distances, token: this.token}));
        });
        return triggers;
    }
    get sortedTriggers() {
        if (this._sortedTriggers) return this._sortedTriggers;
        const startTime = performance.now();
        const unsortedTriggers = this.unsortedTriggers;
        let winningTriggers = new Set();
        if (!this.canOverlap) {
            const names = new Set(unsortedTriggers.map(trigger => trigger.name));
            const groupedTriggers = {};
            names.forEach(name => {
                groupedTriggers[name] = unsortedTriggers.filter(trigger => trigger.name === name);
            });
            names.forEach(name => {
                let maxLevel = Math.max(...groupedTriggers[name].map(trigger => trigger.castData.castLevel));
                let maxDC = Math.max(...groupedTriggers[name].map(trigger => trigger.castData.saveDC));
                let maxDCTrigger = groupedTriggers[name].find(trigger => trigger.castData.saveDC === maxDC);
                let selectedTrigger;
                if (maxDCTrigger.castData.castLevel === maxLevel) {
                    selectedTrigger = maxDCTrigger;
                } else {
                    selectedTrigger = groupedTriggers[name].find(j => j.castData.castLevel === maxLevel);
                }
                winningTriggers.add(selectedTrigger);
            });

        } else {
            unsortedTriggers.forEach(trigger => winningTriggers.add(trigger));
        }
        let sortedTriggers = [];
        let uniqueMacros = new Set();
        unsortedTriggers.forEach(trigger => {
            const isWinner = winningTriggers.has(trigger);
            [...trigger.fnMacros, ...trigger.embeddedMacros].forEach(i => {
                i.macros.forEach(macro => {
                    if (!isWinner && !macro.canOverlap) return;
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
                        name: trigger.name,
                        macroClass: i,
                        macroConfig: macro,
                        macroName: macro.macro.name ?? i.name
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
        let triggers = [];
        const passName = this.pass.capitalize();
        if (this.actor) triggers.push(...this.getActorTriggers(this.actor, 'actor' + passName));
        if (this.scene) {
            triggers.push(...this.getSceneTriggers(this.scene, 'scene' + passName));
            triggers.push(...this.getNearbyTriggers(this.scene, 'nearby' + passName));
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new this.trigger(region, 'region' + passName));
            });
        }
        if (this.level) triggers.push(...this.getLevelTriggers(this.level, 'level' + passName));
        this.groups.forEach(group => triggers.push(...this.getGroupTriggers(group, 'group' + passName)));
        this.vehicles.forEach(vehicle => triggers.push(...this.getVehicleTriggers(vehicle, 'vehicle' + passName)));
        this.encounters.forEach(encounter => triggers.push(...this.getEncounterTriggers(encounter, 'encounter' + passName)));
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
    static hasCatFlag(document) {
        return !!(document.flags?.cat?.macros || document.flags?.cat?.embeddedMacros);
    }
    async run({canOverlap = false, multiResult = false} = {}) {
        if (!this.actor) return;
        Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass + ' for ' + this.actor.name);
        this.canOverlap = canOverlap;
        this.multiResult = multiResult;
        this._debugEvent();
        const results = this.multiResult ? [] : undefined;
        for (let trigger of this.sortedTriggers) {
            let result;
            if (typeof trigger.macro === 'string') {
                Logging.addEntry('DEBUG', 'Executing Embedded Macro: ' + trigger.macroName + ' from ' + trigger.name);
                result = await this.executeScript(trigger.macro, trigger);
            } else {
                Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macroName + ' from ' + trigger.name);
                try {
                    result = await trigger.macro(trigger);
                } catch (error) {
                    Logging.addMacroError(trigger, error);
                }
            }
            if (result) {
                if (!this.multiResult) {
                    return result;
                } else {
                    results.push(result);
                }
            }
        }
        return results;
    }
    runSync({canOverlap = false, multiResult = false} = {}) {
        Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass);
        this.canOverlap = canOverlap;
        this.multiResult = multiResult;
        this._debugEvent();
        const results = this.multiResult ? [] : undefined;
        for (let trigger of this.sortedTriggers) {
            let result;
            if (typeof trigger.macro === 'string') {
                Logging.addEntry('DEBUG', 'Executing Embedded Macro: ' + trigger.macroName + ' from ' + trigger.name);
                result = this.executeScriptSync(trigger.macro, trigger);
            } else {
                Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macroName + ' from ' + trigger.name);
                try {
                    result = trigger.macro(trigger);
                } catch (error) {
                    Logging.addMacroError(trigger, error);
                }
            }
            if (result) {
                if (!this.multiResult) {
                    return result;
                } else {
                    results.push(result);
                }
            }
        }
        return results;
    }
    async executeScript(script, scope) {
        const {fn, argValues} = this.buildScriptFunction(script, scope);
        try {
            return await fn(...argValues);
        } catch (error) {
            Logging.addEmbeddedMacroError(scope, error);
        }
    }
    executeScriptSync(script, scope) {
        const {fn, argValues} = this.buildSyncScriptFunction(script, scope);
        try {
            return fn(...argValues);
        } catch (error) {
            Logging.addEmbeddedMacroError(scope, error);
        }
    }
    _debugEvent() {
        if (!game.settings.get('cat', 'displayDebugEventData')) return;
        let sample = this.sortedTriggers[0];
        if (!sample) {
            sample = this.appendData({
                name: 'Developer Sample Trigger',
                identifier: 'developerSample',
                priority: 50,
                macroConfig: {pass: this.pass, priority: 50},
                document: null,
                macro: function() {},
                castData: {castLevel: 10, saveDC: 10},
                macroClass: null
            });
        }
        console.log(sample);
    }
}
class BaseWorkflowEvent extends CatEvent {
    constructor(pass, workflow) {
        super(pass);
        this.name = 'Workflow';
        this.trigger = Triggers.RollTrigger;
        if (workflow?.targets) this.targets = workflow.targets.map(token => token.document);
    }
    get unsortedTriggers() {
        let triggers = [];
        const passName = this.pass.capitalize();
        if (this.activity && CatEvent.hasCatFlag(this.activity)) triggers.push(new this.trigger(this.activity, 'activity' + passName));
        if (this.item) {
            if (CatEvent.hasCatFlag(this.item)) triggers.push(new this.trigger(this.item, 'item' + passName));
            this.item.effects.filter(effect => effect.type === 'enchantment' && effect.isAppliedEnchantment && CatEvent.hasCatFlag(effect)).forEach(effect => {
                triggers.push(new this.trigger(effect, 'enchantment' + passName));
            });
            const cachedForUuid = this.item.flags.dnd5e?.cachedFor;
            if (cachedForUuid && this.actor) {
                const castActivity = fromUuidSync(cachedForUuid, {relative: this.actor});
                if (castActivity && CatEvent.hasCatFlag(castActivity)) triggers.push(new this.trigger(castActivity, 'castEnchantment' + passName, {sourceItem: this.item}));
            }
        }
        if (this.actor) triggers.push(...this.getActorTriggers(this.actor, 'actor' + passName));
        if (this.token && CatEvent.hasCatFlag(this.token)) triggers.push(new this.trigger(this.token, 'token' + passName));
        if (this.scene) {
            triggers.push(...this.getSceneTriggers(this.scene, 'scene' + passName));
            triggers.push(...this.getNearbyTriggers(this.scene, 'nearby' + passName));
        }
        if (this.regions) {
            this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                triggers.push(new this.trigger(region, 'region' + passName));
            });
        }
        if (this.level) triggers.push(...this.getLevelTriggers(this.level, 'level' + passName));
        if (this.targets?.size) {
            this.targets.forEach(token => {
                if (!token.actor) return;
                if (CatEvent.hasCatFlag(token)) triggers.push(new this.trigger(token, 'target' + passName, {sourceToken: token, distances: this.distances}));
                triggers.push(...this.getActorTriggers(token.actor, 'target' + passName, {sourceToken: token, distances: this.distances}));
                token.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
                    triggers.push(new this.trigger(region, 'target' + passName, {sourceToken: token, distances: this.distances}));
                });
            });
        }
        if (this.groups.length) {
            this.groups.forEach(group => {
                triggers.push(...this.getGroupTriggers(group, 'group' + passName));
            });
        }
        if (this.encounters.length) {
            this.encounters.forEach(encounter => {
                triggers.push(...this.getEncounterTriggers(encounter, 'encounter' + passName));
            });
        }
        if (this.vehicles.length) {
            this.vehicles.forEach(vehicle => {
                triggers.push(...this.getVehicleTriggers(vehicle, 'vehicle' + passName));
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
        this.setContext(workflow.actor, {token: workflow.token?.document});
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
    constructor(pass, {activity, token, config, dialog, message} = {}) {
        super(pass);
        this.activity = activity;
        this.item = activity.item;
        this.config = config;
        this.dialog = dialog;
        this.message = message;
        this.setContext(this.item?.actor, {token: token?.document});
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            config: this.config,
            dialog: this.dialog,
            message: this.message
        };
    }
}
class TokenDamageWorkflowEvent extends WorkflowEvent {
    constructor(pass, workflow, token, ditem) {
        super(pass, workflow);
        this.ditem = ditem;
        this.targetToken = token?.document;
        this.targets = new Set([token.document]);
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            ditem: this.ditem,
            targetToken: this.targetToken
        };
    }
}
class MovementEvent extends CatEvent {
    constructor(token, pass, {options, destination, animation, range, sourceToken, action, teleport} = {}) {
        super(pass);
        this.name = 'Movement';
        this.trigger = Triggers.MoveTrigger;
        this.options = options;
        this.destination = destination;
        this.animation = animation;
        this.range = range;
        this.sourceToken = sourceToken;
        this.setContext(token.actor, {token});
        this.action = action ?? options?.cat?.movement?.action;
        this.teleport = teleport ?? options?.cat?.movement?.teleport;
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            options: this.options,
            destination: this.destination,
            animation: this.animation,
            range: this.range,
            sourceToken: this.sourceToken,
            teleport: this.teleport,
            action: this.action
        };
    }
}
class RegionEvent extends CatEvent {
    constructor(regions, pass, {tokens, workflow, options, updates, locationData} = {}) {
        super(pass);
        this.name = 'Region';
        this.trigger = Triggers.RegionTrigger;
        this.regions = regions;
        this.tokens = tokens;
        this.workflow = workflow;
        this.options = options;
        this.updates = updates;
    }
    get unsortedTriggers() {
        let triggers = [];
        this.regions.filter(region => CatEvent.hasCatFlag(region)).forEach(region => {
            triggers.push(new Triggers.RegionTrigger(region, this.pass, {tokens: this.tokens, workflow: this.workflow, options: this.options, updates: this.updates}));
        });
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
    async run() {
        if (this.regions.length > 1) {
            Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass + ' for ' + this.regions.length + ' regions');
        } else {
            Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass + ' for ' + this.regions[0].name);
        }
        this._debugEvent();
        for (let trigger of this.sortedTriggers) {
            if (typeof trigger.macro === 'string') {
                Logging.addEntry('DEBUG', 'Executing Embedded Macro: ' + trigger.macroName + ' from ' + trigger.name);
                await this.executeScript(trigger.macro, trigger);
            } else {
                Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macroName + ' from ' + trigger.name);
                try {
                    await trigger.macro(trigger);
                } catch (error) {
                    Logging.addMacroError(error);
                }
            }
        }
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            tokens: this.tokens,
            workflow: this.workflow,
            options: this.options,
            updates: this.updates
        };
    }
}
class EffectEvent extends CatEvent {
    constructor(effect, pass, {options, updates, parent} = {}) {
        super(pass);
        this.name = 'Effect';
        this.trigger = Triggers.EffectTrigger;
        this.effect = effect;
        if (!parent) {
            if (effect.parent instanceof Actor) {
                this.actor = effect.parent;
            } else if (effect.parent instanceof Item) {
                this.item = effect.parent;
                this.actor = this.item.actor;
            }

        } else if (parent instanceof Actor) {
            this.actor = parent;
        } else if (parent instanceof Item) {
            this.item = parent;
            this.actor = parent.actor;
        }
        this.options = options;
        this.updates = updates;
        this.setContext(this.actor);
    }
    get unsortedTriggers() {
        let triggers = [];
        if (CatEvent.hasCatFlag(this.effect)) triggers.push(new Triggers.EffectTrigger(this.effect, this.pass));
        triggers.push(...super.unsortedTriggers);
        return triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            effect: this.effect,
            options: this.options,
            updates: this.updates
        };
    }
}
class CombatEvent extends CatEvent {
    constructor(combat, pass, token, {context, combatant, previousCombatant, round, turn, previousRound, previousTurn} = {}) {
        super(pass);
        this.name = 'Combat';
        this.trigger = Triggers.CombatTrigger;
        this.combat = combat;
        this.combatant = combatant;
        this.previousCombatant = previousCombatant;
        this.context = context;
        this.round = round;
        this.turn = turn;
        this.previousRound = previousRound;
        this.previousTurn = previousTurn;
        this.setContext(token.actor, {token});
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            context: this.context,
            combatant: this.combatant,
            previousCombatant: this.previousCombatant,
            round: this.round,
            turn: this.turn,
            previousRound: this.previousRound,
            previousTurn: this.previousTurn
        };
    }
}
class AuraEvent extends CatEvent {
    constructor(token, pass, {options, targetToken} = {}) {
        super(pass);
        this.name = 'Aura';
        this.trigger = Triggers.AuraTrigger;
        this.multiResult = true;
        this.options = options;
        this.targetToken = targetToken;
        this.setContext(token.actor, {token});
    }
    async run() {
        Logging.addEntry('DEBUG', 'Executing ' + this.name + ' event for pass ' + this.pass);
        this._debugEvent();
        if (!this.actor) return;
        const removedEffects = [];
        const effects = actorUtils.getEffects(this.actor).filter(effect => effect.flags.cat?.auraEffect);
        await Promise.all(effects.map(async effect => {
            let identifier = documentUtils.getIdentifier(effect);
            if (!identifier || !effect.origin) {
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
                Logging.addEntry('DEBUG', 'Executing Embedded Macro: ' + trigger.macroName + ' from ' + trigger.name);
                result = await this.executeScript(trigger.macro, trigger);
            } else {
                Logging.addEntry('DEBUG', 'Executing Macro: ' + trigger.macroName + ' from ' + trigger.name);
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
        if (!this.scene) return [];
        let triggers = this.getNearbyTriggers(this.scene, this.pass, {targetToken: this.targetToken, options: this.options});
        triggers = triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
        return triggers;
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            targetToken: this.targetToken,
            options: this.options
        };
    }
}
class ItemEvent extends CatEvent {
    constructor(item, pass, {options, updates} = {}) {
        super(pass);
        this.name = 'Item';
        this.trigger = Triggers.ItemTrigger;
        this.item = item;
        this.options = options;
        this.updates = updates;
        this.setContext(this.item.actor);
    }
    get unsortedTriggers() {
        let triggers = [];
        if (CatEvent.hasCatFlag(this.item)) triggers.push(new Triggers.ItemTrigger(this.item, this.pass));
        triggers.push(...super.unsortedTriggers);
        return triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            options: this.options,
            updates: this.updates
        };
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
        return triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            ddbCharacter: this.ddbCharacter
        };
    }
}
class RestEvent extends CatEvent {
    constructor(actor, pass, {result, config} = {}) {
        super(pass);
        this.name = 'Rest';
        this.trigger = Triggers.RestTrigger;
        this.result = result;
        this.config = config;
        this.setContext(actor);
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            result: this.result,
            config: this.config
        };
    }
}
class BaseRollEvent extends CatEvent {
    constructor(actor, pass, {config, dialog, message, roll} = {}) {
        super(pass);
        this.config = config;
        this.dialog = dialog;
        this.message = message;
        this.roll = roll;
        this.setContext(actor);
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            config: this.config,
            dialog: this.dialog,
            message: this.message,
            roll: this.roll
        };
    }
}
class CheckEvent extends BaseRollEvent {
    constructor(actor, pass, data) {
        super(actor, pass, data);
        this.name = 'Check';
        this.trigger = Triggers.CheckTrigger;
    }
}
class SkillEvent extends BaseRollEvent {
    constructor(actor, pass, data) {
        super(actor, pass, data);
        this.name = 'Skill';
        this.trigger = Triggers.SkillTrigger;
    } 
}
class SaveEvent extends BaseRollEvent {
    constructor(actor, pass, data) {
        super(actor, pass, data);
        this.name = 'Save';
        this.trigger = Triggers.SaveTrigger;
    } 
}
class ToolEvent extends BaseRollEvent {
    constructor(actor, pass, data) {
        super(actor, pass, data);
        this.name = 'Tool';
        this.trigger = Triggers.ToolTrigger;
    } 
}
class TimeEvent extends CatEvent {
    constructor(actor, pass, {worldTime, diff, options} = {}) {
        super(pass);
        this.name = 'Time';
        this.trigger = Triggers.TimeTrigger;
        this.worldTime = worldTime;
        this.diff = diff;
        this.options = options;
        this.setContext(actor);
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            worldTime: this.worldTime,
            diff: this.diff,
            options: this.options
        };
    }
}
class SummonEvent extends CatEvent {
    constructor(summon, pass, {updates} = {}) {
        super(pass);
        this.name = 'Summon';
        this.trigger = Triggers.SummonTrigger;
        this.updates = updates;
        this.setContext(summon.owner);
        this.summon = summon;
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            updates: this.updates,
            summon: this.summon
        };
    }
    get unsortedTriggers() {
        let triggers = [];
        if (this.summon.sourceDocument && CatEvent.hasCatFlag(this.summon.sourceDocument)) {
            triggers.push(new this.trigger(this.summon.sourceDocument, this.pass));
        }
        triggers.push(...super.unsortedTriggers);
        return triggers.filter(trigger => trigger.fnMacros.length || trigger.embeddedMacros.length);
    }
}
class CalledEvent extends CatEvent {
    constructor(actor, pass, data) {
        super(pass);
        this.name = 'Called';
        this.trigger = Triggers.CalledTrigger;
        this.data = data;
        this.setContext(actor);
    }
    appendData(data) {
        return {
            ...super.appendData(data),
            data: this.data
        };
    }
}
export default {
    WorkflowEvent,
    PreTargetingWorkflowEvent,
    TokenDamageWorkflowEvent,
    MovementEvent,
    RegionEvent,
    EffectEvent,
    CombatEvent,
    AuraEvent,
    ItemEvent,
    ItemsEvent,
    RestEvent,
    CheckEvent,
    SkillEvent,
    SaveEvent,
    ToolEvent,
    TimeEvent,
    SummonEvent,
    CalledEvent
};