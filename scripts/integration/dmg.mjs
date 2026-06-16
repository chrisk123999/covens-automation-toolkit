import {constants, Logging} from '../lib/_module.mjs';
async function registerAutomations({register = true} = {}) {
    const moduleId = 'dnd-dungeon-masters-guide';
    constants.automations.registerSourceName(moduleId, game.modules.get(moduleId).title);
    if (!register) return;
    Logging.group('D&D Dungeon Master\'s Guide Automations');
    const packs = [
        'equipment',
        'features',
        'bastions'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(moduleId + '.' + id);
        if (!pack) return;
        await constants.automations.registerAutomationCompendium(pack);
    }));
    Logging.groupEnd();
}
export default {
    registerAutomations
};