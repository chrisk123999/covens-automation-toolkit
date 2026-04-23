import {default as constants} from '../lib/constants.mjs';
import documentUtils from '../utilities/documentUtils.mjs';
async function registerAutomations() {
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
        await pack.getDocuments();
        await Promise.all(pack.contents.map(async document => {
            if (!['class', 'subclass'].includes(document.type)) return;
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
        }));
    }));
}
export default {
    registerAutomations,
    registerScales
};