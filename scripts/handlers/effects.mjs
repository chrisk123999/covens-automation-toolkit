import {actorUtils, documentUtils, effectUtils, genericUtils, workflowUtils} from '../utilities/_module.mjs';
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
async function specialDuration(workflow) {
    if (!workflow.token) return;
    await Promise.all(workflow.targets.map(async token => {
        if (!token.actor) return;
        await Promise.all(actorUtils.getEffects(token.actor, {includeItemEffects: true}).map(async effect => {
            const specialDurations = effect.flags.cat?.specialDuration;
            if (!specialDurations) return;
            let remove = false;
            outerLoop:
            for (const i of specialDurations) {
                switch (i) {
                    case 'damagedByAlly':
                        if (workflow.token.document.disposition === token.document.disposition && workflow.hitTargets.has(token) && workflow.damageRolls?.length) remove = true; break outerLoop;
                    case 'damagedByEnemy':
                        if (workflow.token.document.disposition != token.document.disposition && workflow.hitTargets.has(token) && workflow.damageRolls?.length) remove = true; break outerLoop;
                    case 'hitByAnotherCreature':
                        if (!workflow.hitTargets.size) break;
                    // eslint-disable-next-line no-fallthrough
                    case 'attackedByAnotherCreature': {
                        if (!workflow.activity) return;
                        if (!workflowUtils.isAttackType(workflow, 'attack')) break;
                        const origin = await effectUtils.getOriginActivity(effect)?.item;
                        if (!origin?.actor) break;
                        if (workflow.actor.id === origin.actor.id) break;
                        remove = true;
                        break outerLoop;
                    }
                    case 'hitBySource':
                        if (!workflow.hitTargets.size) break;
                    // eslint-disable-next-line no-fallthrough
                    case 'attackedBySource': {
                        if (!workflow.activity) return;
                        if (!workflowUtils.isAttackType(workflow, 'attack')) break;
                        const origin = await effectUtils.getOriginActivity(effect)?.item;
                        if (!origin?.actor) break;
                        if (workflow.actor.id != origin.actor.id) break;
                        remove = true;
                        break outerLoop;
                    }
                    case 'endOfWorkflow': {
                        remove = true;
                        break outerLoop;
                    }
                }
            }
            if (remove) await documentUtils.deleteDocument(effect);
        }));
    }));
    await Promise.all(actorUtils.getEffects(workflow.actor, {includeItemEffects: true}).map(async effect => {
        const specialDurations = effect.flags.cat?.specialDuration;
        if (!specialDurations) return;
        let remove = false;
        outerLoop:
        for (const i of specialDurations) {
            switch (i) {
                case 'forceSave': {
                    if (!workflow.activity) return;
                    if (!workflow.activity.hasSave) return;
                    if (workflow.targets.size === 1 && workflow.targets.has(workflow.token)) return;
                    remove = true;
                    break outerLoop;
                }
                case 'attackMissed': {
                    if (!workflow.activity || !workflowUtils.isAttackType(workflow, 'attack')) break;
                    if (!workflow.targets.size || workflow.hitTargets.size) break;
                    remove = true;
                    break outerLoop;
                }
                case 'endOfWorkflow': {
                    remove = true;
                    break outerLoop;
                }
            }
        }
        if (remove) await documentUtils.deleteDocument(effect);
    }));
}
async function specialDurationConditions(effect) {
    await Promise.all(actorUtils.getEffects(effect.parent, {includeItemEffects: true}).filter(i => i.id != effect.id).map(async eff => {
        const specialDurations = eff.flags.cat?.specialDuration;
        if (!specialDurations?.length) return;
        if (effect.statuses.some(k => specialDurations.includes(k))) await documentUtils.deleteDocument(eff);
    }));
}
async function specialDurationRemovedConditions(effect) {
    await Promise.all(actorUtils.getEffects(effect.parent).filter(i => i.id != effect.id).map(async eff => {
        const specialDurations = eff.flags.cat?.specialDuration;
        if (!specialDurations?.length) return;
        if (effect.statuses.some(k => specialDurations.includes(k + 'Removed'))) await documentUtils.deleteDocument(eff);
    }));
}
async function specialDurationEquipment(item, {removed} = {}) {
    let equipmentTypes = Object.keys(CONFIG.DND5E.armorTypes);
    if (removed) equipmentTypes = equipmentTypes.map(i => i + 'Removed');
    await Promise.all(actorUtils.getEffects(item.actor, {includeItemEffects: true}).map(async effect => {
        let specialDurations = effect.flags.cat?.specialDuration;
        if (!specialDurations) return;
        specialDurations.filter(j => equipmentTypes.includes(j));
        if (!specialDurations.length) return;
        if (specialDurations.includes(item.system.type?.value)) await documentUtils.deleteDocument(effect);
    }));
}
async function specialDurationHitPoints(actor, updates) {
    const validTypes = [];
    if (updates.system?.attributes?.hp?.temp === 0) validTypes.push('tempHP');
    if (updates.system?.attributes?.hp?.tempmax === 0) validTypes.push('tempMaxHP');
    if (!validTypes.length) return;
    await Promise.all(actorUtils.getEffects(actor, {includeItemEffects: true}).map(async effect => {
        const specialDurations = effect.flags.cat?.specialDuration;
        if (!specialDurations) return;
        if (specialDurations.some(i => validTypes.includes(i))) await documentUtils.deleteDocument(effect);
    }));
}
async function specialDurationToolCheck(actor, roll, toolId) {
    await Promise.all(actorUtils.getEffects(actor, {includeItemEffects: true}).map(async effect => {
        const specialDurations = effect.flags.cat?.specialDuration;
        if (!specialDurations) return;
        let remove = specialDurations.includes(toolId);
        const target = roll.options.target;
        if (!remove && target) {
            if (target > roll.total && specialDurations.includes(toolId + 'Fail')) remove = true;
            if (target <= roll.total && specialDurations.includes(toolId + 'Succeed')) remove = true;
        }
        if (remove) await documentUtils.deleteDocument(effect);
    }));
}
async function specialDurationMove(actor) {
    const effects = actorUtils.getEffects(actor, {includeItemEffects: true}).filter(i => i.flags.cat?.specialDuration?.includes('moveFinished'));
    if (!effects.length) return;
    await documentUtils.deleteEmbeddedDocuments(actor, 'ActiveEffect', effects.map(i => i.id));
}
async function specialDurationZeroSpeed(actor) {
    const effects = actorUtils.getEffects(actor, {includeItemEffects: true}).filter(i => i.flags.cat?.specialDuration?.includes('zeroSpeed'));
    if (!effects.length) return;
    const types = ['burrow', 'climb', 'fly', 'swim', 'walk'];
    const allZero = types.every(t => actor.system.attributes.movement[t] === 0);
    if (!allZero) return;
    await documentUtils.deleteEmbeddedDocuments(actor, 'ActiveEffect', effects.map(i => i.id));
}
export default {
    addConditions,
    removeConditions,
    applyActiveEffect,
    noAnimation,
    effectDescription,
    specialDuration,
    specialDurationConditions,
    specialDurationRemovedConditions,
    specialDurationEquipment,
    specialDurationToolCheck,
    specialDurationHitPoints,
    specialDurationMove,
    specialDurationZeroSpeed
};