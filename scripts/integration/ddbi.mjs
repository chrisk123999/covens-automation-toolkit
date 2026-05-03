import {constants} from '../lib/_module.mjs';
import {genericUtils, documentUtils} from '../utilities/_module.mjs';
import {Logging} from '../lib/_module.mjs';
async function registerAutomations() {
    await genericUtils.sleep(1000); //Remove this once ddb-importer.compendiumCreationComplete is added.
    constants.automations.registerSourceName('ddb-importer', 'D&D Beyond Importer');
    const settings = [
        'entity-background-compendium',
        'entity-class-compendium',
        'entity-feat-compendium',
        'entity-item-compendium',
        'entity-species-compendium',
        'entity-spell-compendium'
    ];
    const packs = settings.map(setting => game.settings.get('ddb-importer', setting));
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(id);
        if (!pack) return;
        Logging.addEntry('DEBUG', 'Automation Compendium Registered: ' + pack.metadata.label + ' from ' + pack.metadata.packageName);
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'flags.ddbimporter.version']});
        index.contents.forEach(entry => {
            const version = entry.flags.ddbimporter?.version;
            if (!version) return;
            constants.automations.registerAutomation({
                source: 'ddb-importer',
                rules: entry.system.source.rules,
                identifier: entry.system.identifier,
                version: version,
                uuid: entry.uuid
            });
        });
    }));
}
async function registerScales() {
    await genericUtils.sleep(1000); //Remove this once ddb-importer.compendiumCreationComplete is added.
    const settings = [
        'entity-class-compendium'
    ];
    const packs = settings.map(setting => game.settings.get('ddb-importer', setting));
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(id);
        if (!pack) return;
        const documents = await pack.getDocuments({type__in: ['class', 'subclass']});
        documents.forEach(document => {
            const scales = document.system.advancement.filter(i => i.type === 'ScaleValue');
            if (!scales.length) return;
            scales.forEach(scale => {
                constants.scales.registerScale({
                    source: 'ddb-importer',
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
    registerScales
};