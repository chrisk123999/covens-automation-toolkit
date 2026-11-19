import {constants} from '../../lib/_module.mjs';
import {genericUtils, queryUtils} from '../../utilities/_module.mjs';
import uiUtils from '../../utilities/uiUtils.mjs';
import CatApp from '../cat-app.mjs';
import PromptTimer from '../prompt-timer.mjs';
const {RollResolver} = foundry.applications.dice;

export default class CatRollResolver extends RollResolver {
    static DEFAULT_OPTIONS = {
        classes: ['cat', 'cat-dialog', 'cat-roll-resolver'],
        window: {frame: false, positioned: true, contentClasses: ['standard-form']},
        position: {width: 'auto', height: 'auto'},
        actions: {toggleDetach: uiUtils.onToggleDetach, applyOutcome: CatRollResolver.#onApplyOutcome, toggleTimer: CatRollResolver.#onToggleTimer},
        form: {handler: this._fulfillRoll}
    };

    get detachable() {
        return true;
    }

    get closeAction() {
        return 'close';
    }

    static active = new Map();

    #timer = new PromptTimer(this, () => this.close());

    /** @this {CatRollResolver} */
    static #onToggleTimer() {
        if (!this.#timer.running) return;
        this.#timer.toggle();
        if (this._peer) queryUtils.query('manualRollPause', this._peer.user, {id: this._peer.id, paused: this.#timer.paused, left: this.#timer.left}).catch(() => {});
    }

    setTimerPaused(paused, left) {
        this.#timer.setPaused(paused, left);
    }

    async #awaitLocal(id) {
        if (id) CatRollResolver.active.set(id, this);
        const wait = this.#beginWait();
        await super.awaitFulfillment();
        wait?.end();
        if (id) CatRollResolver.active.delete(id);
    }

    #beginWait() {
        if (game.user.isGM) return;
        const text = document.createElement('div');
        text.innerHTML = this.#contextLabel().label;
        const choice = key => ({label: _loc(key), value: () => key});
        return MidiQOL.playerWaits.begin({
            kind: this.#rollContext().rollType ?? 'roll',
            userId: game.user.id,
            actorUuid: this.#actor()?.uuid,
            label: text.textContent,
            source: 'cat',
            choices: {roll: {label: _loc('CAT.Manual.WaitRoll'), value: () => 'roll'}, minimum: choice('CAT.Manual.Outcome.Minimum'), maximum: choice('CAT.Manual.Outcome.Maximum')},
            onSettled: answer => {
                if (answer !== 'roll') this._applyOutcome('roll-' + answer);
                this.close();
            }
        });
    }

    /** @this {CatRollResolver} */
    static #onApplyOutcome(_event, target) {
        this._pendingOutcome = target.dataset.outcome;
        this.element.requestSubmit();
    }

    bringToFront() {
        uiUtils.bringToFront(this);
    }

    static PARTS = {
        header: CatApp.HEADER_PART,
        body: {template: 'modules/cat/templates/dice/roll-resolver/body.hbs', scrollable: ['']},
        outcomes: {template: 'modules/cat/templates/dice/roll-resolver/outcomes.hbs'},
        footer: CatApp.FOOTER_PART
    };

    get outcomes() {
        const {rollType, flavor} = this.#rollContext();
        const type = (rollType ?? flavor ?? '').toLowerCase();
        const isTest = type.includes('sav') || ['skill', 'tool', 'abilityCheck', 'savingThrow', 'concentration', 'deathSave'].includes(this.#hook());
        const [prefix, names] = type.includes('attack') ? ['attack', ['fumble', 'miss', 'hit', 'critical']]
            : (isTest && this.#dcShown()) ? ['save', ['failure', 'success']] : ['roll', ['minimum', 'maximum']];
        const icons = {fumble: 'fa-skull-crossbones', miss: 'fa-xmark', hit: 'fa-check', critical: 'fa-check-double', failure: 'fa-thumbs-down', success: 'fa-thumbs-up', minimum: 'fa-angles-down', maximum: 'fa-angles-up'};
        return names.map(name => ({value: `${prefix}-${name}`, label: 'CAT.Manual.Outcome.' + name.capitalize(), icon: icons[name]}));
    }

    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        if (!this.outcomes.length) delete parts.outcomes;
        return parts;
    }

    _pendingOutcome = null;

    #cachedWorkflow = null;

    static #entryMode() {
        return game.settings.get('cat', 'manualRollsEntryMode');
    }

    static async fulfillBatch(rolls, label, {prompt = false} = {}) {
        const {OperatorTerm, DiceTerm} = foundry.dice.terms;
        const terms = [];
        const termInfo = new Map();
        for (const roll of rolls) {
            if (terms.length) terms.push(new OperatorTerm({operator: '+'}));
            const mod = CatRollResolver.#flatTotal(roll.terms);
            const dice = roll.terms.filter(term => term instanceof DiceTerm);
            const anchor = dice.find(term => (CatRollResolver.#knownType(term.options?.flavor) ?? roll.options.type) === roll.options.type) ?? dice[0];
            for (const term of dice) {
                termInfo.set(term, {
                    type: roll.options.type,
                    properties: [...(roll.options.properties ?? [])].sort().join(','),
                    source: roll.options.cat?.source,
                    mod: term === anchor ? mod : 0,
                    tip: term === anchor && mod ? this.#breakdown(roll.data, roll.terms) : undefined
                });
            }
            terms.push(...roll.terms);
        }
        const combined = Roll.defaultImplementation.fromTerms(terms, {...rolls[0].options});
        const resolver = new this(combined);
        resolver._termInfo = termInfo;
        resolver._batchLabel = label;
        resolver._batchDamage = rolls.some(roll => CONFIG.Dice?.DamageRoll && roll instanceof CONFIG.Dice.DamageRoll);
        resolver._forcePrompt = prompt;
        await resolver.awaitFulfillment();
        await resolver.close();
    }

    #workflow() {
        if (this.#cachedWorkflow) return this.#cachedWorkflow;
        const context = this.roll.options?.cat?.context;
        if (context && !context.workflow) return null;
        const key = this.roll.options?.workflowId;
        const Workflow = globalThis.MidiQOL?.Workflow;
        if (!key || !Workflow) return null;
        const direct = Workflow.getWorkflow(key);
        if (direct) return this.#cachedWorkflow = direct;
        const workflows = [...Workflow.workflows.values()].map(w => w instanceof WeakRef ? w.deref() : w).filter(Boolean);
        return this.#cachedWorkflow = workflows
            .filter(w => w.activity?.uuid === key || (w.targets?.documents ?? []).some(t => t.actor?.uuid === key))
            .sort((a, b) => (b.workflowStartTime ?? 0) - (a.workflowStartTime ?? 0))[0] ?? null;
    }

    #rollContext() {
        const options = this.roll.options ?? {};
        const workflow = this.#workflow();
        const activity = workflow?.activity;
        let rollType = options.cat?.rollType ?? options.rollType;
        if (!rollType && activity?.type) rollType = activity.type === 'attack' ? 'attack' : (activity.save || activity.type === 'save') ? 'save' : activity.type;
        return {
            name: workflow?.item?.name ?? this.roll.data?.name,
            flavor: options.flavor ?? this.roll.d20?.options?.flavor ?? activity?.name,
            rollType
        };
    }

    /**
     * Whether midi has made this roll an automatic success or failure, set as a minimum of 99 or a maximum of 1.
     * @param {Roll} roll Roll to check.
     * @returns {boolean}
     */
    static isAutoResult(roll) {
        return roll.options?.minimum === 99 || roll.options?.maximum === 1;
    }

    async awaitFulfillment() {
        if (CatRollResolver.isAutoResult(this.roll)) return this.#digitalRoll();
        if (!this._forcePrompt) {
            if (this.#isDamage()) return this.#digitalRoll();
            if (!this.#checkPreferences()) return this.#digitalRoll();
        }
        const gm = game.users.activeGM && queryUtils.gmUser();
        const remote = gm && !queryUtils.isTheGM();
        const mode = remote ? game.settings.get('cat', 'manualRollsFulfiller') : 'player';
        const gmOnly = mode === 'gm';
        const shared = mode === 'both';
        if (!gmOnly && !shared) return this.#awaitLocal();
        const fulfillable = Roll.defaultImplementation.identifyFulfillableTerms(this.roll.terms);
        if (!fulfillable.length) return;
        const id = foundry.utils.randomID();
        this._peer = {user: gm, id};
        const data = {roll: this.roll.toJSON(), label: this.#contextLabel(), info: fulfillable.map(term => this._termInfo?.get(term) ?? null), damage: this.#isDamage(), id, user: game.user.name, userId: game.user.id, mode};
        let results;
        const answered = values => values?.some(entry => entry.length);
        const apply = values => fulfillable.forEach((term, i) => {
            term._id ??= foundry.utils.randomID();
            for (const result of values[i] ?? []) term.results.push({result, active: true});
        });
        const request = queryUtils.query('manualRoll', gm, data, 300000).then(values => {
            results = values;
            if (!shared || !answered(values) || this._submitted || fulfillable.some(term => term.results.length)) return;
            apply(values);
            this.close();
        }).catch(() => {
            if (gmOnly) genericUtils.notify('CAT.Manual.GMUnavailable', {type: 'warn'});
        });
        if (gmOnly) {
            let hookId;
            const gmLeft = new Promise(resolve => {
                hookId = Hooks.on('userConnected', (user, connected) => {
                    if (user === gm && !connected) resolve(true);
                });
            });
            const left = await Promise.race([request, gmLeft]);
            Hooks.off('userConnected', hookId);
            if (left) genericUtils.notify('CAT.Manual.GMDisconnected', {type: 'warn'});
            else if (answered(results)) apply(results);
        } else {
            await this.#awaitLocal(id);
            if (!answered(results)) queryUtils.query('manualRollCancel', gm, {id}).catch(() => {});
        }
        return this.#digitalRoll();
    }

    #checkPreferences() {
        if (!game.settings.get('cat', 'manualRollsUsers')?.includes(game.user.id)) return false;
        const inclusion = game.settings.get('cat', 'manualRollsInclusion');
        if (!inclusion) return false;
        const hasContext = this.#workflow() || this.#isDamage() || this.#hook() || (CONFIG.Dice?.D20Roll && this.roll instanceof CONFIG.Dice.D20Roll);
        if (!hasContext && !game.settings.get('cat', 'manualRollsPromptNoData')) return false;
        const actor = this.#actor();
        if (inclusion === 1) return true;
        if (inclusion === 2) return actor?.type === 'character';
        if (this.roll.data?.roll?.type === 'initiative' && actor && (actor.flags.cat?.summon || (actor.type === 'npc' && actor.hasPlayerOwner))) return false;
        if (inclusion === 3) return actor?.prototypeToken?.actorLink === true;
        if (inclusion === 4) return actor?.prototypeToken?.actorLink === true && !!actor?.hasPlayerOwner;
        if (inclusion === 5) return !!actor?.hasPlayerOwner;
        return false;
    }

    static shouldForce(actor) {
        if (!game.settings.get('cat', 'manualRollsUsers')?.includes(game.user.id)) return false;
        const inclusion = game.settings.get('cat', 'manualRollsInclusion');
        switch (inclusion) {
            case 1: return true;
            case 2: return actor?.type === 'character';
            case 3: return actor?.prototypeToken?.actorLink === true;
            case 4: return actor?.prototypeToken?.actorLink === true && !!actor?.hasPlayerOwner;
            case 5: return !!actor?.hasPlayerOwner;
            default: return false;
        }
    }

    #actor() {
        const uuid = this.roll.options?.cat?.context?.actorUuid ?? this.roll.data?.actorUuid;
        return this.#workflow()?.actor ?? (uuid ? fromUuidSync(uuid) : null);
    }

    async #digitalRoll() {
        for (const term of Roll.defaultImplementation.identifyFulfillableTerms(this.roll.terms)) {
            term._id ??= foundry.utils.randomID();
            for (let i = term.results.length; i < (term.number ?? 1); i++) term.results.push({result: term.randomFace(), active: true});
        }
    }

    #isDamage() {
        return this._batchDamage || (CONFIG.Dice?.DamageRoll && this.roll instanceof CONFIG.Dice.DamageRoll);
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const mode = CatRollResolver.#entryMode();
        const total = mode !== 'perDie';
        const rollTotal = mode === 'rollTotal';
        const damageGroups = [];
        for (const [id, group] of Object.entries(context.groups)) {
            if (group.results[0]?.method !== 'cat') continue;
            const term = this.fulfillable.get(id)?.term;
            const damage = this.#damage(term);
            const info = this._termInfo?.get(term);
            const groupMod = this.#groupModifier(term);
            if (damage) {
                const damageLabel = _loc(damage.config.label);
                if (!groupMod) damageGroups.push({id, group, term, damage: damageLabel, key: `${damage.type}|${info?.properties ?? ''}`});
                group.icon = `<img class="dmg" src="${constants.damageIcons[damage.type] ?? damage.config.icon}">`;
            }
            if (groupMod && (damage || term?.faces !== 20)) {
                group.modifier = CatRollResolver.#signed(groupMod);
                group.modifierTooltip = info?.tip ?? this.#modifierBreakdown(this.#rollContaining(term));
            }
            if (term?.faces === 20) {
                const mod = this.#flatModifier();
                if (mod) {
                    group.modifier = CatRollResolver.#signed(mod);
                    group.modifierTooltip = this.#modifierBreakdown();
                }
                const adv = this.#advantageInfo(term);
                if (adv) {
                    group.label = `${term.number}d${term.faces} ${adv.label}`;
                    group.labelTooltip = adv.tooltip;
                }
            }
            if (total) {
                const n = term.number ?? 1;
                const useRollTotal = rollTotal && !!this.#rollContaining(term);
                const mod = useRollTotal ? groupMod : 0;
                group.results = [{...group.results[0], value: '', readonly: false, disabled: false, text: n > 1, minValue: useRollTotal ? null : n, maxValue: n * term.faces + mod, denomination: _loc(useRollTotal ? 'CAT.Manual.RollTotal' : 'CAT.Manual.DiceTotal')}];
            } else {
                for (const result of group.results) result.readonly = false;
            }
        }
        if (total) this.#mergeDamageGroups(context, damageGroups);
        const label = this.#contextLabel();
        context.formula = label.label;
        context.formulaIcon = label.icon;
        context.formulaSub = label.sub ?? null;
        context.title = this._fulfillFor ? _loc('CAT.Manual.TitleFor', {user: this._fulfillFor}) : 'CAT.Manual.Title';
        if (this._fulfillFor) {
            const shared = this._fulfillMode === 'both';
            context.titleIcon = shared ? 'fa-user-group' : 'fa-user-shield';
            context.titleIconTooltip = _loc(shared ? 'CAT.Manual.SharedTooltip' : 'CAT.Manual.GMOnlyTooltip', {user: this._fulfillFor});
        }
        context.detachable = this.detachable;
        context.closeAction = this.closeAction;
        Object.assign(context, uiUtils.detachContext(this, options));
        context.buttons = [{label: 'CAT.Manual.Submit', icon: 'fa-solid fa-dice-d20', role: 'positive'}];
        context.outcomes = this.outcomes;
        context.timer = PromptTimer.enabled;
        return context;
    }

    #mergeDamageGroups(context, damageGroups) {
        this._mergedTerms = new Map();
        for (const bucket of Object.values(Object.groupBy(damageGroups, entry => entry.key))) {
            if (bucket.length < 2) continue;
            const [primary, ...rest] = bucket;
            const terms = bucket.map(entry => entry.term);
            const dice = CatRollResolver.#diceTotal(terms);
            const max = terms.reduce((sum, term) => sum + Math.max(term.number ?? 1, 1) * term.faces, 0);
            const parts = [];
            for (const term of terms) {
                const count = Math.max(term.number ?? 1, 1);
                if (parts.at(-1)?.faces === term.faces) parts.at(-1).count += count;
                else parts.push({faces: term.faces, count});
            }
            primary.group.label = parts.map(part => `${part.count}d${part.faces}`).join(' + ');
            Object.assign(primary.group.results[0], {label: primary.group.label, text: true, minValue: dice, maxValue: max});
            this._mergedTerms.set(primary.id, bucket.map(entry => entry.term));
            for (const entry of rest) delete context.groups[entry.id];
        }
    }

    static #diceTotal(terms) {
        return terms.reduce((sum, term) => sum + Math.max(term.number ?? 1, 1), 0);
    }

    #fulfillMerged(merged, value) {
        if (value === null) {
            for (const part of merged) {
                for (let i = Math.max(part.number ?? 1, 1); i > 0; i--) part.results.push({result: part.randomFace(), active: true});
            }
            return;
        }
        const entries = CatRollResolver.#parseEntries(value);
        if (Array.isArray(entries)) {
            let offset = 0;
            for (const part of merged) {
                const n = Math.max(part.number ?? 1, 1);
                const slice = entries.slice(offset, offset + n);
                offset += n;
                for (let i = slice.length; i < n; i++) slice.push(part.randomFace());
                for (const result of this._backsolve(part, slice.join(','), 'diceTotal')) part.results.push(result);
            }
            return;
        }
        const shares = CatRollResolver.#splitMergedTotal(merged, entries);
        merged.forEach((part, index) => {
            for (const result of this._backsolve(part, shares[index], 'diceTotal')) part.results.push(result);
        });
    }

    static #parseEntries(value) {
        const raw = String(value ?? '');
        if (!/[\s,]/.test(raw.trim())) return Number(raw) || 0;
        return raw.split(/[\s,]+/).filter(part => part !== '').map(Number);
    }


    static #splitMergedTotal(terms, total) {
        const counts = terms.map(term => Math.max(term.number ?? 1, 1));
        const shares = counts.slice();
        let left = Math.max(total, CatRollResolver.#diceTotal(terms)) - counts.reduce((sum, n) => sum + n, 0);
        for (let i = 0; i < terms.length && left > 0; i++) {
            const take = Math.min(left, counts[i] * (terms[i].faces - 1));
            shares[i] += take;
            left -= take;
        }
        return shares;
    }

    #contextLabel() {
        if (this._remoteLabel) return this._remoteLabel;
        const rich = game.settings.get('cat', 'manualRollsRichContext');
        const actorFirst = !['savingThrow', undefined].includes(this.#hook());
        if (rich && !actorFirst) {
            const save = this.#saveContext();
            if (save) return save;
            const action = this.#actionContext();
            if (action) return {...action, sub: this.#criticalLine()};
        }
        const actorRoll = this.#actorContext();
        if (actorRoll) {
            const label = rich ? actorRoll.prose : foundry.utils.escapeHTML([actorRoll.source, actorRoll.title].filter(Boolean).join(' - '));
            return {label, icon: null, sub: this.#dcShown() ? _loc('CAT.Manual.DCLine', {dc: this.roll.options.target}) : null};
        }
        const escape = foundry.utils.escapeHTML;
        const plainAction = this.#plainActionLabel();
        if (plainAction) return {label: escape(plainAction), icon: null, sub: this.#criticalLine()};
        if (this._batchLabel) return {label: escape(this._batchLabel), icon: null, sub: this.#criticalLine()};
        const {name, flavor} = this.#rollContext();
        if (!name && !flavor) return {label: escape(this.#prettyFormula()), icon: '<i class="fa-solid fa-comments"></i>'};
        return {label: escape([name, flavor].filter(Boolean).join(' - ')), icon: null};
    }

    #plainActionLabel() {
        const workflow = this.#workflow();
        const {rollType} = this.#rollContext();
        const source = workflow?.token?.name ?? workflow?.actor?.name;
        if (!['attack', 'damage', 'heal'].includes(rollType) || !source || !workflow?.item) return null;
        const heal = {temphp: 'DND5E.HEAL.Type.Temporary', maximum: 'DND5E.HEAL.Type.Maximum'}[this.roll.options?.type] ?? 'CAT.Manual.Healing';
        const roll = _loc({attack: 'DND5E.Attack', damage: 'DND5E.Damage', heal}[rollType]);
        return source + ' - ' + workflow.item.name + ' (' + roll + ')';
    }

    #hook() {
        return this.roll.options?.cat?.context?.hook ?? (this.roll.data?.roll?.type === 'initiative' ? 'initiativeDialog' : undefined);
    }

    #criticalLine() {
        return this.roll.options?.cat?.critical ? _loc('CAT.Manual.CriticalHit') : null;
    }

    #actorContext() {
        const hook = this.#hook();
        if (!hook) return null;
        const context = this.roll.options?.cat?.context ?? {};
        const abilityKey = context.ability ?? this.roll.data?.roll?.ability;
        const ability = _loc(CONFIG.DND5E.abilities[abilityKey]?.label ?? abilityKey ?? '');
        const skill = _loc(CONFIG.DND5E.skills[context.skill]?.label ?? context.skill ?? '');
        const tool = context.tool ? dnd5e.documents.Trait.keyLabel(context.tool, {trait: 'tool'}) : '';
        const die = context.denomination ?? '';
        const titles = {
            skill: () => _loc('DND5E.SkillPromptTitle', {ability, skill}),
            tool: () => _loc('DND5E.ToolPromptTitle', {tool}),
            abilityCheck: () => _loc('DND5E.AbilityPromptTitle', {ability}),
            savingThrow: () => _loc('DND5E.SavePromptTitle', {ability}),
            concentration: () => _loc('DND5E.SavePromptTitle', {ability}) + ' (' + _loc('DND5E.Concentration') + ')',
            deathSave: () => _loc('DND5E.DeathSavingThrow'),
            hitDie: () => _loc('DND5E.HitDie') + (die ? ' (' + die + ')' : ''),
            initiativeDialog: () => _loc('DND5E.Initiative')
        };
        const actor = this.#actor();
        const source = actor?.name ?? this.roll.data?.name;
        const [sentence, rollKey] = {
            skill: ['makes', 'skill'],
            tool: ['makes', 'tool'],
            abilityCheck: ['makes', 'check'],
            savingThrow: ['makes', 'save'],
            concentration: ['concentration', 'save'],
            deathSave: ['makes', 'deathSave'],
            hitDie: ['rolls', 'hitDie'],
            initiativeDialog: ['rolls', 'initiative']
        }[hook];
        const roll = CatRollResolver.#action(_loc('CAT.Manual.Roll.' + rollKey, {ability, skill, tool}));
        const spells = hook === 'concentration' ? [...(actor?.concentration?.items ?? [])] : [];
        const key = 'CAT.Manual.ActorRoll.' + sentence + (spells.length === 1 ? 'On' : '');
        const prose = _loc(key, {source: CatRollResolver.#creature(source, actor), roll, spell: spells.length === 1 ? CatRollResolver.#cause(spells[0].name) : ''});
        return {title: titles[hook]?.() ?? null, source, prose};
    }

    static #action(text) {
        return `<span class="roll-action">${foundry.utils.escapeHTML(text)}</span>`;
    }

    static #cause(text) {
        return `<span class="roll-source">${foundry.utils.escapeHTML(text)}</span>`;
    }

    #dcShown() {
        if (!Number.isNumeric(this.roll.options?.target)) return false;
        if (this.#hook() === 'deathSave') return true;
        const card = this.#workflow() ? null : this.#card();
        const caster = card?.flags?.['midi-qol']?.sourceActorUuid ? fromUuidSync(card.flags['midi-qol'].sourceActorUuid) : this.#actor();
        return this.#dcVisible(caster);
    }

    #card() {
        const key = this.roll.options?.workflowId;
        return (typeof key === 'string' && key.startsWith('ChatMessage.')) ? fromUuidSync(key) : null;
    }

    #saveContext() {
        const {rollType} = this.#rollContext();
        if (rollType !== 'save') return null;
        const workflow = this.#workflow();
        const card = workflow ? null : this.#card();
        const activity = workflow?.activity ?? card?.getAssociatedActivity();
        const item = workflow?.item ?? activity?.item ?? card?.getAssociatedItem();
        if (!item) return null;
        const token = workflow?.token?.document ?? (card?.speaker?.token ? canvas.scene?.tokens.get(card.speaker.token) : null);
        const visible = game.user.isGM || token?.object?.visible;
        const sourceName = token?.name ?? workflow?.actor?.name ?? card?.speaker?.alias;
        const source = visible && sourceName ? CatRollResolver.#creature(sourceName, token ?? workflow?.actor) : foundry.utils.escapeHTML(_loc('CAT.Manual.UnknownSource'));
        const context = this.roll.options?.cat?.context ?? {};
        const saverActor = context.actorUuid ? fromUuidSync(context.actorUuid) : null;
        const saver = CatRollResolver.#creature(saverActor?.name ?? this.roll.data?.name, saverActor);
        const abilityKey = context.ability ?? [...(activity?.save?.ability ?? [])][0];
        const ability = _loc(CONFIG.DND5E.abilities[abilityKey]?.label ?? abilityKey ?? '');
        return {
            label: _loc('CAT.Manual.SaveContext', {
                saver,
                roll: CatRollResolver.#action(_loc('CAT.Manual.Roll.save', {ability})),
                source,
                item: CatRollResolver.#cause(item.name)
            }),
            icon: null,
            sub: this.#dcShown() ? _loc('CAT.Manual.DCLine', {dc: this.roll.options.target}) : null
        };
    }

    #dcVisible(actor) {
        return game.user.isGM || MidiQOL.shouldDisplaySaveDC(actor);
    }

    #actionContext() {
        const workflow = this.#workflow();
        const data = this.roll.data ?? {};
        const {rollType} = this.#rollContext();
        const source = workflow?.token?.name ?? workflow?.actor?.name ?? data.name;
        const item = workflow?.item?.name ?? data.item?.name;
        if (!['attack', 'damage', 'heal'].includes(rollType) || !source || !item) return null;
        const targets = this.#targetNames();
        const kind = rollType + (rollType === 'heal' ? ({temphp: 'Temp', maximum: 'Max'}[this.roll.options?.type] ?? '') : '');
        const label = _loc(`CAT.Manual.Action.${kind}${targets ? '' : 'NoTarget'}`, {
            source: CatRollResolver.#creature(source, workflow?.token?.document ?? workflow?.actor),
            roll: CatRollResolver.#action(_loc('CAT.Manual.Roll.' + kind)),
            item: CatRollResolver.#cause(item),
            target: targets ?? ''
        });
        return {label, icon: null};
    }

    #targetNames() {
        const workflow = this.#workflow();
        const targets = workflow?.targets ? workflow.targets.documents : Array.from(game.user?.targets ?? [], t => t.document);
        if (!targets.length) return null;
        return targets.map(t => (t.object?.visible || game.user.isGM) ? CatRollResolver.#creature(t.name, t) : foundry.utils.escapeHTML(_loc('CAT.Manual.Unknown'))).join(', ');
    }

    static #creature(name, document) {
        const token = document instanceof Actor ? (document.token ?? document.getActiveTokens(false, true)[0]) : document;
        const disposition = token?.disposition ?? document?.prototypeToken?.disposition;
        const cls = {[CONST.TOKEN_DISPOSITIONS.FRIENDLY]: 'roll-friendly', [CONST.TOKEN_DISPOSITIONS.HOSTILE]: 'roll-hostile'}[disposition];
        const text = foundry.utils.escapeHTML(name ?? '');
        return cls ? `<span class="${cls}">${text}</span>` : text;
    }

    #prettyFormula() {
        const parts = [];
        for (const term of this.roll.terms) {
            if (term.operator) { parts.push(term.operator); continue; }
            if (term.faces !== undefined) {
                const type = CatRollResolver.#knownType(term.options?.type ?? term.options?.flavor);
                const damage = type && (CONFIG.DND5E?.damageTypes?.[type] ?? CONFIG.DND5E?.healingTypes?.[type]);
                parts.push(`${term.number ?? 1}d${term.faces}${damage ? ' ' + _loc(damage.label) : ''}`);
            } else if (term.number !== undefined) {
                parts.push(`${term.number}`);
            } else if (term.expression) {
                parts.push(term.expression);
            }
        }
        return parts.join(' ') || this.roll.formula;
    }

    async _preClose(options) {
        this.#timer.stop();
        options.animate = false;
        await uiUtils.fadeOut(this.element);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        uiUtils.enableWindowDrag(this);
        this.#timer.draw();
        if (options.isFirstRender) {
            this.#timer.start();
            this.bringToFront();
            this.element.querySelector('input:not([disabled])')?.focus();
        }
    }

    #modifierExcludingD20() {
        const d20 = [...this.fulfillable.values()].map(f => f.term).find(t => t.faces === 20);
        let total = 0, sign = 1;
        for (const term of this.roll.terms) {
            if (term.operator) { sign = term.operator === '-' ? -1 : 1; continue; }
            let value = 0;
            if (term === d20) value = 0;
            else if (term.faces !== undefined) value = term.number ?? 1;
            else value = CatRollResolver.#flatValue(term);
            total += sign * value;
            sign = 1;
        }
        return total;
    }

    #advantageInfo(term) {
        const mode = term.options?.advantageMode ?? this.roll.options?.advantageMode;
        if (!mode) return null;
        const type = mode > 0 ? 'ADV' : 'DIS';
        const workflow = this.#workflow();
        const map = workflow?.attackAttribution?.[type] ?? workflow?.saveAttribution?.[this.roll.options?.workflowId]?.[type] ?? {};
        const reasons = Object.values(map);
        return {
            label: _loc(mode > 0 ? 'CAT.Manual.WithAdvantage' : 'CAT.Manual.WithDisadvantage'),
            tooltip: reasons.length ? reasons.join(', ') : null
        };
    }

    #flatModifier(roll = this.roll) {
        return CatRollResolver.#flatTotal(roll.terms);
    }

    static #flatValue(term) {
        if (term.number !== undefined) return term.number;
        return term.isDeterministic ? Number(Roll.safeEval(term.expression)) || 0 : 0;
    }

    static #flatTotal(terms) {
        let total = 0, sign = 1;
        for (const term of terms) {
            if (term.operator) { sign = term.operator === '-' ? -1 : 1; continue; }
            if (term.faces === undefined) total += sign * CatRollResolver.#flatValue(term);
            sign = 1;
        }
        return total;
    }

    #modifierBreakdown(roll = this.roll) {
        return CatRollResolver.#breakdown(this.roll.data, (roll ?? this.roll).terms);
    }

    static #breakdown(data, terms) {
        const candidates = [
            ['mod', 'CAT.Manual.Part.Mod'],
            ['prof', 'CAT.Manual.Part.Prof'],
            ['magicalBonus', 'CAT.Manual.Part.Magic'],
            ['weaponMagic', 'CAT.Manual.Part.Magic'],
            ['ammoMagic', 'CAT.Manual.Part.Magic'],
            ['bonus', 'CAT.Manual.Part.Bonus'],
            ['actorBonus', 'CAT.Manual.Part.Bonus'],
            ['situational', 'CAT.Manual.Part.Situational']
        ].map(([key, locKey]) => ({value: Number((data ?? {})[key]), locKey})).filter(c => c.value);
        const out = [];
        let sign = 1;
        for (const term of terms) {
            if (term.operator) { sign = term.operator === '-' ? -1 : 1; continue; }
            if (term.faces === undefined && term.number !== undefined) {
                const value = sign * term.number;
                const i = candidates.findIndex(c => c.value === value);
                if (i !== -1) out.push(`${value > 0 ? '+' : '−'}${Math.abs(value)} (${_loc(candidates.splice(i, 1)[0].locKey)})`);
            }
            sign = 1;
        }
        return out.length ? out.join(' ') : null;
    }

    _applyOutcome(outcome) {
        if (outcome === 'roll-minimum' || outcome === 'roll-maximum') {
            for (const {term} of this.fulfillable.values()) {
                for (let i = term.results.length; i < (term.number ?? 1); i++) term.results.push({result: outcome === 'roll-maximum' ? term.faces : 1, active: true});
            }
            return true;
        }
        const target = this.roll.options?.target;
        const hasTarget = Number.isNumeric(target);
        const mod = hasTarget ? this.#modifierExcludingD20() : 0;
        const spec = {
            'attack-fumble': [1, 1, 1],
            'attack-critical': [20, 20, 20],
            'attack-hit': [hasTarget ? target - mod : 20, 2, 20],
            'attack-miss': [hasTarget ? target - mod - 1 : 1, 1, 19],
            'save-success': [hasTarget ? target - mod : 20, 1, 20],
            'save-failure': [hasTarget ? target - mod - 1 : 1, 1, 20]
        }[outcome];
        if (!spec) return false;
        const d20Value = Math.clamp(spec[0], spec[1], spec[2]);
        for (const {term} of this.fulfillable.values()) {
            for (let i = term.results.length; i < (term.number ?? 1); i++) {
                term.results.push({result: term.faces === 20 ? d20Value : 1, active: true});
            }
        }
        return true;
    }

    async resolveResult(term, method, options) {
        if (!this.rendered) return term.randomFace();
        if (term.results.filter(result => result.rerolled || result.exploded).length >= 10) {
            if (!term._catDepthCapped) {
                genericUtils.notify('CAT.Manual.RerollDepth', {type: 'error'});
                term._catDepthCapped = true;
            }
            return term.randomFace();
        }
        const promise = super.resolveResult(term, method, options);
        if (method === 'cat') {
            const group = this.element?.querySelector(`fieldset[data-term-id="${term._id}"]`);
            group?.querySelectorAll('label.new-addition input').forEach(input => { input.readOnly = false; });
        }
        return promise;
    }

    async _onSubmitForm(formConfig, event) {
        this._submitted = true;
        this._typedValues = {};
        this._blankResults = {};
        const mode = CatRollResolver.#entryMode();
        for (const input of this.element.querySelectorAll('input')) {
            const blank = input.value.trim() === '';
            if (blank && mode !== 'perDie') {
                const term = this.fulfillable.get(input.name)?.term;
                if (!term) continue;
                this._blankResults[input.name] = Array.from({length: Math.max(term.number ?? 1, 1)}, () => ({result: term.randomFace(), active: true}));
            } else if (!blank && Number.isNaN(input.valueAsNumber)) {
                this._typedValues[input.name] = input.value;
            }
        }
        return super._onSubmitForm(formConfig, event);
    }

    /** @this {CatRollResolver} */
    static async _fulfillRoll(event, form, formData) {
        if (this._pendingOutcome && this._applyOutcome(this._pendingOutcome)) {
            this._pendingOutcome = null;
            return;
        }
        const mode = CatRollResolver.#entryMode();
        for (let [id, value] of Object.entries(formData.object)) {
            const {term} = this.fulfillable.get(id);
            if (term.results.length >= Math.max(term.number ?? 1, 1)) continue;
            const merged = this._mergedTerms?.get(id);
            const blank = this._blankResults?.[id] || value === '' || value === null || value === undefined;
            if (merged && mode !== 'perDie') {
                this.#fulfillMerged(merged, blank ? null : (this._typedValues?.[id] ?? value));
                continue;
            }
            if (this._blankResults?.[id]) {
                for (const result of this._blankResults[id]) term.results.push(result);
                continue;
            }
            if (blank && mode !== 'perDie') {
                for (let i = term.results.length; i < Math.max(term.number ?? 1, 1); i++) term.results.push({result: term.randomFace(), active: true});
                continue;
            }
            value = this._typedValues?.[id] ?? value;
            if (mode === 'perDie') {
                const results = Array.isArray(value) ? value : [value];
                for (const result of results) term.results.push({result: result === null ? term.randomFace() : result, active: true});
                continue;
            }
            for (const result of this._backsolve(term, value, mode)) term.results.push(result);
        }
    }

    _backsolve(term, value, mode) {
        const faces = term.faces;
        const n = Math.max(term.number ?? 1, 1);
        const advMode = term.options?.advantageMode ?? (faces === 20 ? (this.roll.options?.advantageMode ?? 0) : 0);
        const systemDiscards = !!term.options?.pending?.advantage;
        const raw = String(value ?? '');
        if (raw.includes(',')) {
            const parsed = raw.split(/[\s,]+/).filter(part => part !== '').map(Number);
            if (advMode) {
                const mod = (mode === 'rollTotal' && this.#rollContaining(term)) ? this.#groupModifier(term) : 0;
                const values = Array.from({length: n}, (entry, i) => parsed[i] === undefined ? term.randomFace() : Math.clamp(parsed[i] - mod, 1, faces));
                const keep = advMode > 0 ? Math.max(...values) : Math.min(...values);
                let taken = false;
                return values.map(result => {
                    const active = systemDiscards || (!taken && result === keep);
                    if (active) taken = true;
                    return {result, active};
                });
            }
            return Array.from({length: n}, (entry, i) => ({result: Math.clamp(parsed[i] ?? term.randomFace(), 1, faces), active: true}));
        }
        const kept = advMode ? 1 : n;
        const critical = this.roll.options?.criticalSuccess ?? this.roll.options?.critical;
        const max = kept * faces;
        const useRollTotal = mode === 'rollTotal' && !!this.#rollContaining(term);
        let total = (Number(value) || 0) - (useRollTotal ? this.#groupModifier(term) : 0);
        const out = [];
        let left = kept;
        for (let i = 0; i < kept; i++) {
            left -= 1;
            let result;
            if (faces + left <= total) result = (faces === critical && total !== max) ? faces - 1 : faces;
            else if (1 + left >= total) result = 1;
            else result = total - left;
            result = Math.clamp(result, 1, faces);
            total -= result;
            out.push({result, active: true});
        }
        const keptResult = out[0]?.result ?? 1;
        while (out.length < n) {
            const face = term.randomFace();
            out.push({result: advMode > 0 ? Math.min(face, keptResult) : Math.max(face, keptResult), active: systemDiscards});
        }
        return out;
    }

    #groupModifier(term) {
        if (this._termInfo) return this._termInfo.get(term)?.mod ?? 0;
        const roll = this.#rollContaining(term);
        return roll && term === this.#firstDiceTerm(roll) ? this.#flatModifier(roll) : 0;
    }

    static #knownType(value) {
        value = value?.toLowerCase().trim();
        return (value && (CONFIG.DND5E?.damageTypes?.[value] ?? CONFIG.DND5E?.healingTypes?.[value])) ? value : undefined;
    }

    #damage(term) {
        const own = CatRollResolver.#knownType(term?.options?.flavor);
        const type = own ?? CatRollResolver.#knownType(this._termInfo ? this._termInfo.get(term)?.type : this.roll.options?.type);
        if (!type) return undefined;
        return {type, config: CONFIG.DND5E?.damageTypes?.[type] ?? CONFIG.DND5E?.healingTypes?.[type]};
    }

    static #signed(value, spaced = false) {
        const gap = spaced ? ' ' : '';
        return value > 0 ? `${gap}+${gap}${value}` : `${gap}−${gap}${Math.abs(value)}`;
    }

    #firstDiceTerm(roll = this.roll) {
        return roll.terms.find(term => term.faces !== undefined);
    }

    /**
     * The roll whose own terms hold a die: the top-level roll, or one nested in a function, pool or bracket.
     * @param {DiceTerm} term Die to find.
     * @param {Roll} [roll] Roll to search.
     * @returns {Roll|undefined}
     */
    #rollContaining(term, roll = this.roll) {
        if (roll.terms.includes(term)) return roll;
        for (const inner of roll.terms.flatMap(t => t.rolls ?? (t.roll instanceof Roll ? [t.roll] : []))) {
            const found = this.#rollContaining(term, inner);
            if (found) return found;
        }
    }
}
