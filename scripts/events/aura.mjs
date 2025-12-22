import {constants, Events} from '../lib.mjs';
import {actorUtils, queryUtils} from '../utils.mjs';
async function updateAuras(tokens, {options, targetToken} = {}) {
    await Promise.all(tokens.map(async token => {
        await new Events.AuraEvent(token, constants.auraPasses.update, {options, targetToken}).run();
    }));
}
async function createToken(token, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!token.actor) return;
    await updateAuras(token.parent.tokens, {options, targetToken: token});
}
async function deleteToken(token, options, useId) {
    if (!queryUtils.isTheGM()) return;
    if (!token.actor) return;
    await updateAuras(token.parent.tokens.filter(t => t.id != token.id), {options, targetToken: token});
}
async function canvasReady(canvas) {
    if (!queryUtils.isTheGM() || !canvas.scene || !constants.gameReady) return;
    await updateAuras(canvas.scene.tokens);
}
async function effect(effect, options) {
    if (!effect.parent) return;
    if (!(effect.flags.cat?.macros?.aura || ['dead', 'unconscious', 'incapacitated'].some(i => effect.statuses.has(i)))) return;
    let token;
    if (effect.parent instanceof Actor) {
        token = actorUtils.getFirstToken(effect.parent);
    } else if (effect.parent instanceof Item && effect.parent.actor) {
        token = actorUtils.getFirstToken(effect.parent.actor);
    }
    if (!token) return;
    await updateAuras(token.parent.tokens, {options, targetToken: token});
}
export const auraEvents = {
    updateAuras,
    createToken,
    deleteToken,
    canvasReady,
    effect
};