import {constants, Logging} from '../lib/_module.mjs';
const CONFIG = Object.freeze({
    id: 'dnd-dungeon-masters-guide'
});
async function registerAutomations(module) {
    constants.automations.registerSourceName(CONFIG.id, module.title);
    Logging.group('D&D Dungeon Master\'s Guide Automations');
    const packs = [
        'equipment',
        'features',
        'bastions'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(CONFIG.id + '.' + id);
        if (!pack) return;
        await constants.automations.registerAutomationCompendium(pack);
    }));
    Logging.groupEnd();
}
export default {
    CONFIG,
    registerAutomations
};