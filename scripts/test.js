async function use() {
    console.log('test!');
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
            macro: use,
            priority: 50
        }
    ]
};