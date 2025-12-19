import {constants, Events} from '../lib.mjs';
async function updateAuras(token, options) {
    await Promise.all(token.parent.tokens.map(async token => {
        await new Events.AuraEvent(token, constants.auraPasses.update, {options, targetToken: token}).run();
    }));
}
export const auraEvents = {
    updateAuras
};