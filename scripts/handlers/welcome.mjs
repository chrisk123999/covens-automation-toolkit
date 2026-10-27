import {queryUtils} from '../utilities/_module.mjs';
async function postWelcome(moduleId, {title, content}) {
    const shown = game.settings.get('cat', 'welcomes');
    if (!queryUtils.isTheGM() || shown[moduleId]) return;
    await game.settings.set('cat', 'welcomes', {...shown, [moduleId]: true});
    await ChatMessage.create({
        speaker: {alias: _loc(title)},
        whisper: ChatMessage.getWhisperRecipients('GM').map(user => user.id),
        content: `<div class="cat-welcome-card">${_loc(content)}</div>`,
        flags: {cat: {welcome: moduleId}}
    });
}
function startup() {
    postWelcome('cat', {title: 'CAT.Welcome.Title', content: 'CAT.Welcome.Content'});
}
function onRenderChatMessage(message, html) {
    if (!message.getFlag('cat', 'welcome')) return;
    html.querySelectorAll('[data-cat-tour]').forEach(button => button.addEventListener('click', () => {
        foundry.nue.Tour.activeTour?.exit();
        game.tours.get(button.dataset.catTour)?.start();
    }));
}
export default {
    startup,
    postWelcome,
    onRenderChatMessage
};
