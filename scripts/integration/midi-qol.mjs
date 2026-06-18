import {constants} from '../lib/_module.mjs';
import {Logging} from '../lib/_module.mjs';
const CONFIG = Object.freeze({
    id: 'midi-qol'
});
async function registerAutomations(module) {
    constants.automations.registerSourceName(CONFIG.id, module.title);
    Logging.group('Midi-QoL Automations');
    const packs = [
        'midiqol-sample-items'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(CONFIG.id + '.' + id);
        if (!pack) return;
        Logging.addEntry('DEBUG', 'Automation Compendium Registered: ' + pack.metadata.label + ' from ' + pack.metadata.packageName);
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'system.source.custom', 'flags.chris-premades.info.version', 'type']});
        index.contents.forEach(entry => {
            const version = entry.flags['chris-premades']?.info?.version ?? entry.system.source?.custom?.match(/\d+(\.\d+)+/)?.[0]; //Make Tim fix this lol
            if (!version) return;
            constants.automations.registerAutomation({
                source: CONFIG.id,
                rules: entry.system.source.rules,
                identifier: entry.system.identifier,
                version: version,
                uuid: entry.uuid,
                type: entry.type
            });
        });
    }));
    Logging.groupEnd();
}
export default {
    CONFIG,
    registerAutomations
};