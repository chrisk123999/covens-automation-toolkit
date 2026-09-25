import {constants} from '../../lib/_module.mjs';
import {genericUtils, queryUtils} from '../../utilities/_module.mjs';
import uiUtils from '../../utilities/uiUtils.mjs';
import CatApp from '../cat-app.mjs';
const {RollResolver} = foundry.applications.dice;

export default class CatRollResolver extends RollResolver {
    static DEFAULT_OPTIONS = {
        classes: ['cat', 'cat-dialog', 'cat-roll-resolver'],
        window: {frame: false, positioned: true, contentClasses: ['standard-form']},
        position: {width: 'auto', height: 'auto'},
        actions: {toggleDetach: uiUtils.onToggleDetach, applyOutcome: CatRollResolver.#onApplyOutcome},
        form: {handler: this._fulfillRoll}
    };

    get detachable() {
        return true;
    }

    get closeAction() {
        return 'close';
    }

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
        const [prefix, names] = type.includes('attack') ? ['attack', ['fumble', 'miss', 'hit', 'critical']]
            : type.includes('sav') ? ['save', ['failure', 'success']] : ['', []];
        return names.map(name => ({value: `${prefix}-${name}`, label: 'CAT.Manual.Outcome.' + name.capitalize()}));
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
            let mod = 0, sign = 1;
            for (const term of roll.terms) {
                if (term.operator) { sign = term.operator === '-' ? -1 : 1; continue; }
                if (term.faces === undefined && term.number !== undefined) mod += sign * term.number;
                sign = 1;
            }
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
        const key = this.roll.options?.workflowId;
        const Workflow = globalThis.MidiQOL?.Workflow;
        if (!key || !Workflow) return null;
        const direct = Workflow.getWorkflow(key);
        if (direct) return this.#cachedWorkflow = direct;
        const workflows = [...Workflow.workflows.values()].map(w => w instanceof WeakRef ? w.deref() : w).filter(Boolean);
        return this.#cachedWorkflow = workflows
            .filter(w => w.activity?.uuid === key || [...(w.targets ?? [])].some(t => t.actor?.uuid === key))
            .sort((a, b) => (b.workflowStartTime ?? 0) - (a.workflowStartTime ?? 0))[0] ?? null;
    }

    #rollContext() {
        const options = this.roll.options ?? {};
        const workflow = this.#workflow();
        const activity = workflow?.activity;
        let rollType = options.rollType;
        if (!rollType && activity?.type) rollType = activity.type === 'attack' ? 'attack' : (activity.save || activity.type === 'save') ? 'save' : activity.type;
        return {
            name: workflow?.item?.name ?? this.roll.data?.name,
            flavor: options.flavor ?? this.roll.d20?.options?.flavor ?? activity?.name,
            rollType
        };
    }

    async awaitFulfillment() {
        if (!this._forcePrompt) {
            if (this.#isDamage()) return this.#digitalRoll();
            if (!this.#checkPreferences()) return this.#digitalRoll();
        }
        const gm = queryUtils.gmUser();
        if (game.settings.get('cat', 'manualRollsGMFulfill') && gm && !queryUtils.isTheGM()) {
            const fulfillable = Roll.defaultImplementation.identifyFulfillableTerms(this.roll.terms);
            if (!fulfillable.length) return;
            const results = await queryUtils.query('manualRoll', gm, {roll: this.roll.toJSON()}, 300000);
            fulfillable.forEach((term, i) => {
                term._id ??= foundry.utils.randomID();
                for (const result of results?.[i] ?? []) term.results.push({result, active: true});
            });
            return;
        }
        return super.awaitFulfillment();
    }

    #checkPreferences() {
        if (!game.settings.get('cat', 'manualRollsUsers')?.includes(game.user.id)) return false;
        const inclusion = game.settings.get('cat', 'manualRollsInclusion');
        if (!inclusion) return false;
        const hasContext = this.#workflow() || this.#isDamage() || (CONFIG.Dice?.D20Roll && this.roll instanceof CONFIG.Dice.D20Roll);
        if (!hasContext && !game.settings.get('cat', 'manualRollsPromptNoData')) return false;
        const actor = this.#actor();
        if (inclusion === 1) return true;
        if (inclusion === 2) return actor?.type === 'character';
        if ((this.roll.options?.flavor ?? '').toLowerCase().includes('initiative') && actor && (actor.flags.cat?.summon || (actor.type === 'npc' && actor.hasPlayerOwner))) return false;
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
        const uuid = this.roll.data?.actorUuid;
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
                if (!groupMod) damageGroups.push({id, group, term, damage: damageLabel, key: `${damage.type}|${term.faces}|${info?.properties ?? ''}`});
                group.icon = `<img class="dmg" src="${constants.damageIcons[damage.type] ?? damage.config.icon}">`;
                if (groupMod) {
                    group.modifier = CatRollResolver.#signed(groupMod);
                    group.modifierTooltip = info?.tip ?? this.#modifierBreakdown();
                }
                group.tooltip = this.#groupTooltip(info?.source, group.label, groupMod, damageLabel);
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
                const useRollTotal = rollTotal && this.roll.terms.includes(term);
                const mod = useRollTotal ? groupMod : 0;
                group.results = [{...group.results[0], value: '', readonly: false, disabled: false, text: n > 1, minValue: n + mod, maxValue: n * term.faces + mod, denomination: _loc(useRollTotal ? 'CAT.Manual.RollTotal' : 'CAT.Manual.DiceTotal')}];
            } else {
                for (const result of group.results) result.readonly = false;
            }
        }
        if (total) this.#mergeDamageGroups(context, damageGroups);
        const label = this.#contextLabel();
        context.formula = label.label;
        context.formulaIcon = label.icon;
        context.formulaSub = label.sub ?? null;
        context.title = 'CAT.Manual.Title';
        context.detachable = this.detachable;
        context.closeAction = this.closeAction;
        Object.assign(context, uiUtils.detachContext(this, options));
        context.buttons = [{label: 'CAT.Manual.Submit', icon: 'fa-solid fa-dice-d20'}];
        context.outcomes = this.outcomes;
        return context;
    }

    #mergeDamageGroups(context, damageGroups) {
        this._mergedTerms = new Map();
        for (const bucket of Object.values(Object.groupBy(damageGroups, entry => entry.key))) {
            if (bucket.length < 2) continue;
            const [primary, ...rest] = bucket;
            const faces = primary.term.faces;
            const dice = CatRollResolver.#diceTotal(bucket.map(entry => entry.term));
            const sources = [...new Set(bucket.map(entry => this._termInfo?.get(entry.term)?.source).filter(Boolean))];
            primary.group.label = `${dice}d${faces}`;
            primary.group.tooltip = this.#groupTooltip(sources.join(', '), primary.group.label, 0, primary.damage);
            Object.assign(primary.group.results[0], {label: primary.group.label, text: true, minValue: dice, maxValue: dice * faces});
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

    #groupTooltip(source, formula, mod, damage) {
        return `${source ? source + ': ' : ''}${formula}${mod ? CatRollResolver.#signed(mod, true) : ''} ${damage}`;
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
        if (game.settings.get('cat', 'manualRollsRichContext')) {
            const save = this.#saveContext();
            if (save) return save;
            const action = this.#actionContext();
            if (action) return action;
        }
        if (this._batchLabel) return {label: this._batchLabel, icon: null};
        const {name, flavor} = this.#rollContext();
        if (!name && !flavor) return {label: this.#prettyFormula(), icon: '<i class="fa-solid fa-comments"></i>'};
        if (name && flavor) return {label: `${name} — ${flavor}`, icon: null};
        return {label: name ?? flavor, icon: null};
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
        const dnd = card?.flags?.dnd5e ?? {};
        const itemType = workflow?.item?.type ?? dnd.item?.type;
        if (!itemType) return null;
        const token = workflow?.token ?? (card?.speaker?.token ? canvas.tokens?.get(card.speaker.token) : null);
        const visible = game.user.isGM || token?.visible;
        const source = visible
            ? (token?.name ?? workflow?.actor?.name ?? card?.speaker?.alias ?? _loc('CAT.Manual.UnknownSource'))
            : _loc('CAT.Manual.UnknownSource');
        const typeKey = `CAT.Manual.ItemType.${itemType}`;
        const type = game.i18n.has(typeKey) ? _loc(typeKey) : itemType;
        const activity = workflow?.activity ?? (dnd.activity?.uuid ? fromUuidSync(dnd.activity.uuid) : null);
        const caster = workflow?.actor ?? (card?.flags?.['midi-qol']?.sourceActorUuid ? fromUuidSync(card.flags['midi-qol'].sourceActorUuid) : null);
        return {label: _loc('CAT.Manual.SaveContext', {source, type}), icon: null, sub: this.#saveLine(activity, caster)};
    }

    #saveLine(activity, caster) {
        const ability = [...(activity?.save?.ability ?? [])].map(a => _loc(CONFIG.DND5E?.abilities?.[a]?.label ?? a)).join('/');
        if (!ability) return null;
        const dc = this.roll.options?.target;
        const showDC = Number.isNumeric(dc) && this.#dcVisible(caster);
        return showDC ? _loc('CAT.Manual.SaveLine', {dc, ability}) : _loc('CAT.Manual.SaveLineNoDC', {ability});
    }

    #dcVisible(caster) {
        return game.user.isGM || (globalThis.MidiQOL?.shouldDisplaySaveDC?.(caster) ?? false);
    }

    #actionContext() {
        const workflow = this.#workflow();
        const data = this.roll.data ?? {};
        const {rollType} = this.#rollContext();
        const itemType = workflow?.item?.type ?? data.item?.itemType;
        const source = workflow?.token?.name ?? workflow?.actor?.name ?? data.name;
        const item = workflow?.item?.name ?? data.item?.name;
        if (!rollType || !itemType || !source || !item) return null;
        const targets = this.#targetNames();
        const key = `CAT.Manual.Context.${itemType}.${rollType}${targets ? '' : 'NoTarget'}`;
        if (!game.i18n.has(key)) return null;
        return {label: _loc(key, {source, item, target: targets ?? ''}), icon: null};
    }

    #targetNames() {
        const workflow = this.#workflow();
        const targets = workflow?.targets ? [...workflow.targets] : (game.user?.targets ? [...game.user.targets] : []);
        if (!targets.length) return null;
        return targets.map(t => (t.visible || game.user.isGM) ? t.name : _loc('CAT.Manual.Unknown')).join(', ');
    }

    #prettyFormula() {
        const parts = [];
        for (const term of this.roll.terms) {
            if (term.operator) { parts.push(term.operator); continue; }
            if (term.faces !== undefined) {
                const type = term.options?.type ?? term.options?.flavor;
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
        options.animate = false;
        await uiUtils.fadeOut(this.element);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        uiUtils.enableWindowDrag(this);
        if (options.isFirstRender) {
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
            else if (term.number !== undefined) value = term.number;
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

    #flatModifier() {
        let total = 0, sign = 1;
        for (const term of this.roll.terms) {
            if (term.operator) { sign = term.operator === '-' ? -1 : 1; continue; }
            if (term.faces === undefined && term.number !== undefined) total += sign * term.number;
            sign = 1;
        }
        return total;
    }

    #modifierBreakdown() {
        return CatRollResolver.#breakdown(this.roll.data, this.roll.terms);
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
            const merged = this._mergedTerms?.get(id);
            if (merged && mode !== 'perDie') {
                this.#fulfillMerged(merged, this._blankResults?.[id] ? null : (this._typedValues?.[id] ?? value));
                continue;
            }
            if (this._blankResults?.[id]) {
                for (const result of this._blankResults[id]) term.results.push(result);
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
        const raw = String(value ?? '');
        if (raw.includes(',')) {
            const parsed = raw.split(/[\s,]+/).filter(part => part !== '').map(Number);
            if (advMode) {
                const mod = (mode === 'rollTotal' && this.roll.terms.includes(term)) ? this.#groupModifier(term) : 0;
                const values = Array.from({length: n}, (entry, i) => parsed[i] === undefined ? term.randomFace() : Math.clamp(parsed[i] - mod, 1, faces));
                const keep = advMode > 0 ? Math.max(...values) : Math.min(...values);
                let taken = false;
                return values.map(result => {
                    const active = !taken && result === keep;
                    if (active) taken = true;
                    return {result, active};
                });
            }
            return Array.from({length: n}, (entry, i) => ({result: Math.clamp(parsed[i] ?? term.randomFace(), 1, faces), active: true}));
        }
        const kept = advMode ? 1 : n;
        const critical = this.roll.options?.criticalSuccess ?? this.roll.options?.critical;
        const max = kept * faces;
        const useRollTotal = mode === 'rollTotal' && this.roll.terms.includes(term);
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
            out.push({result: advMode > 0 ? Math.min(face, keptResult) : Math.max(face, keptResult), active: false});
        }
        return out;
    }

    #groupModifier(term) {
        if (this._termInfo) return this._termInfo.get(term)?.mod ?? 0;
        return term === this.#firstDiceTerm() ? this.#flatModifier() : 0;
    }

    static #knownType(value) {
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

    #firstDiceTerm() {
        return this.roll.terms.find(term => term.faces !== undefined);
    }
}
