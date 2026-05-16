import {default as constants} from '../lib/constants.mjs';
async function registerAutomations() {
    const moduleId = 'dnd-dungeon-masters-guide';
    constants.automations.registerSourceName(moduleId, game.modules.get(moduleId).title);
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
}
export default {
    registerAutomations
};