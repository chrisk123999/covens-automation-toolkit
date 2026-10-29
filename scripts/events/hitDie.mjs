import {constants, Events} from '../lib/_module.mjs';
async function situational(actor, data) {
    return await new Events.HitDieEvent(actor, constants.rollPasses.situational, data).run();
}
async function bonus(actor, data) {
    return await new Events.HitDieEvent(actor, constants.rollPasses.bonus, data).run();
}
async function post(actor, data) {
    return await new Events.HitDieEvent(actor, constants.rollPasses.post, data).run();
}
export default {
    situational,
    bonus,
    post
};
