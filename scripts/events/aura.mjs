import {constants, Events} from '../lib.mjs';
import {queryUtils} from '../utils.mjs';
async function updateAuras(token, options) {
    await Promise.all(token.parent.tokens.map(async token => {
        await new Events.AuraEvent(token, constants.auraPasses.update, {options, targetToken: token}).run();
    }));
}
async function createToken(token, options, userId) {
    if (!queryUtils.isTheGM()) return;
    
}
export const auraEvents = {
    updateAuras
};