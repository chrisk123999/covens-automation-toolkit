import {constants, Logging} from '../lib/_module.mjs';
async function registerAutomations({register = true} = {}) {
    const moduleId = 'dnd-dungeon-masters-guide';
    const module = game.modules.get(moduleId);
    if (!module) return Logging.addRegistrationError(moduleId, 'integrations', 'Automation module not found!');
    constants.automations.registerSourceName(moduleId, module.title);
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