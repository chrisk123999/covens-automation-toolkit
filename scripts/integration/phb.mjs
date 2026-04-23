import {default as constants} from '../lib/constants.mjs';
import documentUtils from '../utilities/documentUtils.mjs';
async function registerAutomations() {
    const packs = [
        'classes',
        'origins',
        'feats',
        'spells',
        'equipment'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get('dnd-players-handbook.' + id);
        if (!pack) return;
        await constants.automations.registerAutomationCompendium(pack);
    }));
}
async function registerScales() {
    const packs = [
        'classes'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get('dnd-players-handbook.' + id);
        if (!pack) return;
        await pack.getDocuments();
        await Promise.all(pack.contents.map(async document => {
            if (!['class', 'subclass'].includes(document.type)) return;
            const scales = document.system.advancement.filter(i => i.type === 'ScaleValue');
            if (!scales.length) return;
            scales.forEach(scale => {
                constants.scales.registerScale({
                    source: 'dnd-players-handbook',
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