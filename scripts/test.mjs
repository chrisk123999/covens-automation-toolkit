async function use(trigger) {
    console.log(trigger);
}
async function target() {
    console.log('test 1');
}
async function nearby(trigger) {
    console.log('it worked!');
    console.log(trigger);
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
            pass: 'movedNear',
            macro: use,
            priority: 50
        }
    ]
};
export let brokenTest = {
    source: 'cat',
    identifier: 'brokenTest',
    rules: 'all',
    itemRoll: {}
};