import {activityUtils, dataUtils, effectUtils, genericUtils, workflowUtils} from '../utilities/_module.mjs';
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

export class DamageBonus {
    #targets;       // Set      | Target(s) of the bonus damage.
    #roll;          // Roll     | The unevaluated roll.
    #actor;         // Actor    | The actor who will spend resources for this bonus.
    #baseFormula;   // string   | The original roll formula before scaling.
    #maxTargets;    // Number   | Max targets, if any.
    #baseMaxTargets;// Number   | The original max targets before scaling.
    #document;      // Document | Item, Activity, and possibly the effect providing this bonus damage.
    #activity;      // Activity | Used for default consumption and scaling if a `scaling` callback is not provided.
    #validate;      // Function | Callback for any validation beyond resource consumption. 
    #bonusScaling;  // Function | Callback updates the bonus formula when scaled.
    #costScaling;   // Function | Callback collects the costs required to use this bonus when scaled.
    #targetScaling; // Function | Callback adjusts max targets when the bonus is scaled.
    #getHints;      // Function | Callback creates hints for the UI after all other changes are settled.
    #cost;          // BonusCost| The costs required to use this bonus.
    #maxScaling;    // Number   | Max value of the scaling slider.
    #scalingValue;  // Number   | Current scaling. Base 0.
    #use;           // Function | Async callback runs after the selection is confirmed.
    #scalingHints;//DialogHint[]| Array of {label, icon} for UI scaling hints.
    #maxTargetsHints;// ...     | Array of {label, icon} for UI target hints. 
    #validateHints; // ...      | Array of {label, icon} for explaining the validity of bonus damage.
    #optional;      // Boolean  | Whether this bonus damage is optional or not. If there are only static bonus damages and no optional ones, the dialog shouldn't be shown.
    #action;        // Boolean  | Action economy required to use the bonus. Only reactions can be used outside of your own turn.
    #active;        // Boolean  | Whether this bonus damage is active or not.
    constructor(document, {maxTargets, getHints, getCosts, scaleMaxTargets, validate, scaling, use, scalingHints, maxTargetsHints, validateHints, maxScaling, roll, optional = true, action, actor} = {}) {
        this.#document = document;
        this.#getActivity(document);
        this.#actor = this.#getActor(actor);
        this.#action = this.#getAction(action);
        this.maxScaling = this.#getMaxScaling(maxScaling);
        this.#validate = validate ?? (() => true);
        this.#use = use ?? DamageBonus.defaultUse;
        this.#getHints = getHints ?? DamageBonus.defaultGetHints;
        this.#costScaling = getCosts ?? DamageBonus.defaultCosts;
        this.#bonusScaling = scaling ?? DamageBonus.defaultBonusScaling;
        this.#targetScaling = scaleMaxTargets ?? DamageBonus.defaultTargetScaling;
        this.#baseMaxTargets = maxTargets;
        this.#maxTargets = maxTargets;
        this.#targets = new Set();
        this.#optional = optional;
        this.#scalingValue = 0;
        this.#roll = roll ?? new CONFIG.Dice.DamageRoll('1d4', (this.#activity ?? this.#document).getRollData?.());
        this.#baseFormula = this.#roll.formula;

        this.active = !this.#optional;
        this.scalingHints = scalingHints;
        this.validateHints = validateHints;
        this.maxTargetsHints = maxTargetsHints;

        this.updateScaling(0);
    }

    #makeHints(list) {
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
            const available = DamageBonus.GetResource({consumption: target, actor, scaling: 0}).available;
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

    /** @type {dnd5e.dice.DamageRoll} */
    get roll() {
        return this.#roll;
    }
    set roll(newRoll) {
        if (!(newRoll instanceof CONFIG.Dice.DamageRoll)) return;
        this.#roll = newRoll;
    }
    /** @type {string} Original bonus formula, before scaling. */
    get baseFormula() {
        return this.#baseFormula;
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
    /** @type {dnd5e.dataModels.activity.BaseActivityData|foundry.documents.Item|foundry.documents.ActiveEffect} */
    get document() {
        return this.#document;
    }
    /** @type {string} File path to an icon for the bonus source {@link DamageBonus.document|document}. */
    get img() {
        if (this.#document.documentName === 'Activity' && activityUtils.hasDefaultIcon(this.#document))
            return this.#document.item.img;
        return this.#document.img;
    }
    /** @type {string} Name of the bonus source {@link DamageBonus.document|document}. */
    get name() {
        if (this.#document.documentName === 'Activity' && activityUtils.hasDefaultName(this.#document))
            return this.#document.item.name;
        return this.#document.name;
    }
    /** @type {string} Description of the bonus source {@link DamageBonus.document|document}. */
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
        this.#scalingHints = this.#makeHints(value);
    }
    /** @type {DialogHint[]} */
    get maxTargetsHints() {
        return this.#maxTargetsHints;
    }
    set maxTargetsHints(value) {
        this.#maxTargetsHints = this.#makeHints(value);
    }
    /** @type {DialogHint[]} */
    get validateHints() {
        return this.#validateHints;
    }
    set validateHints(value) {
        this.#validateHints = this.#makeHints(value);
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

    validate(workflow, otherBonusDamages) {
        return this.#validate({bonusDamage: this, workflow, otherBonusDamages});
    }
    updateScaling(value, workflow, otherBonusDamages) {
        this.scalingValue = value;
        const params = {bonusDamage: this, workflow, otherBonusDamages};
        const updates = {
            cost: this.#costScaling(params),
            roll: this.#bonusScaling(params),
            maxTargets: this.#targetScaling(params)
        };
        if (updates.cost) this.#cost = updates.cost;
        if (updates.roll) this.roll = updates.roll;
        if (Number.isNumeric(updates.maxTargets)) this.maxTargets = updates.maxTargets;
        this.#getHints(params);
    }
    async use(workflow, otherBonusDamages) {
        return await this.#use({workflow, bonusDamage: this, otherBonusDamages});
    }

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
        return {label, tooltip, icon: warn ? DamageBonus.#warningIcon : '', id: target};
    }

    static defaultGetHints({bonusDamage, workflow, otherBonusDamages}) {
        const hints = [];
        for (const type of DamageBonus.#resourceTypes) {
            for (const [key, data] of Object.entries(bonusDamage.cost[type] ?? {})) {
                const target = type === 'actions' ? key : type;
                hints.push(DamageBonus.#getHint({target, data, key, bonus: bonusDamage}));
            }
        }
        bonusDamage.scalingHints = hints;
    }
    static defaultBonusScaling({bonusDamage, workflow, otherBonusDamages}) {
        const scaling = bonusDamage.scalingValue;
        if (bonusDamage.activity?.damage?.parts.length) {
            if (!bonusDamage.activity.canScaleDamage) return bonusDamage.roll;
            // incompatible with multiple damage types - requires a restructure for allowing several rolls per bonus
            const rolls = activityUtils.getDefaultDamageRolls(bonusDamage.activity, {scaling});
            return rolls[0];
        }
        const roll = new CONFIG.Dice.DamageRoll(bonusDamage.baseFormula, bonusDamage.roll.data);
        const dieTerm = roll.terms.find(i => i.faces);
        if (dieTerm) dieTerm.number += scaling;
        roll.resetFormula();
        return roll;
    }
    /** 
     * @param {DamageBonus} bonusDamage
     * @returns {BonusCost} 
     * */
    static defaultCosts({bonusDamage, workflow, otherBonusDamages}) {
        const costs = {};
        if (bonusDamage.actionRequired) {
            const action = DamageBonus.GetAction({action: bonusDamage.actionRequired, actor: bonusDamage.actor});
            costs.actions ??= {};
            DamageBonus.#lazySetCost(costs.actions, action.key, 1, action.available);
        }
        if (!bonusDamage.activity) return costs;
        const actor = bonusDamage.actor;
        const scaling = bonusDamage.scalingValue;
        const consumption = bonusDamage.activity.consumption;
        if (consumption.spellSlot && bonusDamage.activity.requiresSpellSlot) {
            const base = bonusDamage.activity.item.system.level;
            const key = `spell${Math.clamp(base + scaling, 1, DamageBonus.#maxSpell)}`;
            const available = actor.system.spells?.[key]?.value ?? 0;
            costs.spellSlots ??= {};
            DamageBonus.#lazySetCost(costs.spellSlots, key, 1, available);
        }
        for (const target of consumption.targets) {
            const {simplifiedCost} = target._resolveHintCost({scaling});
            if (simplifiedCost <= 0) continue;
            const resources = DamageBonus.GetResource({consumption: target, actor, scaling});
            costs[target.type] ??= {};
            DamageBonus.#lazySetCost(costs[target.type], resources.key, simplifiedCost, resources.available);
        }
        return costs;
    }
    static defaultTargetScaling({bonusDamage, workflow, otherBonusDamages}) { 
        return;
    }
    static async defaultUse({workflow, bonusDamage, otherBonusDamages}) {
        if (bonusDamage.document.documentName === 'Item') {
            await workflowUtils.completeItemUse(bonusDamage.document, Array.from(bonusDamage.targets));
        } else {
            await workflowUtils.completeActivityUse(bonusDamage.document, Array.from(bonusDamage.targets));
        }
    }
    /**
     * Filter valid and applicable {@link bonuses}.
     * @param {DamageBonus[]|Set<DamageBonus>} bonuses
     * @param {object} [options]
     * @param {MidiQOL.Workflow} [options.workflow]
     * @returns {DamageBonus[]}
     */
    static ValidateAll(bonuses, {workflow} = {}) {
        const cumulativeCosts = {};
        return bonuses.filter(b => {
            b.validateHints = [];
            if (!b.active) return false;
            if (!b.validate(workflow, bonuses)) {
                b.active = false;
                return false;
            }
            let hasEnough = true;
            for (const type of DamageBonus.#resourceTypes) {
                for (const [key, data] of Object.entries(b.cost[type] ?? {})) {
                    const currentCost = cumulativeCosts[type]?.[key]?.cost ?? 0;
                    if (data.cost + currentCost > data.available) {
                        hasEnough = false;
                        break; 
                    }
                }
                if (!hasEnough) break;
            }
            if (hasEnough) {
                for (const type of DamageBonus.#resourceTypes) {
                    cumulativeCosts[type] ??= {};
                    for (const [key, data] of Object.entries(b.cost[type] ?? {}))
                        DamageBonus.#lazySetCost(cumulativeCosts[type], key, data.cost, data.available);
                }
                return true;
            } 
            b.active = false;
            b.validateHints = {label: _loc('CAT.OptionalBonus.Invalid', {reason: _loc('CAT.OptionalBonus.InvalidResources')})};
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
