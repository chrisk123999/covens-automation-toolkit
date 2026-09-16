import {actorUtils, dialogUtils, documentUtils, effectUtils, genericUtils, itemUtils, rollUtils, tokenUtils, uiUtils, workflowUtils} from '../utilities/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
function abilities(rules) {
    if (rules === '2014') return ['acr', 'ath'];
    if (rules === '2024') return ['str', 'dex'];
}
async function legacyGrappleDC(grapplerActor) {
    return (await rollUtils.requestRoll(grapplerActor, 'skill', 'ath'))?.total ?? -99;
}
function itemData(sourceEffect, targetEffect, dc, rules, {name, img} = {}) {
    const data = {
        type: 'feat',
        _id: foundry.utils.randomID(),
        img: img ?? constants.grappleIcon,
        name: name ?? _loc('CAT.GrappleShove.Grapple'),
        effects: [sourceEffect, targetEffect],
        system: {
            source: {rules},
            identifier: 'grapple',
            activities: {
                catSyntheticGrap: {
                    range: {units: 'any'},
                    activation: {type: ''},
                    _id: 'catSyntheticGrap',
                    name: _loc('CAT.GrappleShove.Grapple'),
                    type: rules === '2024' ? 'save' : 'check',
                    target: {affects: {count: '1', type: 'creature'}},
                    midiProperties: {displayActivityName: !!name, identifier: 'grapple'},
                    effects: [
                        {_id: sourceEffect._id},
                        {_id: targetEffect._id}
                    ]
                }
            }
        }
    };
    if (rules === '2024') {
        data.system.activities.catSyntheticGrap.type = 'save';
        data.system.activities.catSyntheticGrap.save = {
            ability: abilities(rules),
            dc: {formula: dc}
        };
    }
    if (rules === '2014') {
        data.system.activities.catSyntheticGrap.type = 'check';
        data.system.activities.catSyntheticGrap.check = {
            associated: abilities(rules),
            dc: {formula: dc}
        };
    }
    return data;
}
function sourceEffectData(name, rules, img = constants.grappleIcon) {
    return {
        _id: foundry.utils.randomID(),
        name, img, transfer: false, showIcon: 2,
        flags: {
            cat: {
                automation: {rules},
                identifier: 'grappleSource',
                specialDuration: ['zeroHP'],
                macros: {move: [{identifier: 'grapple', rules: 'all', source: 'cat'}]}
            },
            dae: {
                selfTarget: true,
                expiryMode: 'delete',
                stackable: 'noneName'
            }
        }
    };
}
function targetEffectData(name, rules, img = constants.grappleIcon) {
    return {
        _id: foundry.utils.randomID(),
        name, img, transfer: false, showIcon: 2,
        flags: {
            cat: {
                automation: {rules},
                identifier: 'grappleTarget',
                conditions: ['grappled'],
                specialDuration: ['zeroHP'],
                macros: {
                    effect: [{identifier: 'grapple', rules: 'all', source: 'cat'}],
                    move: [{identifier: 'grapple', rules: 'all', source: 'cat'}]
                }
            },
            dae: {
                expiryMode: 'delete',
                stackable: 'noneName'
            }
        }
    };
}
function escapeData(dc, rules) {
    const data = itemData({_id:''}, {_id:''}, dc, rules, {name: _loc('CAT.GrappleShove.GrappleEscape'), img: constants.grappleEscapeIcon});
    genericUtils.setProperty(data, 'flags.cat.macros.roll', [{identifier: 'grapple', rules: 'all', source: 'cat'}]);
    data.system.activities.catSyntheticGrap.midiProperties = {identifier: 'grapple-escape'};
    data.system.activities.catSyntheticGrap.target.affects.type = 'self';
    data.system.activities.catSyntheticGrap.activation.type = 'action';
    data.system.activities.catSyntheticGrap.effects = [];
    data.system.identifier = 'grapple-escape';
    data.effects = [];
    return data;
}
async function createEscapeItem(actor, itemData) {
    const item = actorUtils.getItemByIdentifier(actor, itemData.system.identifier, {type: 'feat'}) ?? 
        (await documentUtils.createEmbeddedDocuments(actor, 'Item', [itemData]))?.[0];
    if (item) await actorUtils.addFavorites(actor, [item]);
    return item;
}
async function sizeCheck(sourceToken, targetToken, identifier, warning = true) {
    if (identifier === 'grapple' && actorUtils.checkTrait(targetToken.actor, 'ci', 'grappled'))
        return warning ? genericUtils.notify('CAT.GrappleShove.GrappleImmune', {type: 'warn'}) : false;
    if (identifier === 'shove-prone' && actorUtils.checkTrait(targetToken.actor, 'ci', 'prone'))
        return warning ? genericUtils.notify('CAT.GrappleShove.ShoveProneImmune', {type: 'warn'}) : false;
    let size = actorUtils.getSize(sourceToken.actor);
    const sizeBonuses = await new Events.GrappleEvent(sourceToken, targetToken, constants.grapplePasses.sizeCheck, {identifier, size}).run({canOverlap: true, multiResult: true});
    if (sizeBonuses?.length) size = sizeBonuses.reduce((sum, bonus) => typeof bonus === 'number' ? sum + bonus : sum, size);
    if (actorUtils.getSize(targetToken.actor) <= (size + 1)) return true;
    if (warning) genericUtils.notify(`CAT.GrappleShove.${identifier === 'grapple' ? 'Grapple' : 'Shove'}Size`, {type: 'warn'});
}
async function grapple(sourceToken, targetToken, {activity, rules, flatDC = activity?.save?.dc.value, contest = true, checkSize = true} = {}) {
    if (!sourceToken.actor || !targetToken.actor) return;
    if (checkSize) { 
        if (!await sizeCheck(sourceToken, targetToken, 'grapple')) return; 
    }
    else if (actorUtils.checkTrait(targetToken.actor, 'ci', 'grappled')) {
        return genericUtils.notify('CAT.GrappleShove.GrappleImmune', {type: 'warn'});
    }
    rules ??= activity?.item ? documentUtils.getRules(activity?.item) : '2014';
    const data = {
        rules,
        dc: flatDC,
        reach: activity ? (MidiQOL.checkActivityRange(activity, sourceToken, [targetToken], false)?.range || 5) : 5,
        sourceEffectData: sourceEffectData(_loc('CAT.GrappleShove.Grappling', {name: targetToken.name}), rules, activity?.item.img),
        targetEffectData: targetEffectData(_loc('CAT.GrappleShove.GrappledBy', {name: sourceToken.name}), rules, activity?.item.img)
    };
    await new Events.GrappleEvent(sourceToken, targetToken, constants.grapplePasses.preGrapple, {data}).run();
    genericUtils.setProperty(data.sourceEffectData, 'flags.cat.grapple', {dc: data.dc, reach: data.reach, tokenId: targetToken.id});
    genericUtils.setProperty(data.targetEffectData, 'flags.cat.grapple', {dc : data.dc, reach: data.reach,  tokenId: sourceToken.id});
    let sourceEffect, targetEffect;
    if (contest) {
        data.dc ??= await legacyGrappleDC(sourceToken.actor);
        if (data.dc === -99) return;
        const item = itemData(data.sourceEffectData, data.targetEffectData, data.dc, rules, activity?.item);
        const result = await workflowUtils.syntheticItemDataRoll(item, sourceToken.actor, [targetToken]);
        if (!result?.failedSaves.size) return;
        sourceEffect = sourceToken.actor.effects.find(e => e.origin?.startsWith(result.item.uuid));
        targetEffect = targetToken.actor.effects.find(e => e.origin?.startsWith(result.item.uuid));
    } else {
        sourceEffect = (await effectUtils.createEffects(sourceToken.actor, [data.sourceEffectData]))?.[0];
        targetEffect = (await effectUtils.createEffects(targetToken.actor, [data.targetEffectData]))?.[0];
    }
    if (!sourceEffect || !targetEffect) return;
    await documentUtils.makeDependent(sourceEffect, [targetEffect]);
    await documentUtils.makeDependent(targetEffect, [sourceEffect]);
    const escapeItem = await createEscapeItem(targetToken.actor, escapeData(data.dc, rules));
    await new Events.GrappleEvent(sourceToken, targetToken, constants.grapplePasses.postGrapple, {data: {
        rules, sourceEffect, targetEffect, escapeItem
    }}).run();
}
async function grappleMoved({action, document: effect, token}) {
    const info = effect.flags.cat?.grapple;
    if (!info) return;
    const otherToken = token.parent.tokens.get(info.tokenId);
    if (!otherToken) return;
    const outOfReach = tokenUtils.getDistance(token, otherToken, {wallsBlock: true}) > (info.reach ?? 5);
    if (outOfReach && action === 'catForce' || CONFIG.Token.movement.actions[action]?.teleport) 
        await documentUtils.deleteDocument(effect);
}
async function preGrappleEscape({workflow}) {  
    const data = {};
    const tags = {};
    const grapplers = [];
    const effects = actorUtils.getEffectByIdentifier(workflow.actor, 'grappleTarget', {multiple: 'true'});
    for (const e of effects) {
        const flag = e.flags.cat?.grapple;
        const token = workflow.token.scene.tokens.get(flag?.tokenId);
        if (!token) continue;
        const rules = documentUtils.getRules(e);
        if (flag.dc === undefined) tags[token.id] = [{label: _loc('midi-qol.ContestedRoll'), id: 'dc'}];
        else tags[token.id] = uiUtils.showDC(token.actor) ? [{label: `${_loc('DND5E.AbbreviationDC')} ${flag.dc}`, id: 'dc'}] : [];
        tags[token.id].push(...abilities(rules).map(a => ({
            label: CONFIG.DND5E.abilities[a]?.label ?? CONFIG.DND5E.skills[a]?.label ?? a,
            id: 'ability-' + a
        })));
        data[token.id] = {dc: flag.dc, effect: e, rules};
        grapplers.push(token);
    }
    if (!grapplers.length) return true;
    const choice = (await dialogUtils.selectTargetDialog(workflow.item.name, '', grapplers, {skipDeadAndUnconscious: false, tags}))?.result;
    if (!choice) return true;
    const selected = data[choice.id];
    await new Events.GrappleEvent(choice, workflow.token.document, constants.grapplePasses.preEscape, {data: selected}).run();
    selected.dc ??= await legacyGrappleDC(choice.actor);
    workflow.item = itemUtils.syntheticItem(escapeData(selected.dc, selected.rules), workflow.actor);
    workflow.activity = workflow.item.system.activities.get(workflow.activity.id);
    workflowUtils.setWorkflowProperty(workflow, 'grappleEscape', {
        effect: selected.effect, grappler: choice, remaining: Object.values(data).filter(d => d.effect.id !== selected.effect.id)
    });
    workflowUtils.addMacroConditions(workflow, 'grappled');
}
async function grappleEscape({workflow}) {
    const data = workflowUtils.getWorkflowProperty(workflow, 'grappleEscape');
    if (!data) return;
    await new Events.GrappleEvent(data.grappler, workflow.token.document, constants.grapplePasses.postEscape, {data: {
        effect: data.effect, remaining: data.remaining
    }}).run();
    if (!workflow.saves.size) return;
    const nextGrapple = data.remaining[0];
    if (nextGrapple) await createEscapeItem(workflow.actor, escapeData(nextGrapple.dc, nextGrapple.rules));
    if (data.effect) await documentUtils.deleteDocument(data.effect);
}
async function deleteGrappleEscape({actor, identifier}) {
    if (!actor) return;
    if (actorUtils.getEffectByIdentifier(actor, identifier, {multiple: true}).length) return;
    const item = actorUtils.getItemByIdentifier(actor, 'grapple-escape', {type: 'feat'});
    if (item) await documentUtils.deleteDocument(item);
}
function register() {
    constants.macros.registerFnMacro({
        source: 'cat',
        identifier: 'grapple',
        rules: 'all',
        effect: [
            {
                pass: 'deleted',
                macro: deleteGrappleEscape,
                priority: 100
            }
        ],
        move: [
            {
                pass: 'actorMoved',
                macro: grappleMoved,
                priority: 100
            }
        ],
        roll: [  
            {
                pass: 'itemPreItemRoll',
                macro: preGrappleEscape,
                priority: 100
            },
            {
                pass: 'itemRollFinished',
                macro: grappleEscape,
                priority: 100
            }
        ]
    });
}
export default {
    sizeCheck,
    grapple,
    register
};
