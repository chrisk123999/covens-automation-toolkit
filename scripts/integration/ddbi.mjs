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
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'flags.ddbimporter.version', 'type']});
        index.contents.forEach(entry => {
            const version = entry.flags.ddbimporter?.version;
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
async function registerScales(module) {
    const packs = ['entity-class-compendium'].map(getSetting).filter(Boolean);
    Logging.group('D&D Beyond Importer Scales');
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(id);
        if (!pack) return;
        const documents = await pack.getDocuments({type__in: ['class', 'subclass']});
        documents.forEach(document => {
            const scales = document.system.advancement.filter(i => i.type === 'ScaleValue');
            if (!scales.length) return;
            scales.forEach(scale => {
                constants.scales.registerScale({
                    source: CONFIG.id,
                    rules: documentUtils.getRules(document),
                    identifier: scale.identifier,
                    classIdentifier: documentUtils.getIdentifier(document),
                    data: scale.toObject()
                });
            });
        });
    }));
    Logging.groupEnd();
}
export default {
    CONFIG,
    registerAutomations,
    registerScales,
    getCompendiumIds
};