import PhasedDialogApp from '../applications/phased-dialog.mjs';
import manualRolls from '../handlers/manualRolls.mjs';
import {constants, D20Bonus, DamageBonus, Events} from '../lib/_module.mjs';
import {activityUtils, dialogUtils, workflowUtils} from '../utilities/_module.mjs';

const phaseLabels = {
    preRoll: 'CAT.OptionalBonus.Phase.PreRoll',
    preResult: 'CAT.OptionalBonus.Phase.PreResult',
    postResult: 'CAT.OptionalBonus.Phase.PostResult'
};

class BonusSession {
    #app;
    #phaseIds;
    #workflow;
    #outcome;
    #spent = {};
    #consumed = new Set();
    #pendingD20 = [];
    #dismissed = false;
    #hasD20;
    #ran = new Set();
    #damageBonuses = [];
    #committed = [];
    constructor({phaseIds = [], workflow, hasD20 = true} = {}) {
        this.#phaseIds = phaseIds;
        this.#workflow = workflow;
        this.#hasD20 = hasD20;
    }

    get damageBonuses() {
        return this.#damageBonuses;
    }
    get phaseIds() {
        return this.#phaseIds;
    }
    hasRun(phaseId) {
        return this.#ran.has(phaseId);
    }
    rerun(phaseId) {
        this.#ran.delete(phaseId);
    }
    get outcome() {
        return this.#outcome;
    }
    set outcome(value) {
        this.#outcome = value;
    }

    #outcomeLabel(phaseId) {
        if (phaseId !== constants.bonusPhases.postResult || !this.#outcome) return;
        const attack = !!this.#workflow?.activity?.hasAttack;
        return _loc(this.#outcome.success
            ? (attack ? 'CAT.OptionalBonus.Hit' : 'CAT.OptionalBonus.Success')
            : (attack ? 'CAT.OptionalBonus.Miss' : 'CAT.OptionalBonus.Failure'));
    }

    static #key(bonus) {
        return (bonus.document?.uuid ?? '') + '.' + bonus.identifier;
    }

    async phase(phaseId, bonuses, {rolls, damageRolls = [], targetActor} = {}) {
        if (!this.#phaseIds.includes(phaseId) || this.#ran.has(phaseId)) return;
        this.#ran.add(phaseId);
        const workflow = this.#workflow;
        const candidates = [];
        for (const bonus of bonuses) {
            if (!(bonus instanceof D20Bonus) && !(bonus instanceof DamageBonus)) continue;
            if (!this.#hasD20 && bonus instanceof D20Bonus) continue;
            if (this.#consumed.has(BonusSession.#key(bonus))) continue;
            if (!bonus.initialized) bonus.initialize(workflow);
            if (targetActor) bonus.targetActor = targetActor;
            if (bonus.maxTargets > 0 && workflow?.targets.size === 1) bonus.maxTargets = 0;
            candidates.push(bonus);
        }
        const targets = workflow?.targets.map(token => token.document);
        const built = await dialogUtils.buildBonusInputs(candidates, {rolls, targets, workflow, spent: this.#spent, committed: this.#committed, outcome: this.#outcomeLabel(phaseId), missed: this.#outcome?.success === false, damageRolls: [...damageRolls, ...this.#damageBonuses.map(bonus => bonus.roll)]});
        if (this.#dismissed || (!built?.hasOptional && !this.#app)) return this.#commit(this.#validate(candidates.filter(b => !b.optional)), candidates);
        this.#app ??= new PhasedDialogApp('CAT.OptionalBonus.Title', {
            phases: this.#phaseIds.map(id => ({id, label: phaseLabels[id]}))
        });
        const choices = await this.#app.showPhase(phaseId, {content: built?.hasOptional ? 'CAT.OptionalBonus.Content' : undefined, inputs: built?.inputs ?? []});
        if (!choices) {
            this.#dismissed = true;
            this.#app = undefined;
            return this.#commit(this.#validate(candidates.filter(b => !b.optional)), candidates);
        }
        return this.#commit(this.#validate(candidates), candidates);
    }

    #validate(candidates) {
        const workflow = this.#workflow;
        return [
            ...D20Bonus.ValidateAll(candidates.filter(b => b instanceof D20Bonus), {workflow, spent: this.#spent}),
            ...DamageBonus.ValidateAll(candidates.filter(b => b instanceof DamageBonus), {workflow, spent: this.#spent})
        ];
    }

    async #commit(active, candidates) {
        const taken = active
            .filter(bonus => !(bonus.maxTargets && !bonus.targets.size))
            .sort((a, b) => b.priority - a.priority);
        D20Bonus.AddCosts(this.#spent, taken);
        for (const bonus of taken) {
            this.#consumed.add(BonusSession.#key(bonus));
            this.#committed.push(bonus);
            if (bonus instanceof DamageBonus) {
                this.#damageBonuses.push(bonus);
                continue;
            }
            if (bonus.use) await bonus.use(this.#workflow, candidates);
            this.#pendingD20.push(bonus);
        }
        this.#damageBonuses.sort((a, b) => b.priority - a.priority);
    }

    async applyD20(roll, actor) {
        if (!roll || !this.#pendingD20.length) return roll;
        const pending = this.#pendingD20.splice(0).filter(bonus => bonus.roll.formula !== '0');
        if (!pending.length) return roll;
        const label = pending.map(bonus => bonus.name).join(', ');
        const rolls = await manualRolls.resolveManualRolls(pending.map(bonus => bonus.roll), actor, label, {rollClass: CONFIG.Dice.BasicRoll});
        for (const bonusRoll of rolls) {
            if (!bonusRoll._evaluated) await bonusRoll.evaluate();
            const merged = MidiQOL.addRollTo(roll, bonusRoll);
            merged.data = roll.data;
            roll = merged;
        }
        return roll;
    }

    async close() {
        await this.#app?.close();
        this.#app = undefined;
    }
}

function getSession(workflow) {
    return workflowUtils.getWorkflowProperty(workflow, 'optionalBonusSession');
}

function startSession(workflow, phaseIds, {hasD20 = true} = {}) {
    const session = new BonusSession({phaseIds, workflow, hasD20});
    workflowUtils.setWorkflowProperty(workflow, 'optionalBonusSession', session);
    return session;
}

function getAttackOutcome(workflow) {
    const roll = workflow.attackRoll;
    if (!roll) return;
    if (roll.isFumble) return {success: false};
    if (roll.isCritical) return {success: true};
    if (workflow.targets.size !== 1) return;
    const ac = workflow.targets.first().actor?.system.attributes?.ac?.value;
    if (!Number.isNumeric(ac)) return;
    return {success: (roll.total ?? 0) >= ac};
}

function getDamagePreview(workflow) {
    if (workflow.damageRolls?.length) return workflow.damageRolls;
    if (!workflow.activity?.hasDamage && !workflow.activity?.hasHealing) return [];
    return activityUtils.getDefaultDamageRolls(workflow.activity) ?? [];
}

function getAttackPreview(workflow) {
    if (workflow.attackRoll || !workflow.activity?.hasAttack) return;
    const {parts, data} = workflow.activity.getAttackData?.() ?? {};
    if (!parts) return;
    const formula = Roll.replaceFormulaData(['1d20', ...parts].join(' + '), data ?? {}, {missing: '0'});
    return new CONFIG.Dice.BasicRoll(formula, data ?? {});
}

async function collectBonuses(workflow, pass, phase, outcome) {
    const event = new Events.WorkflowEvent(pass, workflow, {phase, outcome});
    return (await event.run({multiResult: true, canOverlap: true, phase})).filter(i => i.document);
}

async function applyPending(workflow, session) {
    if (!workflow.attackRoll) return;
    const roll = await session.applyD20(workflow.attackRoll, workflow.actor);
    if (roll !== workflow.attackRoll) await workflow.setAttackRoll(roll);
}

async function workflowPhase(workflow, session, phase) {
    await applyPending(workflow, session);
    const preview = getAttackPreview(workflow);
    const rolls = workflow.attackRoll ? [workflow.attackRoll] : preview ? [preview] : undefined;
    const outcome = session.outcome;
    const bonuses = [
        ...await collectBonuses(workflow, constants.workflowPasses.optionalBonusAttack, phase, outcome),
        ...await collectBonuses(workflow, constants.workflowPasses.optionalBonusDamage, phase, outcome)
    ];
    await session.phase(phase, bonuses, {rolls, damageRolls: getDamagePreview(workflow), targetActor: workflow.actor});
    await applyPending(workflow, session);
}

async function attackPreRoll(workflow) {
    const session = startSession(workflow, [constants.bonusPhases.preRoll, constants.bonusPhases.preResult, constants.bonusPhases.postResult]);
    await workflowPhase(workflow, session, constants.bonusPhases.preRoll);
}

async function attack(workflow) {
    if (!workflow.attackRoll) return;
    const session = getSession(workflow) ?? startSession(workflow, [constants.bonusPhases.preResult, constants.bonusPhases.postResult]);
    await workflowPhase(workflow, session, constants.bonusPhases.preResult);
    session.outcome = getAttackOutcome(workflow);
    if (!session.outcome) return await session.close();
    const missed = !session.outcome.success;
    workflow.hitTargets = session.outcome.success ? new Set(workflow.targets) : new Set();
    await workflowPhase(workflow, session, constants.bonusPhases.postResult);
    session.outcome = getAttackOutcome(workflow);
    if (missed && session.outcome?.success) {
        workflow.hitTargets = new Set(workflow.targets);
        session.rerun(constants.bonusPhases.postResult);
        await workflowPhase(workflow, session, constants.bonusPhases.postResult);
    }
    await session.close();
}

async function preambleComplete(workflow) {
    if (workflow.activity?.hasAttack) return;
    if (!workflow.activity?.hasDamage && !workflow.activity?.hasHealing) return;
    const session = startSession(workflow, [constants.bonusPhases.preRoll, constants.bonusPhases.postResult], {hasD20: false});
    await workflowPhase(workflow, session, constants.bonusPhases.preRoll);
}

async function savesComplete(workflow) {
    const session = getSession(workflow);
    if (!session || workflow.activity?.hasAttack) return;
    session.outcome = {success: workflow.failedSaves?.size > 0};
    await workflowPhase(workflow, session, constants.bonusPhases.postResult);
    await session.close();
}

const rollEvents = {
    check: 'CheckEvent',
    save: 'SaveEvent',
    skill: 'SkillEvent',
    tool: 'ToolEvent'
};

function rollSession() {
    return new BonusSession({phaseIds: [constants.bonusPhases.preRoll, constants.bonusPhases.preResult, constants.bonusPhases.postResult]});
}

async function rollPhase(type, actor, data, session, phase) {
    const roll = await session.applyD20(data.roll, actor);
    const event = new Events[rollEvents[type]](actor, constants.rollPasses.optionalBonus, {...data, roll, phase, outcome: session.outcome});
    const bonuses = (await event.run({multiResult: true, canOverlap: true, phase})).filter(i => i.document);
    await session.phase(phase, bonuses, {rolls: roll ? [roll] : undefined, targetActor: actor});
    return await session.applyD20(roll, actor);
}

async function rollPreRoll(type, actor, data, session) {
    await rollPhase(type, actor, data, session, constants.bonusPhases.preRoll);
}

async function rollResult(type, actor, data, session) {
    let roll = await rollPhase(type, actor, data, session, constants.bonusPhases.preResult);
    session.outcome = {success: roll.isSuccess, isCritical: roll.isCritical, isFumble: roll.isFumble};
    roll = await rollPhase(type, actor, {...data, roll}, session, constants.bonusPhases.postResult);
    await session.close();
    return roll;
}

async function damage(workflow) {
    const session = getSession(workflow);
    if (!session) return;
    const postResult = constants.bonusPhases.postResult;
    if (session.phaseIds.includes(postResult) && !session.hasRun(postResult)) {
        session.outcome = {success: workflow.hitTargets?.size > 0};
        await workflowPhase(workflow, session, postResult);
    }
    await session.close();
    const bonuses = session.damageBonuses;
    if (!bonuses.length) return;
    const rolls = workflow.damageRolls;
    const targetedData = {}, fullRoll = [], targeted = [];
    const defaultDamageType = rolls[0]?.options.type ?? workflow.defaultDamageType;
    for (const bonus of bonuses) {
        if (workflow.isCritical) bonus.roll = DamageBonus.GetCriticalRoll(bonus);
        if (bonus.use) await bonus.use(workflow, bonuses);
        if (bonus.roll.formula === '0') continue;
        if (!bonus.roll._evaluated) await bonus.roll.evaluate();
        if (bonus.targets.size > 0) {
            if (bonus.targets.size === workflow.targets.size) {
                fullRoll.push(bonus.roll);
                continue;
            }
            targeted.push(bonus);
            for (const target of bonus.targets) {
                const type = bonus.roll.options.type ?? defaultDamageType;
                targetedData[target.uuid] ??= [];
                let total = bonus.roll.total;
                if (type === 'healing') total *= -1;
                targetedData[target.uuid].push({total, type});
            }
        } else fullRoll.push(bonus.roll);
    }
    if (fullRoll.length) {
        rolls.push(...fullRoll);
        await workflow.setDamageRolls(rolls);
    }
    if (targeted.length) {
        workflowUtils.setWorkflowProperty(workflow, 'optionalBonusDamage', targetedData);
        for (const bonus of targeted)
            await bonus.roll.toMessage({
                flavor: `${bonus.name}: ${Array.from(bonus.targets).map(t => t.name).join(', ')}`,
                speaker: ChatMessage.implementation.getSpeaker({token: workflow.token}),
                rollMode: 'roll'
            });
    }
}

async function cleanup(workflow) {
    await getSession(workflow)?.close();
}

function applyDamage(workflow, token, ditem) {
    const stash = workflowUtils.getWorkflowProperty(workflow, 'optionalBonusDamage');
    const bonuses = stash?.[token.document.uuid];
    if (!bonuses?.length) return;
    for (const {total, type} of bonuses) workflowUtils.modifyDamageAppliedFlat(ditem, total, {type, multiplier: 'auto'});
}

export default {
    attack,
    attackPreRoll,
    cleanup,
    preambleComplete,
    savesComplete,
    damage,
    applyDamage,
    rollPreRoll,
    rollResult,
    rollSession
};
