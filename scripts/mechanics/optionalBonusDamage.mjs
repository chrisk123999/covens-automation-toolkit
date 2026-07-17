import {constants, Events} from '../lib/_module.mjs';
import {dialogUtils, workflowUtils} from '../utilities/_module.mjs';
import manualRolls from '../handlers/manualRolls.mjs';

export async function optionalBonusDamage(workflow) {
    const bonuses = (await new Events.WorkflowEvent(constants.workflowPasses.optionalBonusDamage, workflow).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    if (!bonuses.length) return;
    const key = doc => doc.id ?? doc._id;
    const byId = new Map(bonuses.map(b => [key(b.document), b]));
    const targets = [...workflow.targets].map(token => token.document);
    const multiTarget = targets.length > 1;
    const isPerTarget = bonus => bonus.targets === 'one';
    const selects = {};
    if (multiTarget) {
        const choices = Object.fromEntries(targets.map(t => [t.uuid, t.name]));
        for (const bonus of bonuses) {
            if (isPerTarget(bonus)) selects[key(bonus.document)] = {choices, value: targets[0].uuid};
        }
    }
    const scopeOf = (id, selections) => isPerTarget(byId.get(id)) ? (selections[id] ?? targets[0]?.uuid) : 'all';
    const applicableRolls = (id, checked, selections) => {
        const scope = scopeOf(id, selections);
        const shared = checked.filter(i => i !== id).filter(i => {
            const other = scopeOf(i, selections);
            return other === 'all' || scope === 'all' || other === scope;
        });
        return [...workflow.damageRolls, ...shared.flatMap(i => byId.get(i)?.rolls ?? [])];
    };
    const validate = (checked, selections) => checked.filter(id => {
        const bonus = byId.get(id);
        return bonus?.predicate && !bonus.predicate(workflow, applicableRolls(id, checked, selections));
    });
    const tags = Object.fromEntries(bonuses.map(b => [key(b.document), (b.rolls ?? []).map(r => r.formula).join(' + ')]).filter(([, formula]) => formula));
    const selection = await dialogUtils.selectDocumentDialog('CAT.OptionalBonusDamage.Title', 'CAT.OptionalBonusDamage.Context', bonuses.map(b => b.document), {max: null, checkbox: true, displayTooltips: true, sort: 'alphabetical', showUses: true, validate, tags, selects});
    if (!selection) return;
    const chosen = selection.filter(i => i.amount).map(i => ({bonus: byId.get(key(i.document)), target: targets.find(t => t.uuid === i.select) ?? targets[0]})).filter(i => i.bonus);
    if (!chosen.length) return;
    const wholeRoll = chosen.filter(i => !isPerTarget(i.bonus));
    const perTarget = chosen.filter(i => isPerTarget(i.bonus));
    const newRolls = wholeRoll.flatMap(i => i.bonus.rolls ?? []);
    if (newRolls.length) {
        workflow.damageRolls.push(...newRolls);
        await workflow.setDamageRolls(workflow.damageRolls);
    }
    for (const {bonus, target} of wholeRoll) {
        if (bonus.use) await bonus.use({workflow, rolls: bonus.rolls, target});
    }
    const stash = {};
    const label = _loc('CAT.OptionalBonusDamage.Title');
    for (const {bonus, target} of perTarget) {
        if (bonus.rolls?.length && target) {
            const resolved = await manualRolls.resolveManualRolls(bonus.rolls, workflow.actor, label);
            (stash[target.uuid] ??= []).push(...resolved);
        }
        if (bonus.use) await bonus.use({workflow, rolls: bonus.rolls, target});
    }
    if (Object.keys(stash).length) workflowUtils.setWorkflowProperty(workflow, 'optionalBonusDamage', stash);
}

export async function applyOptionalBonusDamage(workflow) {
    const stash = workflowUtils.getWorkflowProperty(workflow, 'optionalBonusDamage');
    if (!stash) return;
    workflowUtils.setWorkflowProperty(workflow, 'optionalBonusDamage', undefined);
    for (const [uuid, rolls] of Object.entries(stash)) {
        const token = fromUuidSync(uuid)?.object;
        if (!token || !rolls.length) continue;
        const damageDetail = rolls.map(roll => ({value: roll.total, type: roll.options.type, properties: new Set(roll.options.properties ?? [])}));
        const totalDamage = damageDetail.reduce((total, d) => total + d.value, 0);
        await MidiQOL.applyTokenDamage(damageDetail, totalDamage, new Set([token]), workflow.item, workflow.saves, {workflow, superSavers: workflow.superSavers, semiSuperSavers: workflow.semiSuperSavers});
    }
}
