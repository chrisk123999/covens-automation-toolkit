import {actorUtils, documentUtils, effectUtils, genericUtils} from '../utilities/_module.mjs';
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
async function createAnimations(effect) {

}
async function deleteAnimations(effect) {

}
function preImageCreate(effect, id) {
    if (game.user.id != id) return;
    if (!(effect.parent instanceof Actor)) return;
    const actorImg = effect.flags.cat?.image?.actor?.value;
    const tokenImg = effect.flags.cat?.image?.token?.value;
    let effects;
    const updates = {};
    if (actorImg) {
        effects = actorUtils.getEffects(effect.parent);
        const otherActorEffects = documentUtils.filterSortDocuments(effects, 'flags.cat.image.actor.priority', {excludeIds: [effect.id]});
        genericUtils.setProperty(updates, 'flags.cat.image.actor.original', otherActorEffects.length ? otherActorEffects[0].flags.cat.image.actor.original : effect.parent.img);
    }
    if (tokenImg) {
        effects ??= actorUtils.getEffects(effect.parent);
        const otherTokenEffects = documentUtils.filterSortDocuments(effects, 'flags.cat.image.token.priority', {excludeIds: [effect.id]});
        genericUtils.setProperty(updates, 'flags.cat.image.token.original', otherTokenEffects.length ? otherTokenEffects[0].flags.cat.image.token.original : effect.parent.prototypeToken.texture.src);
    }
    effect.updateSource(updates);
}
async function imageCreate(effect) {
    const actorImg = effect.flags.cat?.image?.actor?.value;
    const tokenImg = effect.flags.cat?.image?.token?.value;
    let effects;
    const updates = [];
    if (actorImg) {
        effects = actorUtils.getEffects(effect.parent);
        const otherActorEffects = documentUtils.filterSortDocuments(effects, 'flags.cat.image.actor.priority', {excludeIds: [effect.id]});
        updates.push({
            action: 'update',
            documentName: 'Actor',
            updates: [{_id: effect.parent.id, img: otherActorEffects.length ? otherActorEffects[0].flags.cat.image.actor.value : actorImg}]
        });
    }
    if (tokenImg) {
        effects ??= actorUtils.getEffects(effect.parent);
        const otherTokenEffects = documentUtils.filterSortDocuments(effects, 'flags.cat.image.token.priority', {excludeIds: [effect.id]});
        effect.parent.getActiveTokens().forEach(t => updates.push({
            action: 'update',
            parent: t.document.parent,
            documentName: 'Token',
            updates: [{_id: t.id, 'texture.src': otherTokenEffects.length ? otherTokenEffects[0].flags.cat.image.token.value : tokenImg}]
        }));
    }
    if (updates.length) await documentUtils.modifyBatch(updates);
}
async function imageRemove(effect) {
    const actorImg = effect.flags.cat?.image?.actor?.value;
    const tokenImg = effect.flags.cat?.image?.token?.value;
    let effects;
    const updates = [];
    if (actorImg) {
        effects = actorUtils.getEffects(effect.parent);
        const otherActorEffects = documentUtils.filterSortDocuments(effects, 'flags.cat.image.actor.priority', {excludeIds: [effect.id]});
        updates.push({
            action: 'update',
            documentName: 'Actor',
            updates: [{_id: effect.parent.id, img: otherActorEffects.length ? otherActorEffects[0].flags.cat.image.actor.original : effect.flags.cat.image.actor.original}]
        });
    }
    if (tokenImg) {
        effects ??= actorUtils.getEffects(effect.parent);
        const otherTokenEffects = documentUtils.filterSortDocuments(effects, 'flags.cat.image.token.priority', {excludeIds: [effect.id]});
        effect.parent.getActiveTokens().forEach(t => updates.push({
            action: 'update',
            parent: t.document.parent,
            documentName: 'Token',
            updates: [{_id: t.id, 'texture.src': otherTokenEffects.length ? otherTokenEffects[0].flags.cat.image.token.original : effect.flags.cat.image.token.original}]
        }));
    }
    if (updates.length) await documentUtils.modifyBatch(updates);
}
export default {
    addConditions,
    removeConditions,
    applyActiveEffect,
    noAnimation,
    effectDescription,
    preImageCreate,
    imageCreate,
    imageRemove
};