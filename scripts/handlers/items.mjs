import {constants, Logging} from '../lib/_module.mjs';
import {automationUtils, documentUtils} from '../utilities/_module.mjs';
async function updateHash(item, {create = false, remove = false} = {}) {
    const compendiumId = item.compendium?.metadata?.id;
    if (!compendiumId) return;
    if (!automationUtils.getAutomationSources({packsOnly: true}).includes(compendiumId)) return;
    if (remove) {
        constants.automations.unregisterUuid(item.uuid);
        return;
    }
    const hash = automationUtils.getDocumentHash(item);
    const oldHash = automationUtils.getStoredHash(item);
    if (hash === oldHash) return;
    Logging.addEntry('DEBUG', 'Updating document hash with: ' + hash + ' from ' + (oldHash ?? 'none'));
    await automationUtils.setDocumentHash(item, hash);
    if (create) {
        constants.automations.registerAutomation({
            source: compendiumId,
            rules: documentUtils.getRules(item),
            identifier: documentUtils.getIdentifier(item),
            uuid: item.uuid,
            version: '0'
        });
    }
}
async function hashCompendium(compendium, {register = false} = {}) {
    const index = await compendium.getIndex({ 
        fields: [
            'flags.cat.automation.hash',
            'system.source.rules',
            'system.identifier'
        ] 
    });
    const promises = [];
    index.forEach(entry => {
        promises.push((async () => {
            const oldHash = foundry.utils.getProperty(entry, 'flags.cat.automation.hash');
            const rules = foundry.utils.getProperty(entry, 'system.source.rules');
            const identifier = foundry.utils.getProperty(entry, 'system.identifier');
            if (register) {
                constants.automations.registerAutomation({
                    source: compendium.metadata.id,
                    rules: rules,
                    identifier: identifier,
                    uuid: entry.uuid,
                    version: '0'
                });
            }
            if (!oldHash && !compendium.locked) {
                const item = await compendium.getDocument(entry._id);
                if (!item) return;
                const hash = automationUtils.getDocumentHash(item);
                await automationUtils.setDocumentHash(item, hash);
            }
        })());
    });
    await Promise.all(promises);
}
async function registerCompendiums() {
    const compendiums = automationUtils.getAutomationSources({packsOnly: true}).map(id => game.packs.get(id)).filter(Boolean);
    compendiums.forEach(compendium => {
        hashCompendium(compendium, {register: true});
        constants.automations.registerSourceName(compendium.metadata.id, compendium.metadata.name);
    });
}
export default {
    updateHash,
    hashCompendium,
    registerCompendiums
};