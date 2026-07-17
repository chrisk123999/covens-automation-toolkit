import {constants, Events} from '../lib/_module.mjs';
import {dialogUtils, workflowUtils} from '../utilities/_module.mjs';
import manualRolls from '../handlers/manualRolls.mjs';

export async function optionalBonusDamage(workflow) {
    const optional = (await new Events.WorkflowEvent(constants.workflowPasses.optionalBonusDamage, workflow).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    const contextual = (await new Events.WorkflowEvent(constants.workflowPasses.contextualBonusDamage, workflow).run({multiResult: true, canOverlap: true})).filter(i => i.document).map(b => ({...b, contextual: true}));
    const bonuses = [...optional, ...contextual];
    if (!bonuses.length) return;
    const keys = bonuses.map((b, i) => 'b' + i);
    const byId = new Map(bonuses.map((b, i) => [keys[i], b]));
    const targets = [...workflow.targets].map(token => token.document);
    const multiTarget = targets.length > 1;
    const isPerTarget = bonus => bonus.targets === 'one';
    const locked = new Set(keys.filter(k => byId.get(k).contextual));
    const selects = {};
    if (multiTarget) {
        const choices = Object.fromEntries(targets.map(t => [t.uuid, t.name]));
        bonuses.forEach((bonus, i) => {
            if (isPerTarget(bonus)) selects[keys[i]] = {choices, value: targets[0].uuid};
        });
    }
    const scopeOf = (id, selections) => isPerTarget(byId.get(id)) ? (selections[id] ?? targets[0]?.uuid) : 'all';
    const passesWith = (id, active, selections) => {
        const bonus = byId.get(id);
        if (!bonus?.predicate) return true;
        const scope = scopeOf(id, selections);
        const rolls = [...active].filter(i => i !== id).filter(i => {
            const other = scopeOf(i, selections);
            return other === 'all' || scope === 'all' || other === scope;
        }).flatMap(i => byId.get(i)?.rolls ?? []);
        return bonus.predicate(workflow, [...workflow.damageRolls, ...rolls]);
    };
    const contextualIds = [...locked];
    const resolveActive = (checkedOptional, selections) => {
        const active = new Set([...checkedOptional, ...contextualIds]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const id of [...active]) if (!passesWith(id, active, selections)) { active.delete(id); changed = true; }
        }
        return active;
    };
    const validate = (checked, selections) => [...new Set([...checked, ...contextualIds])].filter(id => !passesWith(id, new Set([...checked, ...contextualIds]), selections));
    const tags = Object.fromEntries(bonuses.map((b, i) => [keys[i], (b.rolls ?? []).map(r => r.formula).join(' + ')]).filter(([, formula]) => formula));
    const labels = Object.fromEntries(bonuses.map((b, i) => [keys[i], b.macroName]).filter(([, name]) => name));
    const needsDialog = optional.length > 0 || (multiTarget && contextual.some(isPerTarget));
    let checkedOptional = [];
    const selections = {};
    if (needsDialog) {
        const selection = await dialogUtils.selectDocumentDialog('CAT.OptionalBonusDamage.Title', 'CAT.OptionalBonusDamage.Context', bonuses.map(b => b.document), {max: null, checkbox: true, displayTooltips: true, sort: 'alphabetical', showUses: true, validate, tags, selects, locked, keys, labels});
        if (selection) {
            selection.forEach(i => { if (i.select) selections[i.key] = i.select; });
            checkedOptional = selection.filter(i => i.amount && !byId.get(i.key)?.contextual).map(i => i.key);
        }
    }
    const chosen = [...resolveActive(checkedOptional, selections)].map(id => ({bonus: byId.get(id), target: targets.find(t => t.uuid === selections[id]) ?? targets[0]})).filter(i => i.bonus);
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
