import {Events} from '../lib.mjs';
async function rollFinished(workflow) {
    let event = await new Events.WorkflowEvent('rollFinished', workflow).execute();
    console.log(event);
}
export const midiEvents = {
    rollFinished
};