import {DamageBonus, D20Bonus, constants, Events} from '../lib/_module.mjs';
import {dialogUtils, rollUtils, workflowUtils} from '../utilities/_module.mjs';

async function processBonuses(inputs, type, targetActor, workflow) {
    if (!inputs.length) return;
    let needsDialog = false;
    let bonuses = [];
    for (const bonus of inputs) {
        if (!(bonus instanceof type)) continue;
        bonus.targetActor = targetActor;
        if (bonus.maxTargets > 0 && workflow?.targets.size === 1) bonus.maxTargets = 0;
        if (bonus.optional || bonus.maxTargets > 0 || bonus.maxScaling > 0 || !!bonus.targetActor) 
            needsDialog = true;
        bonuses.push(bonus);
    }
    if (!bonuses.length) return;
    const targets = workflow?.targets.map(t => t.document);
    if (needsDialog) {
        const choices = await dialogUtils.selectScaledDocument(bonuses, {targets, workflow});
        const selectedTargetsIfRequired = b => b.maxTargets ? b.targets.size : true;
        if (!choices) bonuses = bonuses.filter(b => b.active && !b.optional && selectedTargetsIfRequired(b)); 
        else bonuses = choices.filter(c => selectedTargetsIfRequired(c));
    }
    return bonuses;
}

async function addAllToRoll(roll, inputs, targetActor, workflow) {
    inputs.forEach(i => i.maxTargets = 0);
    const bonuses = await processBonuses(inputs, D20Bonus, targetActor, workflow);
    if (!bonuses?.length) return;
    for (const bonus of bonuses) {
        if (bonus.use) await bonus.use(workflow, bonuses);
        roll = await rollUtils.addToRoll(roll, bonus.roll.formula, {rollData: bonus.roll.data});
    }
    return roll;
}

async function attack(workflow) {
    const inputs = (await new Events.WorkflowEvent(constants.workflowPasses.optionalBonusAttack, workflow).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    const roll = await addAllToRoll(workflow.attackRoll, inputs, workflow.actor, workflow);
    if (roll) await workflow.setAttackRoll(roll);
}

async function check(actor, data) {
    const inputs = (await new Events.CheckEvent(actor, constants.rollPasses.optionalBonus, data).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    return await addAllToRoll(data.roll, inputs, actor);
}

async function save(actor, data) {
    const inputs = (await new Events.SaveEvent(actor, constants.rollPasses.optionalBonus, data).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    return await addAllToRoll(data.roll, inputs, actor);
}

async function skill(actor, data) {
    const inputs = (await new Events.SkillEvent(actor, constants.rollPasses.optionalBonus, data).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    return await addAllToRoll(data.roll, inputs, actor);
}

async function tool(actor, data) {
    const inputs = (await new Events.ToolEvent(actor, constants.rollPasses.optionalBonus, data).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    return await addAllToRoll(data.roll, inputs, actor);
}

async function damage(workflow) {
    const inputs = (await new Events.WorkflowEvent(constants.workflowPasses.optionalBonusDamage, workflow).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    const bonuses = await processBonuses(inputs, DamageBonus, workflow.actor, workflow);
    if (!bonuses?.length) return;
    const targeted = {}, fullRoll = [];
    const defaultDamageType = workflow.damageRolls[0]?.options.type ?? workflow.defaultDamageType;
    for (const bonus of bonuses) {
        if (!bonus.roll._evaluated) await bonus.roll.evaluate();
        if (bonus.targets.size > 0) {
            if (bonus.targets.size === workflow.targets.size) {
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

function applyDamage(workflow, token, ditem) {
    const stash = workflowUtils.getWorkflowProperty(workflow, 'optionalBonusDamage');
    const bonuses = stash?.[token.document.uuid];
    if (!bonuses?.length) return;
    for (const {total, type} of bonuses) workflowUtils.modifyDamageAppliedFlat(ditem, total, {type, multiplier: 'auto'});
}

export default {
    attack,
    damage,
    applyDamage,
    check,
    save,
    skill,
    tool
};
