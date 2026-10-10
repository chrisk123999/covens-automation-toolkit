import {DialogApp} from '../applications/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
async function situational(actor, data) {
    return await new Events.SaveEvent(actor, constants.rollPasses.situational, data).run();
}
async function targetSituational(actor, data) {
    return await new Events.SaveEvent(actor, constants.rollPasses.targetSituational, data).run();
}
async function context(actor, data) {
    const selections = await new Events.SaveEvent(actor, constants.rollPasses.context, data).run({multiResult: true});
    if (selections.length) {
        const advantages = selections.filter(i => i.type === 'advantage').map(j => ({label: _loc(j.label), name: 'advantage'}));
        const disadvantages = selections.filter(i => i.type === 'disadvantage').map(j => ({label: _loc(j.label), name: 'disadvantage'}));
        const inputs = [];
        if (advantages.length) inputs.push(['checkbox', advantages, {displayAsRows: true}]);
        if (disadvantages.length) inputs.push(['checkbox', disadvantages, {displayAsRows: true}]);
        if (!inputs.length) return;
        const selection = await DialogApp.dialog('CAT.Save.Title', undefined, inputs, 'okCancel');
        if (selection?.buttons) {
            if (selection.advantage) {
                switch(selection.advantage.constructor.name) {
                    case 'Boolean': data.options.advantage = true; break;
                    case 'Array': data.options.advantage = selection.advantage.some(Boolean); break;
                }
            }
            if (selection.disadvantage) {
                switch(selection.disadvantage.constructor.name) {
                    case 'Boolean': data.options.disadvantage = true; break;
                    case 'Array': data.options.disadvantage = selection.disadvantage.some(Boolean); break;
                }
            }
        }
    }
}
async function bonus(actor, data) {
    return await new Events.SaveEvent(actor, constants.rollPasses.bonus, data).run();
}
async function post(actor, data) {
    return await new Events.SaveEvent(actor, constants.rollPasses.post, data).run();
}
export default {
    situational,
    context,
    bonus,
    post,
    targetSituational
};