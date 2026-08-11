import {DamageBonus, constants, Events} from '../lib/_module.mjs';
import {dialogUtils, workflowUtils} from '../utilities/_module.mjs';

export async function optionalBonusDamage(workflow) {
    const inputs = (await new Events.WorkflowEvent(constants.workflowPasses.optionalBonusDamage, workflow).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    if (!inputs.length) return;
    let needsDialog = false;
    let bonuses = [];
    for (const bonus of inputs) {
        if (!(bonus instanceof DamageBonus)) continue;
        if (bonus.maxTargets > 0 && workflow.targets.size === 1) bonus.maxTargets = 0;
        if (bonus.optional || bonus.maxTargets > 0 || bonus.maxScaling > 0) 
            needsDialog = true;
        bonuses.push(bonus);
    }
    if (!bonuses.length) return;
    const targets = workflow.targets.map(t => t.document);
    if (needsDialog) {
        const choices = await dialogUtils.selectScaledDocument(bonuses, {targets, workflow});
        const selectedTargetsIfRequired = b => b.maxTargets ? b.targets.size : true;
        if (!choices) bonuses = bonuses.filter(b => b.active && !b.optional && selectedTargetsIfRequired(b)); 
        else bonuses = choices.filter(c => selectedTargetsIfRequired(c));
    }
    const targeted = {}, fullRoll = [];
    const defaultDamageType = workflow.damageRolls[0]?.options.type ?? workflow.defaultDamageType;
    for (const bonus of bonuses) {
        if (!bonus.roll._evaluated) await bonus.roll.evaluate();
        if (bonus.targets.size > 0) {
            if (bonus.targets.size === targets.size) {
                fullRoll.push(bonus.roll);
                continue;
            }
            for (const target of bonus.targets) {
                const type = bonus.roll.options.type ?? defaultDamageType;
                targeted[target.uuid] ??= [];
                targeted[target.uuid].push({total: bonus.roll.total, type});
            }
        } else fullRoll.push(bonus.roll);
        if (bonus.use) await bonus.use(workflow, bonuses);
    }
    if (fullRoll.length) {
        workflow.damageRolls.push(...fullRoll);
        await workflow.setDamageRolls(workflow.damageRolls);
    }
    if (Object.keys(targeted).length) workflowUtils.setWorkflowProperty(workflow, 'optionalBonusDamage', targeted);
}

export function applyOptionalBonusDamage(workflow, token, ditem) {
    const stash = workflowUtils.getWorkflowProperty(workflow, 'optionalBonusDamage');
    const bonuses = stash?.[token.document.uuid];
    if (!bonuses?.length) return;
    for (const {total, type} of bonuses) workflowUtils.modifyDamageAppliedFlat(ditem, total, {type, multiplier: 'auto'});
}
