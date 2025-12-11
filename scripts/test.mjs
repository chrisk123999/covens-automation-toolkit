async function use(trigger) {
    console.log(trigger);
}
async function target() {
    console.log('test 1');
}
export let test = {
    source: 'cat',
    identifier: 'test',
    rules: 'all',
    itemRoll: [
        {
            pass: 'rollFinished',
            macro: use,
            priority: 50
        },
        {
            pass: 'targetRollFinished',
            macro: target,
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