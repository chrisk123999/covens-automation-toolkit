import {actorUtils, workflowUtils, effectUtils, documentUtils, queryUtils} from '../utilities/_module.mjs';
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
    const statusEffectIds = CONFIG.statusEffects.map(i => i.id);
    await Promise.all(actorUtils.getEffects(effect.parent, {includeItemEffects: true}).filter(i => i.id != effect.id).map(async eff => {
        let specialDurations = eff.flags.cat?.specialDuration;
        if (!specialDurations) return;
        specialDurations = specialDurations.filter(j => statusEffectIds.map(l => l + 'Removed'));
        if (!specialDurations.length) return;
        if (effect.statuses.some(k => specialDurations.includes(k + 'Removed'))) await documentUtils.deleteDocument(eff);
    }));
}
async function specialDurationRemovedConditions(effect) {
    const statusEffectIds = CONFIG.statusEffects.map(i => i.id);
    await Promise.all(actorUtils.getEffects(effect.parent).filter(i => i.id != effect.id).map(async eff => {
        let specialDurations = eff.flags.cat?.specialDuration;
        if (!specialDurations) return;
        specialDurations = specialDurations.filter(j => statusEffectIds.map(l => l + 'Removed'));
        if (!specialDurations.length) return;
        if (effect.statuses.some(k => specialDurations.includes(k + 'Removed'))) await documentUtils.deleteDocument(eff);
    }));
}
async function specialDurationEquipment(item) {
    const equipmentTypes = Object.keys(CONFIG.DND5E.armorTypes);
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
    specialDuration,
    specialDurationConditions,
    specialDurationRemovedConditions,
    specialDurationEquipment,
    specialDurationHitPoints,
    specialDurationMove,
    specialDurationZeroSpeed
};