import {Events} from '../lib/event.js';
async function rollFinished(workflow) {
    let event = new Events.WorkflowEvent('rollFinished', workflow);
    let test = event.execute();
    console.log(test);
}
export const midiEvents = {
    rollFinished
};