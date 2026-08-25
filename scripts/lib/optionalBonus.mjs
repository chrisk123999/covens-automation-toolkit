import {activityUtils, dataUtils, dialogUtils, documentUtils, effectUtils, genericUtils, queryUtils, rollUtils, workflowUtils} from '../utilities/_module.mjs';
import {Logging} from './_module.mjs';
const {formatNumber, getHumanReadableAttributeLabel} = dnd5e.utils;

/** @import {DialogHint} from '../applications/dialog.mjs' */

/** 
 * @typedef BonusCostEntry
 * @property {number} cost
 * @property {number} available
 */

/** 
 * @typedef BonusCost 
 * @property {object} [actions]
 * @property {BonusCostEntry} [actions.action]
 * @property {BonusCostEntry} [actions.bonus]
 * @property {BonusCostEntry} [actions.reaction]
 * @property {Record<string, BonusCostEntry>} [itemUses]
 * @property {Record<string, BonusCostEntry>} [activityUses]
 * @property {Record<string, BonusCostEntry>} [spellSlots]
 * @property {Record<string, BonusCostEntry>} [attribute]
 * @property {Record<string, BonusCostEntry>} [material]
 * @property {Record<string, BonusCostEntry>} [hitDice]
 */

/**
 * @typedef {object} RollBonusHandlerOptions
 * @property {RollBonus} bonus The current bonus.
 * @property {number} rollTotal The current total of the target roll(s) before adding bonuses, if available.
 * @property {RollBonus[]} otherBonuses Other candidate bonuses for the same target roll.
 * @property {MidiQOL.Worklow} [workflow] The workflow the target roll is part of.
 */
/**
 * @callback CostScalingHandler
 * @param {RollBonusHandlerOptions} params
 * @returns {BonusCost}
 */

/**
 * @callback HintGenerator
 * @param {RollBonusHandlerOptions} params
 */

/**
 * @callback RequestHandler
 * @param {RollBonusHandlerOptions} params
 * @returns {Promise<boolean|{result: boolean, reason: string}>} True/false represent approve/decline respectively.
 */

/**
 * @callback BonusScalingHandler
 * @param {RollBonusHandlerOptions} params
 * @returns {foundry.dice.Roll} A roll containing the scaled formula.
 */

/**
 * @callback OnUse
 * @param {RollBonusHandlerOptions} params
 * @returns {Promise}
 */

/**
 * @callback ValidationHandler
 * @param {RollBonusHandlerOptions} params
 * @returns {boolean}
 */

class RollBonus {
    #roll;          // Roll     | The unevaluated roll.
    #rollClass;     // Roll     | The type of the roll.
    #actor;         // Actor    | The actor who will spend resources for this bonus.
    #targetActor;   // Actor    | The actor who will benefit from this bonus.
    #thirdPartyRequest; //Fn    | Async callback builds a request dialog, returning true or false for accept or decline.
    #autoApprove;   // Boolean  | Automatically approve third party requests.
    #baseFormula;   // string   | The original roll formula before scaling.
    #document;      // Document | Item, Activity, and possibly the effect providing this bonus.
    #activity;      // Activity | Used for default consumption and scaling if a `scaling` callback is not provided.
    #validate;      // Function | Callback for any validation beyond resource consumption. 
    #bonusScaling;  // Function | Callback updates the bonus formula when scaled.
    #costScaling;   // Function | Callback collects the costs required to use this bonus when scaled.
    #getScalingHints;//Function | Callback creates scaling hints for the UI after all other changes are settled.
    #cost;          // BonusCost| The costs required to use this bonus.
    #maxScaling;    // Number   | Max value of the scaling slider.
    #scalingValue;  // Number   | Current scaling. Base 0.
    #use;           // Function | Async callback runs after the selection is confirmed.
    #scalingHints;//DialogHint[]| Array of {label, icon} for UI scaling hints.
    #validateHints; // ...      | Array of {label, icon} for explaining the validity of bonus.
    #optional;      // Boolean  | Whether this bonus is optional or not. If there are only static bonuses and no optional ones, the dialog shouldn't be shown.
    #action;        // Boolean  | Action economy required to use the bonus. Only reactions can be used outside of your own turn.
    #active;        // Boolean  | Whether this bonus is active or not.
    #initialized;   // Boolean  | Whether handlers have been called to initialize costs, hints, and scaling.
    constructor(document, {roll, formula, maxScaling, optional = true, action, actor, targetActor, autoApproveRequests = false} = {}) {
        this.#document = document;
        this.#getActivity(document);
        this.#actor = this.#getActor(actor);
        this.#targetActor = targetActor ?? this.#actor;
        this.#autoApprove = autoApproveRequests;
        this.#action = this.#getAction(action);
        this.maxScaling = this.#getMaxScaling(maxScaling);
        this.#getScalingHints = this.constructor.defaultScalingHints;
        this.#optional = optional;
        this.#scalingValue = 0;
        this.#cost = {};
        this.#roll = roll ?? new this.constructor.rollClass(formula || '0', (this.#activity ?? this.#document).getRollData?.());
        this.#rollClass = this.constructor.rollClass;
        this.#baseFormula = this.#roll.formula;
        this.active = !this.#optional;
    }

    _makeHints(list) {
        list = dataUtils.toArray(list);
        const hints = [];
        for (const hint of list) {
            if (typeof hint === 'string')
                hints.push({label: hint});
            if (typeof hint.label === 'string')
                hints.push(hint);
        }
        return hints;
    }
    #getActivity(document) {
        switch (document.documentName) {
            case 'Activity':
                this.#activity = document;
                return;
            case 'Item': {
                const activities = document.system.activities?.filter(a =>
                    a.canUse !== false &&
                    !document.flags.dnd5e?.riders?.activity?.includes(a.id) &&
                    !a.midiProperties?.automationOnly &&
                    !a.flags.cat?.hidden
                );
                if (activities.length === 1) this.#activity = activities[0];
                return;
            }
            case 'ActiveEffect':
                this.#activity = effectUtils.getOriginActivitySync(document);
                return;
        }
    }
    #getMaxScaling(override) {
        if (typeof override === 'number') return override;
        if (!this.activity) return 0;
        let value = Infinity;
        const actor = this.actor;
        const slot = () => Math.min(value, Math.max(Object.values(actor.system.spells)
            .reduce((max, spell) => spell.value ? Math.max(spell.level, max) : max, -1) - this.activity.item.system.level, 0));
        if (this.activity.isSpell) value = slot();
        for (const target of this.activity.consumption.targets) {
            const baseCost = target._resolveHintCost({scaling: 0}).simplifiedCost;
            const scaledCost = target._resolveHintCost({scaling: 1}).simplifiedCost;
            const stepCost = scaledCost - baseCost;
            if (stepCost <= 0) continue;
            const available = RollBonus.GetResource({consumption: target, actor, scaling: 0}).available;
            const limit = Math.max(0, Math.floor((available - baseCost) / stepCost));
            if (limit === 0) return 0;
            if (limit < value) value = limit;
        }
        return value === Infinity ? 0 : value;
    }
    #getAction(override) {
        if (override) return override;
        return this.activity?.activation.type;
    }
    #getActor(override) {
        if (override) return override;
        return this.activity?.actor ?? this.document.actor;
    }
    get rollClass() { 
        return this.#rollClass;
    }
    get roll() {
        return this.#roll;
    }
    set roll(newRoll) {
        if (!(newRoll instanceof this.constructor.rollClass)) return;
        this.#roll = newRoll;
    }
    /** @type {string} Original bonus formula, before scaling. */
    get baseFormula() {
        return this.#baseFormula;
    }
    /** @type {dnd5e.dataModels.activity.BaseActivityData|foundry.documents.Item|foundry.documents.ActiveEffect} */
    get document() {
        return this.#document;
    }
    /** @type {string} File path to an icon for the bonus source {@link RollBonus.document|document}. */
    get img() {
        if (this.#document.documentName === 'Activity' && activityUtils.hasDefaultIcon(this.#document))
            return this.#document.item.img;
        return this.#document.img;
    }
    /** @type {string} Name of the bonus source {@link RollBonus.document|document}. */
    get name() {
        if (this.#document.documentName === 'Activity' && activityUtils.hasDefaultName(this.#document))
            return this.#document.item.name;
        return this.#document.name;
    }
    /** @type {string} Description of the bonus source {@link RollBonus.document|document}. */
    get description() {
        let desc;
        switch (this.#document.documentName) {
            case 'Activity':
                desc = this.#document.description.chatFlavor || this.#document.item.system.description.value;
                break;
            case 'Item':
                desc = this.#document.system?.description.value;
                break;
            case 'ActiveEffect':
                desc = this.#document.description || this.#activity?.description.chatFlavor || this.#activity?.item.system.description.value;
                break;
        }
        return desc ?? '';
    }
    /** @type {DialogHint[]} */
    get scalingHints() {
        return this.#scalingHints;
    }
    set scalingHints(value) {
        this.#scalingHints = this._makeHints(value);
    }
    /** @type {DialogHint[]} */
    get validateHints() {
        return this.#validateHints;
    }
    set validateHints(value) {
        this.#validateHints = this._makeHints(value);
    }
    /** @type {number} */
    get maxScaling() {
        return this.#maxScaling;
    }
    set maxScaling(value) {
        this.#maxScaling = Number(value);
    }
    /** @type {number} Current scaling. Base 0. */
    get scalingValue() {
        return this.#scalingValue;
    }
    set scalingValue(value) {
        value = Number(value);
        this.#scalingValue = this.#maxScaling ? Math.min(value, this.#maxScaling) : value;
    }
    /** @type {boolean} True if this bonus requires user input. */
    get optional() {
        return this.#optional;
    }
    /** @type {BonusCost} The costs required to use this bonus. */
    get cost() {
        return this.#cost;
    }
    /** @type {'action'|'bonus'|'reaction'|undefined} Action economy required. See `CONFIG.DND5E.activityActivationTypes`. */
    get actionRequired() {
        return this.#action;
    }
    /** @type {foundry.documents.Actor} The actor who will spend resources for this bonus. */
    get actor() {
        return this.#actor;
    }
    /** @type {foundry.documents.Actor} The actor who will benefit from this bonus. */
    get targetActor() {
        return this.#targetActor;
    }
    set targetActor(value) {
        if (!(value instanceof CONFIG.Actor.documentClass)) return;
        this.#targetActor = value;
    }
    /** @type {boolean} */
    get isThirdParty() { 
        return this.actor.id !== this.targetActor.id;
    }
    /** @type {boolean} */
    get autoApproveRequests() {
        return this.#autoApprove || Object.keys(this.cost).length === 0;
    }
    /** @type {dnd5e.dataModels.activity.BaseActivityData} */
    get activity() {
        return this.#activity;
    }
    /** @type {boolean} True if this bonus will be applied. */
    get active() {
        return this.#active;
    }
    set active(value) {
        this.#active = Boolean(value);
    }
    /** @type {boolean} True if {@link initialize} has been called. */
    get initialized() {
        return this.#initialized;
    }

    /** @param {CostScalingHandler} cost @returns {this} */
    withCostHandler(cost) {
        if (typeof cost !== 'function') return this;
        this.#costScaling = cost;
        return this;
    }
    /** Collects action economy and consumption targets from {@link RollBonus.activity|this.activity}.
     * @param {dnd5e.dataModels.activity.BaseActivityData} [activity] Optionally change the activity for this bonus.
     * @param {foundry.documents.Actor} [actor] Optionally change the actor who provides resources for this bonus.
     * @returns {this} */
    withDefaultCosts({activity, actor} = {}) {
        if (activity) this.#activity = activity;
        if (actor) this.#actor = actor;
        this.#costScaling = this.constructor.defaultCosts;
        return this;
    }
    /** @param {HintGenerator} hints @returns {this} */
    withScalingHints(hints) {
        if (typeof hints !== 'function') return this;
        this.#getScalingHints = hints;
        return this;
    }
    /** @param {RequestHandler} request @returns {this} */
    withRequestHandler(request) {
        if (typeof request !== 'function') return this;
        this.#thirdPartyRequest = request;
        return this;
    }
    /** Sends a basic confirmation prompt to the source of the bonus that displays the current roll total.
     * @param {foundry.documents.Actor} [actor] Optionally change the actor who provides resources for this bonus.
     * @param {foundry.documents.Actor} [targetActor] Optionally change the actor who benefits from this bonus.
     * @returns {this} */
    withDefaultRequest({actor, targetActor} = {}) {
        if (actor) this.#actor = actor;
        if (targetActor) this.#targetActor = targetActor;
        this.#thirdPartyRequest = this.constructor.defaultRequest;
        return this;
    }
    /** @param {BonusScalingHandler} scaling @returns {this} */
    withScalingHandler(scaling) {
        if (typeof scaling !== 'function') return this;
        this.#bonusScaling = scaling;
        return this;
    }
    /** Uses the configured damage scaling from {@link activity|this.activity}. Otherwise adds one additional die per level.
     * @returns {this} */
    withDefaultScaling() {
        this.#bonusScaling = this.constructor.defaultBonusScaling;
        return this;
    }
    /** @param {OnUse} use @returns {this} */
    withOnUse(use) {
        if (typeof use !== 'function') return this;
        this.#use = use;
        return this;
    }
    /** Rolls {@link RollBonus.document|this.document} if it is an Item or Activity.
     * @returns {this} */
    withDefaultOnUse() {
        this.#use = this.constructor.defaultUse;
        return this;
    }
    /** @param {ValidationHandler} validate @returns {this} */
    withValidation(validate) {
        if (typeof validate !== 'function') return this;
        this.#validate = validate;
        return this;
    }

    _otherScaling({rollTotal, bonus, workflow, otherBonuses}) {}
    validate(workflow, otherBonuses, rollTotal) {
        if (!this.#validate) return true;
        return this.#validate({rollTotal, bonus: this, workflow, otherBonuses});
    }
    updateScaling(value, workflow, otherBonuses, rollTotal) {
        this.#initialized = true;
        this.scalingValue = value;
        const params = {bonus: this, workflow, otherBonuses, rollTotal};
        const cost = this.#costScaling?.(params);
        const roll = this.#bonusScaling?.(params);
        if (cost) this.#cost = cost;
        if (roll) this.roll = roll;
        this._otherScaling(params);
        this.#getScalingHints(params);
    }
    /** 
     * Runs all handlers to initialize costs, hints, and scaling. 
     * @param {MidiQOL.Worklow} [workflow]
     * */
    initialize(workflow) {
        this.updateScaling(0, workflow);
        return this;
    }
    async use(workflow, otherBonuses) {
        if (!this.#use) return;
        return await this.#use({workflow, bonus: this, otherBonuses});
    }
    async request(workflow, otherBonuses, rollTotal) {
        if (!this.#thirdPartyRequest) {
            const reason = _loc('CAT.OptionalBonus.NoRequest');
            Logging.addMacroWarning('cat', documentUtils.getIdentifier(this.document), _loc('CAT.OptionalBonus.Invalid', {reason}));
            return {result: false, reason};
        }
        return await this.#thirdPartyRequest({rollTotal, bonus: this, workflow, otherBonuses});
    }

    static _combineRolls(rolls) { throw new Error('A subclass of RollBonus must implement handling for a specific roll type!');}
    static get rollClass() { throw new Error('A subclass of RollBonus must implement handling for a specific roll type!'); }
    static get #warningIcon() { return 'fa-solid fa-triangle-exclamation cat-warning-icon'; }
    static get #maxSpell() { return Object.keys(CONFIG.DND5E.spellLevels).length - 1; }
    static get #resourceTypes() { return ['actions', ...Object.keys(CONFIG.DND5E.activityConsumptionTypes)]; }
    static #lazySetCost(obj, key, cost, available) {
        if (!key) return;
        obj[key] ??= {cost: 0, available};
        obj[key].cost += cost;
    }
    /** @returns {DialogHint} */
    static #getHint({target, data, key, bonus}) {
        let label, tooltip, type;
        const warn = data.cost > data.available;
        const plural = new Intl.PluralRules(game.i18n.lang);
        const availablePlural = plural.select(data.available);
        const available = formatNumber(data.available);
        const costPlural = plural.select(data.cost);
        const cost = formatNumber(data.cost);
        switch(target) {
            case 'action':
            case 'bonus':
            case 'reaction':
                label = type = CONFIG.DND5E.activityActivationTypes[target]?.label;
                break;
            case 'activityUses': {
                const activity = fromUuidSync(key) ?? bonus.activity;
                type = _loc('DND5E.CONSUMPTION.Type.ActivityUses.Warning', {
                    activity: activity?.name ?? bonus.name,
                    item: activity?.item.name ?? bonus.name
                });
                label = _loc('DND5E.CONSUMPTION.Type.ActivityUses.PromptHintDecrease', {
                    availableUse: _loc(`DND5E.CONSUMPTION.Type.Use.${availablePlural}`),
                    use: _loc(`DND5E.CONSUMPTION.Type.Use.${costPlural}`),
                    available,
                    cost
                });
                break;
            }
            case 'itemUses': {
                const item = fromUuidSync(key);
                if (!item) break;
                type = _loc('DND5E.CONSUMPTION.Type.ItemUses.Warning',  {name: item.name});
                label = _loc('DND5E.CONSUMPTION.Type.ItemUses.PromptHintDecrease', {
                    availableUse: _loc(`DND5E.CONSUMPTION.Type.Use.${availablePlural}`),
                    use: _loc(`DND5E.CONSUMPTION.Type.Use.${costPlural}`),
                    item: `<em>${item.name}</em>`,
                    available,
                    cost
                });
            }
                break;
            case 'material': {
                const mat = fromUuidSync(key);
                if (!mat) break;
                type = _loc('DND5E.CONSUMPTION.Type.Material.Warning', {name: mat.name});
                label = _loc('DND5E.CONSUMPTION.Type.Material.PromptHintDecrease', {
                    item: `<em>${mat.name}</em>`,
                    quantity: available,
                    cost
                });
            }
                break;
            case 'hitDice': {    
                let denomination;
                if ( key === 'smallest' ) denomination = _loc('DND5E.ConsumeHitDiceSmallest');
                else if ( key === 'largest' ) denomination = _loc('DND5E.ConsumeHitDiceLargest');
                else denomination = key;
                type = _loc('DND5E.CONSUMPTION.Type.HitDice.Warning', {denomination});
                label = _loc('DND5E.CONSUMPTION.Type.HitDice.PromptHintDecrease', {
                    die: _loc(`DND5E.CONSUMPTION.Type.HitDie.${costPlural}`),
                    denomination: denomination.toLowerCase(),
                    available,
                    cost
                });
                break;
            }
            case 'spellSlots':{
                const level = Number(key.replace(/^spell/, '')) || 1;
                const levelLabel = CONFIG.DND5E.spellLevels[level]?.toLowerCase();
                type = _loc('DND5E.CONSUMPTION.Type.SpellSlots.Warning', {level: levelLabel});
                label = _loc('DND5E.CONSUMPTION.Type.SpellSlots.PromptHintDecrease', {
                    slot: _loc(`DND5E.CONSUMPTION.Type.SpellSlot.${costPlural}`, {level: levelLabel}),
                    available,
                    cost
                });
                break;
            }
            case 'attribute': {
                const attribute = getHumanReadableAttributeLabel(key, {actor: bonus.actor});
                type = _loc('DND5E.CONSUMPTION.Type.Attribute.Warning', {attribute});
                label = _loc('DND5E.CONSUMPTION.Type.Attribute.PromptHintDecrease', {attribute, cost, current: available});
                break;
            }
        }
        if (warn) {
            const warning = data.available <= 0 ? 'DND5E.CONSUMPTION.Warning.None' : 'DND5E.CONSUMPTION.Warning.NotEnough';
            tooltip = _loc(warning, {type, cost: formatNumber(data.cost), available: formatNumber(Math.max(0, data.available ?? 0))});
        }
        return {label, tooltip, icon: warn ? RollBonus.#warningIcon : '', id: target};
    }

    /** @type {HintGenerator} */
    static defaultScalingHints({rollTotal, bonus, workflow, otherBonuses}) {
        const hints = [];
        for (const type of RollBonus.#resourceTypes) {
            for (const [key, data] of Object.entries(bonus.cost[type] ?? {})) {
                const target = type === 'actions' ? key : type;
                hints.push(RollBonus.#getHint({target, data, key, bonus: bonus}));
            }
        }
        bonus.scalingHints = hints;
    }
    /** @type {BonusScalingHandler} */
    static defaultBonusScaling({rollTotal, bonus, workflow, otherBonuses}) {
        const scaling = bonus.scalingValue;
        const roll = new bonus.rollClass(bonus.baseFormula, bonus.roll.data, bonus.roll.options);
        const dieTerm = roll.terms.find(i => i.faces);
        if (dieTerm) dieTerm.number += scaling;
        roll.resetFormula();
        return roll;
    }
    /** @type {CostScalingHandler} */
    static defaultCosts({rollTotal, bonus, workflow, otherBonuses}) {
        const costs = {};
        if (bonus.actionRequired) {
            const action = RollBonus.GetAction({action: bonus.actionRequired, actor: bonus.actor});
            costs.actions ??= {};
            RollBonus.#lazySetCost(costs.actions, action.key, 1, action.available);
        }
        if (!bonus.activity) return costs;
        const actor = bonus.actor;
        const scaling = bonus.scalingValue;
        const consumption = bonus.activity.consumption;
        if (consumption.spellSlot && bonus.activity.requiresSpellSlot) {
            const base = bonus.activity.item.system.level;
            const key = `spell${Math.clamp(base + scaling, 1, RollBonus.#maxSpell)}`;
            const available = actor.system.spells?.[key]?.value ?? 0;
            costs.spellSlots ??= {};
            RollBonus.#lazySetCost(costs.spellSlots, key, 1, available);
        }
        for (const target of consumption.targets) {
            const {simplifiedCost} = target._resolveHintCost({scaling});
            if (simplifiedCost <= 0) continue;
            const resources = RollBonus.GetResource({consumption: target, actor, scaling});
            costs[target.type] ??= {};
            RollBonus.#lazySetCost(costs[target.type], resources.key, simplifiedCost, resources.available);
        }
        return costs;
    }
    /** @type {OnUse} */
    static async defaultUse({bonus, workflow, otherBonuses}) {
        if (bonus.document.documentName === 'Item') {
            await workflowUtils.completeItemUse(bonus.document, Array.from(bonus.targets ?? []));
        } else {
            await workflowUtils.completeActivityUse(bonus.document, Array.from(bonus.targets ?? []));
        }
    }
    /** @type {RequestHandler} */
    static async defaultRequest({rollTotal, bonus, workflow, otherBonuses}) {
        if (!RollBonus.CheckCost(bonus)) return {result: false, reason: _loc('CAT.OptionalBonus.InvalidResources')};
        if (bonus.autoApproveRequests) return {result: true, reason: _loc('CAT.Dialog.Request.Automatic')};
        const name = bonus.targetActor?.name ?? _loc('CAT.MEDKIT.EmbeddedMacros.Disposition.Ally');
        const document = {name: `${bonus.name} (+${bonus.roll.formula})`};
        if (Number.isNumeric(rollTotal)) {
            let diceTerms = [];
            otherBonuses.forEach(b => {
                if (!b.active) return;
                if (b.roll.isDeterministic) rollTotal += b.roll.clone().evaluateSync().total;
                else diceTerms.push(b.roll.formula);
            });
            if (diceTerms.length) rollTotal = `${rollTotal} + ${diceTerms.join(' + ')}`;
        }
        const user = queryUtils.firstOwner(bonus.actor);
        const result = await dialogUtils.confirmUseForRollTotal(document, name, rollTotal, {userId: user.id});
        return result ? result : {result, reason: `${user.name} ${_loc('CAT.Dialog.Request.Declined')}`};
    }
    /**
     * Check resource requirements for a bonus.
     * @param {RollBonus} bonus 
     * @param {BonusCost} [costs] Optionally provide other calculated costs, usually cumulative.
     * @returns {boolean}
     */
    static CheckCost(bonus, costs) {
        for (const type of RollBonus.#resourceTypes) {
            for (const [key, data] of Object.entries(bonus.cost[type] ?? {})) {
                const currentCost = costs?.[type]?.[key]?.cost ?? 0;
                if (data.cost + currentCost > data.available)
                    return false;
            }
        }
        return true;
    }
    static CombineRolls(rolls, bonuses, {workflow}) {
        const defaultType = workflow?.damageRolls[0]?.options.type ?? workflow?.defaultDamageType;
        const active = [...rolls, ...bonuses.filter(b => b.active).map(b => {
            const r = b.roll.clone();
            r.options.type ||= rolls[0]?.options?.type ?? defaultType;
            r.terms.forEach(t => t.options.source = b.name);
            return r;
        })];
        const groupedRolls = this._combineRolls(active);
        groupedRolls.forEach(r => r._formula = dnd5e.dice.simplifyRollFormula(r.formula));
        return groupedRolls;
    }

    /**
     * Filter valid and applicable {@link bonuses}.
     * @param {RollBonus[]|Set<RollBonus>} bonuses
     * @param {object} [options]
     * @param {number} [options.rollTotal] The current total of the target roll(s) before adding bonuses, if available.
     * @param {MidiQOL.Workflow} [options.workflow]
     * @returns {RollBonus[]}
     */
    static ValidateAll(bonuses, {rollTotal, workflow} = {}) {
        const cumulativeCosts = {};
        return bonuses.filter(b => {
            b.validateHints = [];
            if (!b.active) return false;
            if (!b.validate(workflow, bonuses, rollTotal)) {
                b.active = false;
                return false;
            }
            const hasEnough = RollBonus.CheckCost(b, cumulativeCosts);
            if (hasEnough) {
                for (const type of RollBonus.#resourceTypes) {
                    cumulativeCosts[type] ??= {};
                    for (const [key, data] of Object.entries(b.cost[type] ?? {}))
                        RollBonus.#lazySetCost(cumulativeCosts[type], key, data.cost, data.available);
                }
                return true;
            } 
            b.active = false;
            b.validateHints.push({label: _loc('CAT.OptionalBonus.Invalid', {reason: _loc('CAT.OptionalBonus.InvalidResources')})});
            return hasEnough;
        });
    }
    /**
     * Fetch the available resources for a given consumption target.
     * @param {object} options 
     * @param {dnd5e.dataModels.activity.ConsumptionTargetData} options.consumption
     * @param {foundry.documents.Actor} options.actor
     * @param {number} options.scaling
     * @returns {{key: string, available: number}}
     */
    static GetResource({consumption, actor, scaling}) {
        let key, available = 0;
        switch (consumption.type) {
            case 'activityUses':
                key = consumption.activity?.uuid;
                available = consumption.activity?.uses.value ?? 0;
                break;
            case 'attribute':
                key = consumption.target;
                available = genericUtils.getProperty(actor.system, consumption.target) ?? 0;
                break;
            case 'hitDice':
                if (['smallest', 'largest'].includes(consumption.target)) {
                    key = actor.system.attributes?.hd?.[consumption.target + 'Available'];
                    available = actor.system.attributes?.hd?.value ?? 0;
                } else {
                    key = consumption.target;
                    available = actor.system.attributes?.hd?.bySize?.[key] ?? 0;
                }
                break;
            case 'itemUses': {
                const item = actor.items.get(consumption.target) ?? consumption.item;
                available = item?.system.uses?.value ?? 0;
                if (item) key = item.uuid;
                break;
            }
            case 'material': {
                const item = actor.items.get(consumption.target);
                available = item?.system.quantity ?? 0;
                if (item) key = item.uuid;
                break;
            }
            case 'spellSlots': {
                const level = Math.clamp(consumption.resolveLevel({config: {scaling}}), 1, this.#maxSpell);
                key = `spell${level}`;
                available = actor.system.spells?.[key]?.value ?? 0;
                break;
            }
        }
        return {key, available};
    }
    /**
     * Fetch the available actions for a given actor.
     * @param {object} options 
     * @param {'action'|'bonus'|'reaction'|undefined} options.action
     * @param {foundry.documents.Actor} options.actor
     * @returns {{key: string, available: number}}
     */
    static GetAction({action, actor}) {
        const data = {key: action, available: 1};
        const actions = actor?.flags['midi-qol']?.actions;
        switch (action) {
            case 'bonus':
                data.available = Math.max(0, (actions?.bonusActionsMax ?? 1) - (actions?.bonusActionsUsed ?? 0));
                break;
            case 'reaction':
                data.available = Math.max(0, (actions?.reactionsMax ?? 1) - (actions?.reactionsUsed ?? 0));
                break;
            default: 
                data.available = 999;
                break;
        }
        return data;
    }
}

/**
 * @extends RollBonus
 * @property {dnd5e.dice.BasicRoll} roll 
 */
export class D20Bonus extends RollBonus {
    static get rollClass() { return CONFIG.Dice.BasicRoll; }
    constructor(document, options) {
        super(document, options);
    }
    static _combineRolls(rolls) {
        const terms = [];
        for (const r of rolls) {
            if (terms.length) terms.push(new foundry.dice.terms.OperatorTerm({operator: '+'}));
            terms.push(...r.terms);
        }
        return [this.rollClass.fromTerms(terms)];
    }
}

/**
 * @callback TargetScalingHandler
 * @param {RollBonusHandlerOptions} params
 * @returns {number}
 */

/**
 * @extends RollBonus
 * @property {dnd5e.dice.DamageRoll} roll 
 */
export class DamageBonus extends RollBonus {
    #targets;         // Set           | Target(s) of the bonus.   
    #maxTargets;      // Number        | Max targets, if any.
    #baseMaxTargets;  // Number        | The original max targets before scaling.
    #targetScaling;   // Function      | Callback adjusts max targets when the bonus is scaled.
    #maxTargetsHints; // DialogHints[] | Array of {label, icon} for UI target hints. 
    #damageTypes;     // Set           | Damage type options. A subinput combobox is shown if there is more than one type.
    #canCrit;         // Boolean       | False for static bonuses, true for double dice on critical hits.
    constructor(document, {type, maxTargets, allowCritical = true, ...baseOptions} = {}) {
        super(document, baseOptions);
        
        this.#baseMaxTargets = maxTargets;
        this.#maxTargets = maxTargets;
        this.#canCrit = allowCritical;
        this.#targets = new Set();
        if (type) {
            this.#damageTypes = new Set(dataUtils.toArray(type));
            this.damageType = this.#damageTypes.first();
        }
    }

    /** @type {Set<foundry.documents.TokenDocument>} Targets of the damage. Size truncated to {@link maxTargets}, if present. */
    get targets() {
        return this.#targets;
    }
    set targets(tokens) {
        this.#targets = new Set(tokens);
        if (this.#maxTargets && this.#targets.size > this.#maxTargets) this.#targets = new Set(Array.from(this.#targets).slice(0, this.#maxTargets));
    }
    /** @type {number} */
    get maxTargets() {
        return this.#maxTargets;
    }
    set maxTargets(value) {
        this.#maxTargets = Number(value);
    }
    /** @type {number} Original max targets, before scaling. */
    get baseMaxTargets() {
        return this.#baseMaxTargets;
    }
    /** @type {DialogHint[]} */
    get maxTargetsHints() {
        return this.#maxTargetsHints;
    }
    set maxTargetsHints(value) {
        this.#maxTargetsHints = this._makeHints(value);
    }
    /** @type {string} */
    get damageType() {
        return this.roll.options.type;
    }
    set damageType(value) {
        if (!CONFIG.DND5E.damageTypes[value] && !CONFIG.DND5E.healingTypes[value]) return;
        this.roll.options.type = value;
    }
    /** @type {Set<string>} */
    get damageTypes() {
        return this.#damageTypes;
    }
    /** @type {Boolean} */
    get canCrit() {
        return this.#canCrit;
    }

    /** @param {TargetScalingHandler} targetScaling @returns {this} */
    withTargetScaling(targetScaling) {
        if (typeof targetScaling !== 'function') return this;
        this.#targetScaling = targetScaling;
        return this;
    }
    _otherScaling({rollTotal, bonus, workflow, otherBonuses}) {
        const maxTargets = this.#targetScaling?.({rollTotal, bonus, workflow, otherBonuses});
        if (Number.isNumeric(maxTargets)) this.maxTargets = maxTargets;
        if (workflow?.isCritical) DamageBonus.MakeCritical(bonus);
    }
    
    static get rollClass() { return CONFIG.Dice.DamageRoll; }
    static defaultBonusScaling({rollTotal, bonus, workflow, otherBonuses}) {
        if (!bonus.activity.canScaleDamage) return bonus.roll;
        if (!bonus.activity?.damage?.parts.length) return RollBonus.defaultBonusScaling({rollTotal, bonus, workflow, otherBonuses});
        // incompatible with multiple damage types - requires a restructure for allowing several rolls per bonus
        const scaled = activityUtils.getDefaultDamageRolls(bonus.activity, {scaling: bonus.scalingValue});
        return scaled[0];
    }
    static _combineRolls(rolls) {
        return dnd5e.dice.aggregateDamageRolls(rolls).map(r => {
            if (r.terms[0].operator !== '+') return r;
            r.terms.shift();
            r.resetFormula();
            return r;
        });
    }
    /**
     * Applies a critical dice formula to the bonus, if allowed.
     * @param {DamageBonus} bonus
     */
    static MakeCritical(bonus) {
        if (!bonus.canCrit || bonus.roll.options.isCritical) return;
        const formula = rollUtils.getCriticalFormula(bonus.roll.formula, bonus.document, bonus.roll.options.critical);
        bonus.roll = new bonus.rollClass(formula, bonus.roll.data, {...bonus.roll.options, isCritical: true});
    }
    /**
     * Filter valid and applicable {@link bonuses}.
     * @param {DamageBonus[]|Set<DamageBonus>} bonuses
     * @param {object} [options]
     * @param {number} [options.rollTotal] The current total of the target roll(s) before adding bonuses, if available.
     * @param {MidiQOL.Workflow} [options.workflow]
     * @returns {DamageBonus[]}
     */
    static ValidateAll(bonuses, {rollTotal, workflow} = {}) { return RollBonus.ValidateAll(bonuses, {rollTotal, workflow}); }
}
