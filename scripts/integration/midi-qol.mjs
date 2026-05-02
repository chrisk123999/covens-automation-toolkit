import {constants} from '../lib/_module.mjs';
import {Logging} from '../lib/_module.mjs';
async function registerAutomations() {
    constants.automations.registerSourceName('midi-qol', 'Midi Quality of Life Improvements');
    const packs = [
        'midiqol-sample-items'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get('midi-qol.' + id);
        if (!pack) return;
        Logging.addEntry('DEBUG', 'Automation Compendium Registered: ' + pack.metadata.label + ' from ' + pack.metadata.packageName);
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'system.source.custom', 'flags.chris-premades.info.version']});
        index.contents.forEach(entry => {
            const version = entry.flags['chris-premades']?.info?.version ?? entry.system.source?.custom?.match(/\d+(\.\d+)+/)?.[0];
            if (!version) return;
            constants.automations.registerAutomation({
                source: 'midi-qol',
                rules: entry.system.source.rules,
                identifier: entry.system.identifier,
                version: version,
                uuid: entry.uuid
            });
        });
    }));
}
export default {
    registerAutomations
};