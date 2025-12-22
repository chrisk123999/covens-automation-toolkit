import {constants, Events} from '../lib.mjs';
async function restCompleted(actor, result, config) {
    await new Events.RestEvent(actor, constants.restPasses.short, {result, config}).run();
    if (result.type === 'long') await new Events.RestEvent(actor, constants.restPasses.long, {result, config}).run();
}
export const restEvents = {
    restCompleted
};