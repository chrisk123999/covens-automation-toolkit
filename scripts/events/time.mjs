import {constants, Events} from '../lib/_module.mjs';
import {queryUtils} from '../utilities/_module.mjs';
async function updateWorldTime(worldTime, diff, options, userId) {
    if (!queryUtils.isTheGM()) return;
    let actors = new Set();
    if (canvas.scene) {
        canvas.scene.tokens.forEach(token => {
            if (!token.actor) return;
            actors.add(token.actor);
        });
    }
    game.actors.filter(actor => actor.type === 'character').forEach(actor => {
        actors.add(actor);
    });
    for (let actor of actors) {
        await new Events.TimeEvent(actor, constants.timePasses.timeUpdated, {worldTime, diff, options}).run();
    }
}
export default {
    updateWorldTime
};