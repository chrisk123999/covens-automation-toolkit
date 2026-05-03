import {documentUtils} from '../utilities/_module.mjs';
import {constants} from '../lib/_module.mjs';
async function registerAutomations() {
    constants.automations.registerSourceName('dnd5e', 'Dungeons & Dragons Fifth Edition');
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
        const pack = game.packs.get('dnd5e.' + id);
        if (!pack) return;
        await constants.automations.registerAutomationCompendium(pack);
    }));
}
async function registerScales() {
    const packs = [
        'classes',
        'subclasses',
        'classes24'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get('dnd5e.' + id);
        if (!pack) return;
        const documents = await pack.getDocuments({type__in: ['class', 'subclass']});
        documents.forEach(document => {
            const scales = document.system.advancement.filter(i => i.type === 'ScaleValue');
            if (!scales.length) return;
            scales.forEach(scale => {
                constants.scales.registerScale({
                    source: 'dnd5e',
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