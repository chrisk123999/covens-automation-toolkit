import {constants, Events} from '../lib.mjs';
async function situational(actor, data) {
    return await new Events.SkillEvent(actor, constants.rollPasses.situational, data).run();
}
async function context(actor, data) {
    const selections = await new Events.SkillEvent(actor, constants.rollPasses.context, data).run({multiResult: true});
    if (selections.length) {
        const advantages = selections.filter(i => i.type === 'advantage').map(j => ({label: j.label, name: 'advantage'}));
        const disadvantages = selections.filter(i => i.type === 'disadvantage').map(j => ({label: j.label, name: 'disadvantage'}));
        // Do dialog app here!

    }
}
async function bonus(actor, data) {
    return await new Events.SkillEvent(actor, constants.rollPasses.bonus, data).run();
}
async function post(actor, data) {
    return await new Events.SkillEvent(actor, constants.rollPasses.post, data).run();
}
export const skillEvents = {
    situational,
    context,
    bonus,
    post
};