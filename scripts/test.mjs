import {actorUtils} from './utils.mjs';
async function use(trigger) {
    console.log(trigger);
}
async function target(trigger) {
    console.log('Target!');
    console.log(trigger);
}
async function nearby(trigger) {
    console.log('Nearby!');
    console.log(trigger);
}
async function turnStart(trigger) {
    console.log(trigger);
}
async function aura(trigger) {
    let effect = actorUtils.getEffectByIdentifier(trigger.actor, trigger.identifier + 'Aura');
    if (effect && effect.origin === trigger.document.uuid) return;
    const effectData = trigger.document.effects.contents[0].toObject();
    effectData.origin = trigger.document.uuid;
    return {effectData};
}
export let test = {
    source: 'cat',
    identifier: 'test',
    rules: 'all',
    roll: [
        {
            pass: 'rollFinished',
            macro: use,
            priority: 50
        },
        {
            pass: 'targetRollFinished',
            macro: target,
            priority: 50
        },
        {
            pass: 'nearbyRollFinished',
            macro: nearby,
            priority: 50,
            distance: 60
        }
    ],
    move: [
        {
            pass: 'nearbyMoved',
            macro: nearby,
            priority: 50,
            distance: 20
        }
    ],
    combat: [
        {
            pass: 'turnStart',
            macro: turnStart,
            priority: 50
        },
        {
            pass: 'nearbyTurnStart',
            macro: nearby,
            priority: 50,
            distance: 20
        }
    ],
    aura: [
        {
            pass: 'update',
            macro: aura,
            priority: 50,
            distance: 10,
            dispositions: ['ally']
        }
    ]
};
export let brokenTest = {
    source: 'cat',
    identifier: 'brokenTest',
    rules: 'all',
    itemRoll: {}
};