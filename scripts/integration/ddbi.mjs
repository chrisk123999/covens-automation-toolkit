import {constants} from '../lib/_module.mjs';
import {documentUtils} from '../utilities/_module.mjs';
import {Logging} from '../lib/_module.mjs';
const COMPENDIUM_SETTINGS = [
    'entity-background-compendium',
    'entity-class-compendium',
    'entity-feat-compendium',
    'entity-item-compendium',
    'entity-species-compendium',
    'entity-spell-compendium'
];
function getCompendiumIds() {
    if (!game.modules.get('ddb-importer')?.active) return [];
    return COMPENDIUM_SETTINGS.map(setting => game.settings.get('ddb-importer', setting)).filter(Boolean);
}
async function registerAutomations() {
    const moduleId = 'ddb-importer';
    constants.automations.registerSourceName(moduleId, game.modules.get(moduleId).title);
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
                source: moduleId,
                rules: entry.system.source.rules,
                identifier: entry.system.identifier,
                version: version,
                uuid: entry.uuid,
                type: entry.type
            });
        });
    }));
}
async function registerScales() {
    const moduleId = 'ddb-importer';
    const settings = [
        'entity-class-compendium'
    ];
    const packs = settings.map(setting => game.settings.get(moduleId, setting));
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(id);
        if (!pack) return;
        const documents = await pack.getDocuments({type__in: ['class', 'subclass']});
        documents.forEach(document => {
            const scales = document.system.advancement.filter(i => i.type === 'ScaleValue');
            if (!scales.length) return;
            scales.forEach(scale => {
                constants.scales.registerScale({
                    source: moduleId,
                    rules: documentUtils.getRules(document),
                    identifier: scale.identifier,
                    classIdentifier: documentUtils.getIdentifier(document),
                    data: scale.toObject()
                });
            });
        });
    }));
}
export default {
    registerAutomations,
    registerScales,
    getCompendiumIds
};