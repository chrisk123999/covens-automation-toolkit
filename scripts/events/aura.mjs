import {constants, Events} from '../lib/_module.mjs';
import {actorUtils, queryUtils} from '../utilities/_module.mjs';
async function updateAuras(tokens, {options, eventSource} = {}) {
    await Promise.all(tokens.map(async token =>
        new Events.AuraEvent(token, constants.auraPasses.update, {options, eventSource}).run()
    ));
}
async function createToken(token, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!token.actor) return;
    await updateAuras(token.parent.tokens, {options, eventSource: 'createToken'});
}
async function deleteToken(token, options, userId) {
    if (!queryUtils.isTheGM()) return;
    if (!token.actor) return;
    await updateAuras(token.parent.tokens.filter(t => t.id != token.id), {options, eventSource: 'deleteToken'});
}
async function canvasReady(canvas) {
    if (!queryUtils.isTheGM() || !canvas.scene) return;
    await updateAuras(canvas.scene.tokens, {eventSource: 'canvasReady'});
}
async function effect(effect, options) {
    if (!effect.parent) return;
    if (!(effect.flags.cat?.macros?.aura || effect.statuses.size)) return;
    let token;
    if (effect.parent instanceof Actor) {
        token = actorUtils.getFirstToken(effect.parent);
    } else if (effect.parent instanceof Item && effect.parent.actor) {
        token = actorUtils.getFirstToken(effect.parent.actor);
    }
    if (!token) return;
    await updateAuras(token.parent.tokens, {options, eventSource: options.action + 'ActiveEffect'});
}
export default {
    updateAuras,
    createToken,
    deleteToken,
    canvasReady,
    effect
};