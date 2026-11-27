import WorldMedkit from '../applications/medkit/world.mjs';
import {constants, Logging} from '../lib/_module.mjs';
import {documentUtils} from '../utilities/_module.mjs';
const COMPENDIUM_SETTINGS = [
    'entity-background-compendium',
    'entity-class-compendium',
    'entity-feat-compendium',
    'entity-item-compendium',
    'entity-species-compendium',
    'entity-spell-compendium'
];
const CONFIG = Object.freeze({
    id: 'ddb-importer',
    skipStartup: true
});
function getSetting(key) {
    if (!game.modules.get(CONFIG.id)?.active || !game.settings.settings.has(CONFIG.id + '.' + key)) return;
    return game.settings.get(CONFIG.id, key);
}
function getCompendiumIds() {
    return COMPENDIUM_SETTINGS.map(getSetting).filter(Boolean);
}
async function registerAutomations(module) {
    constants.automations.registerSourceName(CONFIG.id, module.title);
    Logging.group('D&D Beyond Importer Automations');
    const packs = getCompendiumIds();
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(id);
        if (!pack) return;
        Logging.addEntry('DEBUG', 'Automation Compendium Registered: ' + pack.metadata.label + ' from ' + pack.metadata.packageName);
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source', 'flags.ddbimporter.version', 'flags.cat.automation.source', 'type']});
        index.contents.forEach(entry => {
            const version = entry.flags.ddbimporter?.version;
            const appliedSource = entry.flags.cat?.automation?.source;
            if (!version || (appliedSource && appliedSource !== CONFIG.id)) return;
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
async function registerScales() {
    const pack = game.packs.get(getSetting('entity-class-compendium'));
    if (!pack) return;
    Logging.group('D&D Beyond Importer Scales');
    const documents = await pack.getDocuments({type__in: ['class', 'subclass']});
    documents.forEach(document => {
        document.system.advancement.filter(i => i.type === 'ScaleValue').forEach(scale => {
            constants.scales.registerScale({
                source: CONFIG.id,
                rules: documentUtils.getRules(document),
                identifier: scale.identifier,
                classIdentifier: documentUtils.getIdentifier(document),
                data: scale.toObject()
            });
        });
    });
    Logging.groupEnd();
}
async function munched({created, updated}) {
    if (!game.settings.get('cat', 'ddbiIntegration')) return;
    const documents = await Promise.all([...created, ...updated].map(uuid => fromUuid(uuid)));
    const items = documents.filter(Boolean).flatMap(document => document.documentName === 'Actor' ? document.items.contents : document);
    if (items.length) await new WorldMedkit().massApply({prompt: false, items});
}
export default {
    CONFIG,
    munched,
    registerAutomations,
    registerScales,
    getCompendiumIds
};
