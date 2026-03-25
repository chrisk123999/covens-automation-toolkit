import {constants, Events} from '../lib.mjs';
async function situational(actor, data) {
    return await new Events.SaveEvent(actor, constants.rollPasses.situational, data).run();
}
async function targetSituational(actor, data) {
    return await new Events.SaveEvent(actor, constants.rollPasses.targetSituational, data).run();
}
async function context(actor, data) {
    const selections = await new Events.SaveEvent(actor, constants.rollPasses.context, data).run({multiResult: true});
    if (selections.length) {
        const advantages = selections.filter(i => i.type === 'advantage').map(j => ({label: j.label, name: 'advantage'}));
        const disadvantages = selections.filter(i => i.type === 'disadvantage').map(j => ({label: j.label, name: 'disadvantage'}));
        // Do dialog app here!

    }
}
async function bonus(actor, data) {
    return await new Events.SaveEvent(actor, constants.rollPasses.bonus, data).run();
}
async function post(actor, data) {
    return await new Events.SaveEvent(actor, constants.rollPasses.post, data).run();
}
export const saveEvents = {
    situational,
    context,
    bonus,
    post,
    targetSituational
};