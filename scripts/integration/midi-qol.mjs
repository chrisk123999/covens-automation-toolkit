import {constants} from '../lib/_module.mjs';
import {Logging} from '../lib/_module.mjs';
async function registerAutomations({register = true} = {}) {
    const moduleId = 'midi-qol';
    const module = game.modules.get(moduleId);
    if (!module) return Logging.addRegistrationError(moduleId, 'integrations', 'Automation module not found!');
    constants.automations.registerSourceName(moduleId, module.title);
    if (!register) return;
    Logging.group('Midi-QoL Automations');
    const packs = [
        'midiqol-sample-items'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(moduleId + '.' + id);
        if (!pack) return;
        Logging.addEntry('DEBUG', 'Automation Compendium Registered: ' + pack.metadata.label + ' from ' + pack.metadata.packageName);
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'system.source.custom', 'flags.chris-premades.info.version', 'type']});
        index.contents.forEach(entry => {
            const version = entry.flags['chris-premades']?.info?.version ?? entry.system.source?.custom?.match(/\d+(\.\d+)+/)?.[0]; //Make Tim fix this lol
            if (!version) return;
            constants.automations.registerAutomation({
                source: moduleId,
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
    registerAutomations
};