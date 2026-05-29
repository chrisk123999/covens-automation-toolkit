import {actorUtils, documentUtils, effectUtils, genericUtils} from '../utilities/_module.mjs';
function disableSpecialEffects(enabled) {
    CONFIG.specialStatusEffects.BLIND = enabled ? undefined : 'blinded';
    CONFIG.specialStatusEffects.INVISIBLE = enabled ? undefined : 'invisible';
}
async function addConditions(effect) {
    const conditions = effect.flags.cat?.conditions;
    if (!conditions) return;
    await genericUtils.sleep(50);
    return await actorUtils.applyConditions(effect.parent, conditions);
}
async function removeConditions(effect) {
    const conditions = effect.flags.cat?.conditions;
    if (!conditions?.length) return;
    const parent = effect.parent;
    const targetEffects = new Map();
    conditions.forEach(id => {
        const cEffect = actorUtils.getEffectByStatusID(parent, id);
        if (cEffect) targetEffects.set(id, cEffect.id);
    });
    if (!targetEffects.size) return;
    const effects = actorUtils.getEffects(parent);
    const cids = new Set();
    effects.forEach(oEffect => {
        if (oEffect.id === effect.id) return;
        const otherConditions = effectUtils.getConditions(oEffect);
        if (otherConditions) {
            otherConditions.forEach(condId => {
                if (targetEffects.get(condId) !== oEffect.id) {
                    cids.add(condId);
                }
            });
        }
    });
    const ids = [];
    conditions.forEach(id => {
        if (!cids.has(id) && targetEffects.has(id)) {
            ids.push(targetEffects.get(id));
        }
    });
    if (ids.length) return await documentUtils.deleteEmbeddedDocuments(parent, 'ActiveEffect', ids);
}
function applyActiveEffect(actor, change, current, delta, changes) {
    if (change.key.startsWith('flags.cat.CR.') || change.key.startsWith('flags.cat.CV.')) {
        const existing = genericUtils.getProperty(actor, change.key);
        const newValue = existing ? String(existing) + ', ' + String(change.value) : String(change.value);
        genericUtils.setProperty(actor, change.key, newValue);
        changes[change.key] = newValue;
        return true; 
    }
}
function noAnimation(effect, options) {
    if (!effect.flags.cat?.noAnimation) return;
    options.animate = false;
}
function effectDescription(effect, updates) {
    if (updates.description || !effect.parent) return;
    if (effect.transfer && effect.parent.documentName !== 'Item') return;
    const item = (!effect.transfer && effect.origin) ? effectUtils.getOriginActivitySync(effect)?.item : effect.parent;
    if (item?.documentName != 'Item') return;
    const mode = game.settings.get('cat', 'effectDescriptionsNPC');
    if (mode && item.actor?.type === 'npc') return;
    const type = game.settings.get('cat', 'effectDescriptions') === 2 ? 'value' : 'chat';
    const description = (item.system.identified ?? true) ? item.system.description[type] : item.system.unidentified.description;
    if (description) effect.updateSource({description});
}
export default {
    disableSpecialEffects,
    addConditions,
    removeConditions,
    applyActiveEffect,
    noAnimation,
    effectDescription
};