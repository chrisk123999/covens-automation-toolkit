import {constants} from '../lib/_module.mjs';
async function registerAutomations() {
    constants.automations.registerSourceName('ddb-importer', 'D&D Beyond Importer');
    const settings = [
        //'entity-background-compendium',
        'entity-class-compendium',
        'entity-feat-compendium',
        'entity-item-compendium',
        'entity-species-compendium',
        'entity-spell-compendium'
    ];
    const packs = settings.map(setting => game.settings.get('ddb-importer', setting));
    console.log(packs);
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(id);
        if (!pack) return;
        await constants.automations.registerAutomationCompendium(pack);
    }));
}
export default {
    registerAutomations
};