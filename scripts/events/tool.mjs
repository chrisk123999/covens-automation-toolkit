import {DialogApp} from '../applications/_module.mjs';
import {constants, Events} from '../lib/_module.mjs';
import {effects} from '../handlers/_module.mjs';
async function situational(actor, data) {
    return await new Events.ToolEvent(actor, constants.rollPasses.situational, data).run();
}
async function targetSituational(actor, data) {
    return await new Events.ToolEvent(actor, constants.rollPasses.targetSituational, data).run();
}
async function context(actor, data) {
    const selections = await new Events.ToolEvent(actor, constants.rollPasses.context, data).run({multiResult: true});
    const types = [['advantage', 'DND5E.Advantage'], ['disadvantage', 'DND5E.Disadvantage']];
    const inputs = types.map(([type, legend]) => ['checkbox', selections.filter(i => i.type === type).map(j => ({label: _loc(j.label), name: type})), {displayAsRows: true, legend}]).filter(([, list]) => list.length);
    if (!inputs.length) return;
    const selection = await DialogApp.dialog('CAT.Tool.Title', 'CAT.Dialog.RollContext', inputs, 'okCancel', {width: 400});
    if (!selection?.buttons) return;
    for (const [type] of types) {
        const value = selection[type];
        if (value) data.options[type] = Array.isArray(value) ? value.some(Boolean) : true;
    }
}
async function bonus(actor, data) {
    return await new Events.ToolEvent(actor, constants.rollPasses.bonus, data).run();
}
async function post(actor, data) {
    const result = await new Events.ToolEvent(actor, constants.rollPasses.post, data).run();
    await effects.specialDurationToolCheck(actor, data.roll, data.toolId);
    return result;
}
export default {
    situational,
    targetSituational,
    context,
    bonus,
    post
};