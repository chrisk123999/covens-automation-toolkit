import {Events} from '../lib/_module.mjs';
function npcCardDisposition(message) {
    if (!game.settings.get('cat', 'npcCardsFollowDisposition') || message.whisper.length) return;
    const actor = ChatMessage.implementation.getSpeakerActor(message.speaker);
    if (actor?.type !== 'npc' || !Events.CatEvent.isRunning(actor)) return;
    const token = game.scenes.get(message.speaker.scene)?.tokens.get(message.speaker.token) ?? actor.token ?? actor.prototypeToken;
    if (![CONST.TOKEN_DISPOSITIONS.HOSTILE, CONST.TOKEN_DISPOSITIONS.SECRET].includes(token?.disposition)) return;
    message.updateSource(ChatMessage.implementation.applyMode({}, 'gm'));
}
export default {npcCardDisposition};
