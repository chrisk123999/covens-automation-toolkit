import {constants, Logging} from '../lib/_module.mjs';
import documentUtils from '../utilities/documentUtils.mjs';
async function registerAutomations({register = true} = {}) {
    const moduleId = 'dnd-players-handbook';
    const module = game.modules.get(moduleId);
    if (!module) return Logging.addRegistrationError(moduleId, 'integrations', 'Automation module not found!');
    constants.automations.registerSourceName(moduleId, module.title);
    if (!register) return;
    Logging.group('D&D Players Handbook Automations');
    const packs = [
        'classes',
        'origins',
        'feats',
        'spells',
        'equipment'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(moduleId + '.' + id);
        if (!pack) return;
        await constants.automations.registerAutomationCompendium(pack);
    }));
    Logging.groupEnd();
}
async function registerScales({register = true} = {}) {
    if (!register) return;
    const moduleId = 'dnd-players-handbook';
    Logging.group('D&D Players Handbook Scales');
    const packs = [
        'classes'
    ];
    await Promise.all(packs.map(async id => {
        const pack = game.packs.get(moduleId + '.' + id);
        if (!pack) return;
        const documents = await pack.getDocuments({type__in: ['class', 'subclass']});
        documents.forEach(document => {
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
        });
    }));
    Logging.groupEnd();
}
export default {
    registerAutomations,
    registerScales
};