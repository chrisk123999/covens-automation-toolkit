import {constants, Events} from '../lib/_module.mjs';
async function preCreate(summon, updates) {
    return await new Events.SummonEvent(summon, constants.summonPasses.preCreate, {updates}).run();
}
async function create(summon) {
    return await new Events.SummonEvent(summon, constants.summonPasses.create).run();
}
async function preDelete(summon) {
    return await new Events.SummonEvent(summon, constants.summonPasses.preDelete).run();
}
async function deleted(summon) {
    return await new Events.SummonEvent(summon, constants.summonPasses.delete).run();
}
async function remove(summon) {
    return await new Events.SummonEvent(summon, constants.summonPasses.removed).run();
}
export default {
    preCreate,
    create,
    preDelete,
    deleted,
    remove
};