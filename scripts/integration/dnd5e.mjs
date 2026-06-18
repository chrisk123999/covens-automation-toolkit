import {documentUtils} from '../utilities/_module.mjs';
import {constants, Logging} from '../lib/_module.mjs';
async function registerAutomations() {
    constants.automations.registerSourceName(game.system.id, game.system.title);
    Logging.group('D&D 5e Automations');
    const packs = [
        'items',
        'tradegoods',
        'spells',
        'backgrounds',
        'classes',
        'subclasses',
        'classfeatures',
        'races',
        'classes24',
        'origins24',
        'feats24',
        'spells24',
        'equipment24'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(game.system.id + '.' + id);
        if (!pack) return;
        await constants.automations.registerAutomationCompendium(pack);
    }));
    Logging.groupEnd();
}
async function registerScales() {
    Logging.group('D&D 5e Scales');
    const packs = [
        'classes',
        'subclasses',
        'classes24'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(game.system.id + '.' + id);
        if (!pack) return;
        const documents = await pack.getDocuments({type__in: ['class', 'subclass']});
        documents.forEach(document => {
            const scales = document.system.advancement.filter(i => i.type === 'ScaleValue');
            if (!scales.length) return;
            scales.forEach(scale => {
                constants.scales.registerScale({
                    source: game.system.id,
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
    registerAutomations,
    registerScales
};