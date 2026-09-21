import PhasedDialogApp from '../applications/phased-dialog.mjs';
import {constants, D20Bonus, DamageBonus, Events} from '../lib/_module.mjs';
import {dialogUtils, rollUtils, workflowUtils} from '../utilities/_module.mjs';

const phaseLabels = {
    preRoll: 'CAT.OptionalBonus.Phase.PreRoll',
    preResult: 'CAT.OptionalBonus.Phase.PreResult',
    postResult: 'CAT.OptionalBonus.Phase.PostResult'
};

async function resolveBonusRolls(bonuses, actor, rollClass) {
    const label = bonuses.map(bonus => bonus.name).join(', ');
    return await rollUtils.resolveManualRolls(bonuses.map(bonus => bonus.roll), actor, label, {rollClass});
}

class BonusSession {
    #app;
    #phaseIds;
    #workflow;
    #outcome;
    #spent = {};
    #bonuses = [];
    #consumed = new Set();
    #pendingD20 = [];
    #dismissed = false;
    #ran = new Set();
    #damageBonuses = [];
    #committed = [];
    constructor({phaseIds = Object.values(constants.bonusPhases), workflow} = {}) {
        this.#phaseIds = phaseIds;
        this.#workflow = workflow;
    }

    get damageBonuses() {
        return this.#damageBonuses;
    }
    get outcome() {
        return this.#outcome;
    }
    set outcome(value) {
        this.#outcome = value;
    }

    collect(bonuses, {targetActor} = {}) {
        const workflow = this.#workflow;
        for (const bonus of bonuses) {
            if (!(bonus instanceof D20Bonus) && !(bonus instanceof DamageBonus)) continue;
            if (!bonus.initialized) bonus.initialize(workflow);
            if (targetActor) bonus.targetActor = targetActor;
            if (bonus.maxTargets > 0 && workflow?.targets.size === 1) bonus.maxTargets = 0;
            this.#bonuses.push(bonus);
        }
    }

    async phase(phaseId, {rolls, damageRolls = [], prompt = true} = {}) {
        if (this.#ran.has(phaseId)) return;
        this.#ran.add(phaseId);
        const workflow = this.#workflow;
        const roll = rolls?.[0];
        const candidates = this.#bonuses.filter(bonus => !this.#consumed.has(bonus) && (!(bonus instanceof D20Bonus) || bonus.phase.has(phaseId)));
        const built = await dialogUtils.buildBonusInputs(candidates, {
            rolls,
            targets: workflow?.targets.map(token => token.document),
            workflow,
            spent: this.#spent,
            committed: this.#committed,
            outcome: this.#outcome,
            damageRolls: [...damageRolls, ...this.#damageBonuses.map(bonus => bonus.roll)]
        });
        if (this.#dismissed || !prompt || !built?.hasOptional) return this.#commit(this.#validate(candidates.filter(b => !b.optional), roll), candidates);
        this.#app ??= new PhasedDialogApp('CAT.OptionalBonus.Title', {
            phases: this.#phaseIds.map(id => ({id, label: phaseLabels[id]}))
        });
        const choices = await this.#app.showPhase(phaseId, {content: built?.hasOptional ? 'CAT.OptionalBonus.Content' : undefined, inputs: built?.inputs ?? []});
        if (!choices) {
            this.#dismissed = true;
            this.#app = undefined;
            return this.#commit(this.#validate(candidates.filter(b => !b.optional), roll), candidates);
        }
        built?.readInputs(choices);
        return this.#commit(this.#validate(candidates, roll), candidates);
    }

    #validate(candidates, roll) {
        return D20Bonus.ValidateAll(candidates, {workflow: this.#workflow, spent: this.#spent, roll, outcome: this.#outcome});
    }

    async #commit(active, candidates) {
        const taken = active
            .filter(bonus => !(bonus.maxTargets && !bonus.targets.size))
            .sort((a, b) => b.priority - a.priority);
        D20Bonus.AddCosts(this.#spent, taken);
        for (const bonus of taken) {
            this.#consumed.add(bonus);
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
        for (const bonusRoll of await resolveBonusRolls(pending, actor, CONFIG.Dice.BasicRoll)) {
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

function getAttackOutcome(workflow) {
    const roll = workflow.attackRoll;
    if (!roll) return;
    const outcome = {isCritical: roll.isCritical, isFumble: roll.isFumble};
    if (roll.isFumble) return {...outcome, success: false};
    if (roll.isCritical) return {...outcome, success: true};
    if (workflow.targets.size !== 1) return;
    const ac = workflow.targets.first().actor?.system.attributes?.ac?.value;
    if (!Number.isNumeric(ac)) return;
    return {...outcome, success: (roll.total ?? 0) >= ac};
}

function getAttackPreview(workflow) {
    if (workflow.attackRoll || !workflow.activity?.hasAttack) return;
    const {parts, data} = workflow.activity.getAttackData?.() ?? {};
    if (!parts) return;
    const formula = Roll.replaceFormulaData(['1d20', ...parts].join(' + '), data ?? {}, {missing: '0'});
    return new CONFIG.Dice.BasicRoll(formula, data ?? {});
}

async function collectBonuses(workflow, pass) {
    const event = new Events.WorkflowEvent(pass, workflow);
    return (await event.run({multiResult: true, canOverlap: true})).filter(i => i.document);
}

async function applyPending(workflow, session) {
    if (!workflow.attackRoll) return;
    const roll = await session.applyD20(workflow.attackRoll, workflow.actor);
    if (roll !== workflow.attackRoll) await workflow.setAttackRoll(roll);
}

async function attackPhase(workflow, session, phase, {prompt} = {}) {
    await applyPending(workflow, session);
    const preview = getAttackPreview(workflow);
    const rolls = workflow.attackRoll ? [workflow.attackRoll] : preview ? [preview] : undefined;
    await session.phase(phase, {rolls, prompt});
    await applyPending(workflow, session);
}

async function attackPreRoll(workflow) {
    if (!workflow.activity?.hasAttack) return;
    const session = new BonusSession({workflow});
    workflowUtils.setWorkflowProperty(workflow, 'optionalBonusSession', session);
    session.collect(await collectBonuses(workflow, constants.workflowPasses.optionalBonusAttack), {targetActor: workflow.actor});
    await attackPhase(workflow, session, constants.bonusPhases.preRoll);
}

async function attack(workflow) {
    const session = getSession(workflow);
    if (!session || !workflow.attackRoll) return;
    const fumble = workflow.attackRoll.isFumble;
    await attackPhase(workflow, session, constants.bonusPhases.preResult, {prompt: !fumble});
    session.outcome = getAttackOutcome(workflow);
    await attackPhase(workflow, session, constants.bonusPhases.postResult, {prompt: !fumble && !session.outcome?.success});
    await session.close();
}

function getDamageOutcome(workflow) {
    if (workflow.activity?.hasAttack) return {success: workflow.hitTargets?.size > 0};
    if (workflow.activity?.hasSave) return {success: workflow.failedSaves?.size > 0};
}

async function damage(workflow) {
    await getSession(workflow)?.close();
    if (!workflow.damageRolls?.length) return;
    const session = new BonusSession({phaseIds: [constants.bonusPhases.postResult], workflow});
    session.outcome = getDamageOutcome(workflow);
    session.collect(await collectBonuses(workflow, constants.workflowPasses.optionalBonusDamage), {targetActor: workflow.actor});
    await session.phase(constants.bonusPhases.postResult, {damageRolls: workflow.damageRolls});
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
        if (bonus.targets.size > 0 && bonus.targets.size !== workflow.targets.size) {
            targeted.push(bonus);
            continue;
        }
        if (!bonus.roll._evaluated) await bonus.roll.evaluate({allowInteractive: false});
        fullRoll.push(bonus.roll);
    }
    if (fullRoll.length) {
        rolls.push(...fullRoll);
        await workflow.setDamageRolls(rolls);
    }
    if (!targeted.length) return;
    const targetedRolls = await resolveBonusRolls(targeted, workflow.actor, CONFIG.Dice.DamageRoll);
    for (const [i, bonus] of targeted.entries()) {
        bonus.roll = targetedRolls[i];
        if (!bonus.roll._evaluated) await bonus.roll.evaluate({allowInteractive: false});
        const type = bonus.roll.options.type ?? defaultDamageType;
        for (const target of bonus.targets) {
            targetedData[target.uuid] ??= [];
            targetedData[target.uuid].push({total: type === 'healing' ? -bonus.roll.total : bonus.roll.total, type});
        }
        await bonus.roll.toMessage({
            flavor: `${bonus.name}: ${Array.from(bonus.targets).map(t => t.name).join(', ')}`,
            speaker: ChatMessage.implementation.getSpeaker({token: workflow.token}),
            rollMode: 'roll'
        });
    }
    workflowUtils.setWorkflowProperty(workflow, 'optionalBonusDamage', targetedData);
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

const rollEvents = {
    check: 'CheckEvent',
    save: 'SaveEvent',
    skill: 'SkillEvent',
    tool: 'ToolEvent'
};

function rollSession() {
    return new BonusSession();
}

async function rollPhase(actor, roll, session, phase, {prompt} = {}) {
    roll = await session.applyD20(roll, actor);
    await session.phase(phase, {rolls: [roll], prompt});
    return await session.applyD20(roll, actor);
}

async function rollPreRoll(type, actor, data, session) {
    const event = new Events[rollEvents[type]](actor, constants.rollPasses.optionalBonus, data);
    const bonuses = (await event.run({multiResult: true, canOverlap: true})).filter(i => i.document);
    session.collect(bonuses, {targetActor: actor});
    await session.phase(constants.bonusPhases.preRoll);
}

async function rollResult(type, actor, data, session) {
    const fumble = type === 'save' && data.roll.isFumble && MidiQOL.checkRule('criticalSaves');
    let roll = await rollPhase(actor, data.roll, session, constants.bonusPhases.preResult, {prompt: !fumble});
    session.outcome = {success: roll.isSuccess, isCritical: roll.isCritical, isFumble: roll.isFumble};
    roll = await rollPhase(actor, roll, session, constants.bonusPhases.postResult, {prompt: !fumble && !session.outcome.success});
    await session.close();
    return roll;
}

export default {
    attack,
    attackPreRoll,
    cleanup,
    damage,
    applyDamage,
    rollPreRoll,
    rollResult,
    rollSession
};
