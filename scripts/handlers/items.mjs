import {constants, Logging} from '../lib/_module.mjs';
import {automationUtils, documentUtils} from '../utilities/_module.mjs';
import * as integration from '../integration/_modules.mjs';
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
async function registerCompendiums({startup = false} = {}) {
    const enabledSources = automationUtils.getAutomationSources();
    const sources = constants.automations.sources;
    if (!startup) {
        for (const source of Array.from(sources)) {
            if (!enabledSources.includes(source)) {
                constants.automations.unregisterAutomationsBySource(source);
                constants.scales.unregisterScalesBySource(source);
            }
        }
    }
    const sourceList = [integration.dnd5e, integration.midiQol, integration.phb, integration.dmg, integration.ddbi];
    for (const source of sourceList) {
        const c = source.CONFIG;
        if (startup && c.skipStartup) continue;
        const module = c.system || game.modules.get(c.id);
        if (!module || !enabledSources.includes(c.id) || sources.has(c.id)) continue;
        await source.registerAutomations?.(module);
        await source.registerScales?.(module);
        await source.registerDocumentSources?.(module);
    }
    const compendiums = automationUtils.getAutomationSources({packsOnly: true}).map(id => game.packs.get(id)).filter(Boolean);
    await Promise.all(compendiums.map(async compendium => {
        if (!sources.has(compendium.metadata.id)) await hashCompendium(compendium, {register: true});
    }));
}
export default {
    updateHash,
    hashCompendium,
    registerCompendiums
};