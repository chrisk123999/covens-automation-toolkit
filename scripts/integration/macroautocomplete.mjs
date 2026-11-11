import {ddbi} from '../integration/_modules.mjs';
import {constants, D20Bonus, DamageBonus, Events, Logging, Summon} from '../lib/_module.mjs';

// reference https://gitlab.com/tposney/midi-qol/-/blob/v13/src/module/lib/midiCompletions.ts#L969

const variable = (detail, info) => ({type: 'variable', detail, info: makeInfo(info)});
const property = (detail, info) => ({type: 'property', detail, info: makeInfo(info)});
const makeInfo = msg => msg ? `CAT Data: ${msg}` : '';
const fnDetails = (fnEntry, params, info) => {
    fnEntry.detail = params;
    fnEntry.info = makeInfo(info);
};
const classCompletion = (api, cls, path, info) => {
    let completion = api.tree.cat;
    path = path.split('.');
    for (const key of path) {
        completion = completion?.children?.[key];
        if (!completion) break;
    }
    completion ??= api.classToCompletions(cls);
    completion.info = makeInfo(info);
    if (!completion.constructorDetail) {
        const ctor = Object.getPrototypeOf(cls).toString().match(/constructor\s*\(([^)]*)\)/);
        if (ctor) completion.constructorDetail = `(${ctor[1].trim()}) => ${cls.name}`;
    }
    return completion;
};
const classInstance = (api, cls, info) => {
    let walked = api.tree[cls.name];
    if (!walked) {
        walked = CLASS_CACHE[cls.name] ?? api.classToCompletions(cls);
        CLASS_CACHE[cls.name] ??= walked;
    }
    const v = variable(cls.name, info);
    api.mergeCompletions(v, walked.instanceChildren);
    return v;
};
const propertyClassInstance = (api, cls, info) => {
    const prop = classInstance(api, cls, info);
    prop.type = 'property';
    return prop;
};
const cls = (key) => {
    switch (key) {
        case 'activeeffect': return CONFIG.ActiveEffect.documentClass;
        case 'combatant': return CONFIG.Combatant.documentClass;
        case 'document': return foundry.abstract.Document;
        case 'folder': return CONFIG.Folder.documentClass;
        case 'region': return CONFIG.Region.documentClass;
        case 'actor': return CONFIG.Actor.documentClass;
        case 'token': return CONFIG.Token.documentClass;
        case 'scene': return CONFIG.Scene.documentClass;
        case 'level': return CONFIG.Level.documentClass;
        case 'item': return CONFIG.Item.documentClass;
        case 'd20': return CONFIG.Dice.D20Roll;
        default: return {name: 'INVALID'};
    }
};
const alias = (api, base, info) => {
    const original = api.tree[base];
    const c = cls(base);
    if (original) {
        const aliased = {...original, info: makeInfo(info)};
        if (c.name !== 'INVALID') aliased.detail = c.name;
        return aliased;
    }
    if (c.name === 'INVALID') return variable(base, info);
    return classInstance(api, c, info);
};

const OUT_OF_SCOPE = ['args', 'macroActivity', 'macroItem', 'midiData', 'scope', 'speaker'];
const CLASS_CACHE = {};

const VARS = {
    // General
    encounters: () => variable(`${cls('actor').name}[]`, 'Any encounter actors that include the trigger actor.'),
    distances: () => variable('object', 'Distances to other tokens on the scene, mapped by their token id.'),
    vehicles: () => variable(`${cls('actor').name}[]`, 'Any vehicle actors that include the trigger actor.'),
    groups: () => variable(`${cls('actor').name}[]`, 'Any group actors that include the trigger actor.'),
    regions: () => variable(`Set<${cls('region').name}>`, 'Any regions containing the trigger token.'),
    level: (api) => classInstance(api, cls('level'), 'The scene level of the trigger token.'),
    scene: (api) => classInstance(api, cls('scene'), 'The scene for the trigger token.'),

    // Shared
    config: (_, {event}) => variable('object', INFO.config[event]),
    dialog: (_, {event}) => variable('object', INFO.dialog[event]),
    message: (_, {event}) => variable('object', INFO.message[event]),
    updates: (_, {event}) => variable('object', INFO.updates[event]),
    targetToken: (api, {event}) => classInstance(api, cls('token'), INFO.targetToken[event]),
    DamageBonus: (api) => classCompletion(api, DamageBonus, 'lib.DamageBonus', 'Used in optional bonus prompts.'),
    D20Bonus: (api) => classCompletion(api, D20Bonus, 'lib.D20Bonus', 'Used in optional bonus prompts.'),

    // CheckHits
    attackTotal: () => variable('number', 'Attack roll total plus bonuses granted by this target.'),
    hitData: () => ({
        ...variable('Object', 'Live copy of hit data for this target.'),
        children: {
            ac: property('number', 'Current AC for this target on this attack, including bonuses from midi and other previous macros.'),
            isHit: property('boolean', 'Change to override the hit result.'),
            isHitEC: property('boolean', 'Change to override hit result.')
        }
    }),

    // Damage
    ditem: () => variable('object', 'Live copy of workflow.damageItem.'),

    // Region
    tokens: () => variable(`${cls('token').name}[]`, 'Tokens in the trigger region.'),

    // Effect
    effect: (api) => classInstance(api, cls('activeeffect'), 'The trigger ActiveEffect.'),

    // Combat
    combatant: (api) => classInstance(api, cls('combatant'), 'Current combatant.'),
    previousCombatant: (api) => classInstance(api, cls('combatant'), 'Previous combatant.'),
    previousRound: () => variable('number', 'Previous combat round.'),
    previousTurn: () => variable('number', 'Previous combat turn.'),
    round: () => variable('number', 'Current combat round.'),
    turn: () => variable('number', 'Current combat turn.'),
    context: () => variable('object', 'Combat event context.'),

    // Items
    ddbCharacter: (api) => {
        let ddb = game.modules.get(ddbi.CONFIG.id);
        if (ddb) return classInstance(api, ddb.api.lib.DDBCharacter, 'DDBI character helpers.');
        return variable('object', 'DDBI is not installed!');
    },

    //Aura
    source: (api) => classInstance(api, cls('actor'), 'The actor projecting the aura.'),
    target: (api) => classInstance(api, cls('actor'), 'The actor tested against the aura.'),
    descriptor: () => variable('object', 'The aura descriptor returned by the bound aura generic.'),
    distance: () => variable('number', 'Edge to edge distance between the source and target tokens.'),

    // Rest
    result: () => variable('object', 'Changes to apply from rest.'),

    // Check / Skill / Save / Tool
    roll: (api) => classInstance(api, cls('d20'), 'The trigger roll.'),

    // Time
    worldTime: () => variable('number', 'Current world time.'),
    diff: () => variable('number', 'Change in world time.'),

    // Summon
    summon: (api) => {
        const walked = api.tree.cat?.children.lib?.children.Summon ?? api.classToCompletions(Summon);
        if (!walked.enriched) {
            const summon = walked.instanceChildren;
            fnDetails(summon.getSourceActor, `() => Promise<${cls('actor').name}>`, 'Fetch the sidebar actor for this summon using summon.sourceActorUuid.');
            fnDetails(summon.getTimeRemaining, `(worldTime) => number`, 'The remaining time before this summon expires. Pass in the current world time.');
            fnDetails(summon.place, `(range, {token} = {}) => Promise<${cls('token').name}>`, 'Place the summon within range of the specified token. Uses the summoner token by default. Returns the summoned token.');
            fnDetails(summon.recall, '() => Promise', 'Delete the summoned token.');
            summon.folder = propertyClassInstance(api, cls('folder'), 'The sidebar folder that holds the template actor for the summon.');
            summon.actor = propertyClassInstance(api, cls('actor'), 'The summoned actor.');
            summon.token = propertyClassInstance(api, cls('token'), 'The summoned token.');
            summon.owner = propertyClassInstance(api, cls('actor'), 'The summoner actor.');
            summon.ownerToken = propertyClassInstance(api, cls('token'), 'The summoner token.');
            summon.sourceDocument = propertyClassInstance(api, cls('document'), 'The document used to create the summon.');
            summon.sourceItem = propertyClassInstance(api, cls('item'), 'The item used to create the summon, or the item of the activity that did.');
            summon.parent = propertyClassInstance(api, cls('document'), 'The parent document of the summon, often a concentration effect.');
            summon.created = property('number', 'The world time when the summon was created.');
            summon.duration = property('number', 'The duration in world time this summon will last.');
            summon.parentUuid = property('string', 'Parent document uuid for this summon, often a concentration effect.');
            summon.sourceDocumentUuid = property('string', 'The uuid of the document used to create this summon.');
            summon.sourceActorUuid = property('string', 'Sidebar actor uuid for this summon.');
            summon.ownerUuid = property('string', 'Summoner actor uuid.');
            summon.animation = {
                ...property('object', 'Summon animation config.'),
                children: {
                    source: property('string', 'Identifier for animation source.'),
                    identifier: property('string', 'Identifier for registered animation.')
                }
            };
            summon.sounds = {
                ...property('object', 'Summon sound effects.'),
                children: {
                    place: property('string', 'Filepath for summon placed sound.'),
                    removed: property('string', 'Filepath for summon removed sound.'),
                    death: property('string', 'Filepath for summon death sound.')
                }
            };
            summon.initiative = property('string', 'Initiative mode for this summon: "standard" | "follows" | "none"');
            walked.enriched = true;
        }
        const v = variable('Summon', 'Summon data and helpers.');
        api.mergeCompletions(v, walked.instanceChildren);
        return v;
    },

    // Called & Grapple
    data: (api, {event, pass}) => {
        switch(event) {
            case 'called': return variable('object', 'Data provided by events called from macros.');
            case 'grapple': {
                const obj = variable('object', 'Live copy of data for this grapple event pass.');
                const isPass = (p, tgt) => p === tgt || p.toLowerCase().includes(tgt.toLowerCase());
                if (isPass(pass, constants.grapplePasses.sizeCheck)) return {
                    ...obj, children: {
                        identifier: property('string', 'Activity identifier: "grapple", "shove-prone", "shove-push".'),
                        size: property('number', 'Numeric size of the attacker.')
                    }
                };
                if (isPass(pass, constants.grapplePasses.preGrapple)) return {
                    ...obj, children: {
                        rules: property('string', '2014 or 2024.'),
                        dc: property('number', 'Save or check DC.'),
                        advantage: property('boolean', 'True grants the attacker advantage in the legacy grapple skill contest.'),
                        reach: property('number', 'A target shoved this distance from the attacker breaks their grapple.'),
                        sourceEffectData: property('object', 'Effect data for grapple attacker.'),
                        targetEffectData: property('object', 'Effect data for grapple target.')
                    }
                };
                if (isPass(pass, constants.grapplePasses.postGrapple)) return {
                    ...obj, children: {
                        rules: property('string', '2014 or 2024.'),
                        sourceEffect: propertyClassInstance(api, cls('activeeffect'), 'Created attacker grapple effect.'),
                        targetEffect: propertyClassInstance(api, cls('activeeffect'), 'Created target grapple effect.'),
                        escapeItem: propertyClassInstance(api, cls('item'), 'Grapple escape item on the target.')
                    }
                };
                if (isPass(pass, constants.grapplePasses.preEscape)) return {
                    ...obj, children: {
                        selected: {
                            ...property('object', 'Data about which grapple is being escaped.'),
                            children: {
                                dc: property('number', 'The stored DC for escaping a grapple. Leaving this undefined prompts a skill check.'),
                                effect: propertyClassInstance(api, cls('activeeffect'), 'The target grapple active effect chosen for this escape attempt.')
                            }
                        }
                    }
                };
                if (isPass(pass, constants.grapplePasses.postEscape)) return {
                    ...obj, children: {
                        effect: propertyClassInstance(api, cls('activeeffect'), 'The target grapple active effect chosen for this escape attempt.'),
                        remaining: property('({dc, effect})[]', 'Data for other remaining grapples on the escaping target.')
                    }
                };
                return obj;
            }
        }
    },

    // Movement
    destination: () => ({
        ...variable('Object', 'Data about chosen crosshair coordinates.'),
        children: {
            x: property('number', 'Position in pixel coordinates.'),
            y: property('number', 'Position in pixel coordinates.'),
            name: property('string')
        }
    }),
    animation: () => ({
        ...variable('object', 'Animation data for movement.'),
        children: {
            source: property('string', 'Identifier for animation source.'),
            identifier: property('string', 'Identifier for registered animation.')
        }
    }),
    range: () => variable('number', 'Distance or range limit for movement.'),
    sourceToken: (api) => classInstance(api, cls('token'), 'Token that initiated a displace or slide.'),
    action: () => variable('string', 'One of CONFIG.Token.movement.actions.'),
    teleport: () => variable('boolean', 'Trigger was a teleport')
};

const OVERRIDES = {
    options: (_, {event}) => ({info: makeInfo(INFO.options[event])}),
    actor: (_, {event}) => ({info: makeInfo(INFO.actor[event] || INFO.actor.none)}),
    item: () => ({info: makeInfo('The item for this workflow.')}),
    activity: () => ({info: makeInfo('The activity for this workflow.')}),
    token: (api, {event}) => classInstance(api, cls('token'), INFO.token[event] || INFO.token.none)
};

const INFO = {
    options: {
        none: 'Event options.',
        move: 'Move event options.',
        region: 'Region event options.',
        effect: 'Effect event options.',
        item: 'Item event options.',
        time: 'Time event options.'
    },
    actor: {
        none: 'The trigger actor.'
    },
    token: {
        none: 'The trigger token.'
    },
    updates: {
        none: 'Updates.',
        region: 'Region updates.',
        effect: 'Effect updates.',
        item: 'Item updates.',
        summon: 'Summon updates.'
    },
    targetToken: {
        none: 'Target Token.',
        roll: 'The hit or damaged token.',
        aura: 'The token tested against the aura.',
        grapple: 'The token attempting to avoid or escape a grapple or shove.'
    },
    config:{
        none: 'Configuration.',
        roll: 'Item roll configuration.',
        rest: 'Rest configuration.',
        check: 'Dice roll configuration.',
        save: 'Dice roll configuration.',
        skill: 'Dice roll configuration.',
        tool: 'Dice roll configuration.',
        hitDie: 'Dice roll configuration.'
    },
    dialog: {
        none: 'Dialog configuration.',
        roll: 'Item roll dialog configuration.',
        check: 'Dice roll dialog configuration.',
        save: 'Dice roll dialog configuration.',
        skill: 'Dice roll dialog configuration.',
        tool: 'Dice roll dialog configuration.',
        hitDie: 'Dice roll dialog configuration.'
    },
    message: {
        none: 'Message configuration.',
        roll: 'Item roll message configuration.',
        check: 'Dice message configuration.',
        save: 'Dice message configuration.',
        skill: 'Dice message configuration.',
        tool: 'Dice message configuration.',
        hitDie: 'Dice message configuration.'
    }
};

function registerCAT({mergeCompletions, objectToCompletions, rebuildSignatureMap, tree}) {
    if (!globalThis.cat || !!tree.cat) return;
    tree.cat = {type: 'object', detail: 'object', info: _loc('CAT.Manual.MethodLabel')};
    const members = objectToCompletions(globalThis.cat, 3);
    mergeCompletions(tree.cat, members);
    rebuildSignatureMap();
    Logging.addEntry('DEBUG', `macro-autocomplete integration finished with ${Object.keys(members).length} members`);
}

function inContext(config, context, docType) {
    const autocomplete = game.modules.get('macro-autocomplete')?.api;
    if (!autocomplete) return;
    const codeMirror = context.element.querySelector('code-mirror');
    if (!codeMirror) return;
    const baseTree = autocomplete.tree;
    const tree = baseTree.cat?.children;
    if (!tree) return;
    const completions = {
        ...tree.utils?.children,
        constants: tree.lib?.children.constants,
        document: alias(autocomplete, docType, 'The document from which this macro was fetched.'),
        name: variable('string', 'The name of the document from which this macro was fetched.'),
        identifier: variable('string', 'The identifier of this macro.'),
        priority: variable('number', 'The priority of this macro.'),
        macroName: variable('string', 'The name of this macro.'),
        macro: variable('string', 'This macro.'),
        pass: variable('string', 'The macro pass, without a scope prefix'),
        castData: {
            ...variable('object', 'Cast scaling info for spell effects.'),
            children: {
                castLevel: property('number', 'Spell upcast level.'),
                baseLevel: property('number', 'Spell level.'),
                saveDC: property('number', 'Spell DC'),
                school: property('string', 'Spell school.')
            }
        }
    };
    const event = config.inputs.event?.value || 'none';
    const pass = config.inputs.pass?.value || 'none';
    const macroData = dataForMacroEvent(event, pass);
    for (const key of macroData) {
        if (key in completions) continue;
        if (key in baseTree) {
            if (key in OVERRIDES)
                completions[key] = {...baseTree[key], ...OVERRIDES[key](autocomplete, {event, pass, docType})};
            continue;
        }
        let triggerData = VARS[key]?.(autocomplete, {event, pass, docType});
        completions[key] = triggerData || variable('any', 'unregistered');
    }
    for (const key of OUT_OF_SCOPE) {
        if (key in completions) continue;
        completions[key] = alias(autocomplete, key, 'Not in scope for CAT embedded macros.');
    }
    autocomplete.setContextCompletions(codeMirror, completions /*, blockly */);
    Logging.addEntry('DEBUG', `macro-autocomplete injected ${Object.keys(completions).length} contextual completions`);
}

function dataForMacroEvent(event, pass) {
    let eventData;
    const get = cls => cls.prototype.appendData({});
    const isPass = (p, tgt) => p === tgt || p.toLowerCase().includes(tgt.toLowerCase());
    switch (event) {
        case 'move': eventData = get(Events.MovementEvent); break;
        case 'region': eventData = get(Events.RegionEvent); break;
        case 'effect': eventData = get(Events.EffectEvent); break;
        case 'combat': eventData = get(Events.CombatEvent); break;
        case 'aura': eventData = {source: null, target: null, sourceToken: null, targetToken: null, descriptor: null, distance: null}; break;
        case 'rest': eventData = get(Events.RestEvent); break;
        case 'check': eventData = get(Events.CheckEvent); break;
        case 'skill': eventData = get(Events.SkillEvent); break;
        case 'save': eventData = get(Events.SaveEvent); break;
        case 'tool': eventData = get(Events.ToolEvent); break;
        case 'hitDie': eventData = get(Events.HitDieEvent); break;
        case 'time': eventData = get(Events.TimeEvent); break;
        case 'summon': eventData = get(Events.SummonEvent); break;
        case 'called': eventData = get(Events.CalledEvent); break;
        case 'grapple': eventData = get(Events.GrappleEvent); break;
        case 'item':
            if (isPass(pass, constants.itemPasses.munched)) {
                eventData = get(Events.ItemsEvent);
                break;
            }
            eventData = get(Events.ItemEvent);
            break;
        case 'roll':
            if (isPass(pass, constants.workflowPasses.preTargeting)) {
                eventData = get(Events.PreTargetingWorkflowEvent);
                break;
            }
            if ([
                constants.workflowPasses.bonusAC,
                constants.workflowPasses.changeHit
            ].some(p => isPass(pass, p))) {
                eventData = get(Events.TokenHitWorkflowEvent);
                break;
            }
            if ([
                constants.workflowPasses.damage,
                constants.workflowPasses.damageBonuses,
                constants.workflowPasses.damageFlatReductions,
                constants.workflowPasses.damagePercentReductions,
                constants.workflowPasses.damageComplete
            ].some(p => isPass(pass, p))) {
                eventData = get(Events.TokenDamageWorkflowEvent);
                break;
            }
            eventData = get(Events.WorkflowEvent);
            break;
    }
    return Object.keys(eventData ?? {});
}

export default {
    registerCAT,
    inContext
};
