import {activityUtils, dataUtils, effectUtils, genericUtils, workflowUtils} from '../utilities/_module.mjs';

/** @import {DialogHint} from '../applications/dialog.mjs' */

export default class BonusDamage {
    #targets;       // Set      | Target(s) of the bonus damage.
    #roll;          // Roll     | The unevaluated roll.
    #baseFormula    // string   | The original roll formula before scaling.
    #maxTargets;    // Number   | Max targets, if any.
    #baseMaxTargets;// Number   | The original max targets before scaling.
    #document;      // Document | Item, Activity, and possibly the effect providing this bonus damage.
    #activity;      // Activity | Used for default consumption and scaling if a `scaling` callback is not provided.
    #validate;      // Function | Callback function that returns true if the bonus damage may apply. 
    #scaling;       // Function | Callback function that gets called when a slider is moved in the UI to update values of the bonus damage, such as the roll, max targets, etc.
    #maxScaling;    // Number   | Max value of the scaling slider.
    #use;           // Function | Asynchronoud callback function that will be called after the selection is confirmed.
    #consumeLabels; // String   | An array of labels for the UI that lists consumption targets.
    #scalingHints;  // String   | Array of {label, icon} for UI scaling hints.
    #maxTargetsHints;// String  | Array of {label, icon} for UI target hints.    
    #validateHints; // String   | Array of {label, icon} for explaining the validity of bonus damage.
    #optional;      // Boolean  | Whether this bonus damage is optional or not. If there are only static bonus damages and no optional ones, the dialog shouldn't be shown.
    #action;        // Boolean  | Action economy required to use the bonus. Only reactions can be used outside of your own turn.
    #active;        // Boolean  | Whether this bonus damage is active or not.
    constructor(document, {maxTargets, validate, scaling, use, consumeLabels, scalingHints, maxTargetsHints, validateHints, maxScaling, roll, optional = true, action} = {}) {
        this.#document = document;
        if (!scaling) this.#getActivity(document);
        this.#consumeLabels = this.#getConsumption(consumeLabels);
        this.maxScaling = this.#getMaxScaling(maxScaling);
        this.#validate = validate ?? BonusDamage.defaultValidate;
        this.#scaling = scaling ?? BonusDamage.defaultScaling;
        this.#use = use ?? BonusDamage.defaultUse;
        this.#scalingHints = this.#makeHints(scalingHints);
        this.#validateHints = this.#makeHints(validateHints);
        this.#maxTargetsHints = this.#makeHints(maxTargetsHints);
        this.#baseMaxTargets = maxTargets;
        this.#maxTargets = maxTargets;
        this.#targets = new Set();
        this.#optional = optional;
        this.#action = action;
        this.#roll = roll ?? new CONFIG.Dice.DamageRoll('1d4', (this.#activity ?? this.#document).getRollData?.());
        this.#baseFormula = this.#roll.formula;
    }
    // TODO if no initial hints are provided and scaling is available, a scaling hint needs to be created
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
    #getConsumption(override) {
        if (override) return dataUtils.toArray(override);
        const consume = this.#activity?.consumption;
        if (!consume) return [];
        const targets = new Set();
        const types = CONFIG.DND5E.activityConsumptionTypes;
        if (consume.spellSlot && this.#activity.requiresSpellSlot) 
            targets.add(types.spellSlots.label);
        consume.targets.forEach(t => targets.add(types[t.type].label));
        if (!targets.size) return [];
        return Array.from(targets);
    }
    #getMaxScaling(override) {
        if (typeof override === 'number') return override;
        if (!this.#activity) return 0;
        let value = Infinity;
        const {system, items} = this.#activity.actor;
        const slot = () => Math.min(value, Math.max(Object.values(system.spells)
            .reduce((max, spell) => spell.value ? Math.max(spell.level, max) : max, -1) - this.#activity.item.system.level, 0));
        if (this.#activity.isSpell) value = slot();
        for (const target of this.#activity.consumption.targets) {
            const roll = target.resolveCost({evaluate: false});
            if (!roll.isDeterministic) continue;
            const min = new Roll(roll.formula, roll.data).evaluateSync({minimize: true}).total;
            const max = new Roll(roll.formula, roll.data).evaluateSync({maximize: true}).total;
            if (max <= 0 || min <= 0) continue;
            let available = 0;
            switch (target.type) {
                case 'activityUses':
                    available = this.#activity.uses.value;
                    break;
                case 'attribute':
                    available = genericUtils.getProperty(system, target.target);
                    break;
                case 'hitDice':
                    available = system.attributes.hd.value;
                    break;
                case 'itemUses': {
                    const item = items.get(target.target) ?? target.item;
                    available = item.system.uses.value;
                    break;
                }
                case 'material':
                    available = items.get(target.target)?.system.quantity ?? 0;
                    break;
                case 'spellSlots':
                    available = slot();
                    if (min > available + this.#activity.item.system.level) return 0;
                    value = available;
                    break;
            }
            const limit = Math.floor(available / min);
            if (limit < value) value = limit;
        }
        return value === Infinity ? 0 : value;
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
    validate(workflow, otherBonusDamages) {
        return this.#validate({bonusDamage: this, workflow, otherBonusDamages});
    }
    /** @type {dnd5e.dataModels.activity.BaseActivityData|foundry.documents.Item|foundry.documents.ActiveEffect} */
    get document() {
        return this.#document;
    }
    updateScaling(value, workflow, otherBonusDamages) {
        const updates = this.#scaling({value, bonusDamage: this, workflow, otherBonusDamages}) ?? {};
        if (updates.roll) this.roll = updates.roll;
        if (updates.scalingHints) this.#scalingHints = updates.scalingHints;
        if (updates.maxTargetsHints) this.#maxTargetsHints = updates.maxTargetsHints;
        if (Number.isNumeric(updates.maxTargets)) this.maxTargets = updates.maxTargets;
    }
    async use(workflow, otherBonusDamages) {
        return await this.#use({workflow, bonusDamage: this, otherBonusDamages});
    }
    /** @type {string} File path to an icon for the bonus source {@link BonusDamage.document|document}. */
    get img() {
        if (this.#document.documentName === 'Activity' && activityUtils.hasDefaultIcon(this.#document))
            return this.#document.item.img;
        return this.#document.img;
    }
    /** @type {string} Name of the bonus source {@link BonusDamage.document|document}. */
    get name() {
        return this.#document.name;
    }
    /** @type {string} Description of the bonus source {@link BonusDamage.document|document}. */
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
    /** @type {string[]} */
    get consumeLabels() {
        return this.#consumeLabels;
    }
    /** @type {DialogHint[]} */
    get scalingHints() {
        return this.#scalingHints;
    }
    /** @type {DialogHint[]} */
    get maxTargetsHints() {
        return this.#maxTargetsHints;
    }
    /** @type {DialogHint[]} */
    get validateHints() {
        return this.#validateHints;
    }
    /** @type {number} */
    get maxScaling() {
        return this.#maxScaling;
    }
    set maxScaling(value) {
        this.#maxScaling = Number(value);
    }
    static defaultScaling({value, bonusDamage, workflow, otherBonusDamages}) {
        const consumption = BonusDamage.defaultConsumeScaling({value, bonusDamage}) ?? {};
        return {
            maxTargets: consumption.maxTargets,
            scalingHints: consumption.scalingHints,
            maxTargetsHints: consumption.maxTargetsHints,
            roll: BonusDamage.defaultDamageScaling({value, bonusDamage})
        };
    }
    // TODO `getConsumptionLabels` provides warn: true if resources are insufficient
    //       pass this along to validation?
    static defaultConsumeScaling({value, bonusDamage}) {
        if (!bonusDamage.#activity?.canScale) return;
        const consumption = bonusDamage.#activity.consumption;
        const config = {scaling: value};
        let hints = [];
        const warning = 'fa-solid fa-triangle-exclamation cat-warning-icon';
        for (const target of consumption.targets) {
            const labels = target.getConsumptionLabels(config, {consumed: true});
            hints.push({
                label: labels.hint,
                icon: labels.warn ? warning : ''
            });
        }
        // TODO add default scaling for other consumption targets - item uses, hit dice etc
        if (consumption.spellSlot && bonusDamage.#activity.requiresSpellSlot) {
            const base = bonusDamage.#activity.item.system.level;
            const levelNumber = Math.clamp(base + value, 1, Object.keys(CONFIG.DND5E.spellLevels).length - 1);
            const hasSlot = Object.values(bonusDamage.#activity.actor.system.spells).some(s => s.level === levelNumber && s.value > 0);
            const level = CONFIG.DND5E.spellLevels[levelNumber].toLowerCase();
            hints.push({
                label: _loc('DND5E.CONSUMPTION.Type.SpellSlot.one', {level}),
                tooltip: !hasSlot ? _loc('DND5E.CONSUMPTION.Warning.MissingSpellSlot', {level}) : '',
                icon: !hasSlot ? warning : ''
            });
        }
        return {scalingHints: hints};
    }
    static defaultDamageScaling({value, bonusDamage}) {
        value = Math.min(value, bonusDamage.maxScaling);
        if (bonusDamage.#activity?.damage?.parts.length) {
            if (!bonusDamage.#activity.canScaleDamage) return;
            const formula = bonusDamage.#activity.damage.parts.map(part => part.scaledFormula(value)).join(' + ');
            return new CONFIG.Dice.DamageRoll(formula, bonusDamage.roll.data);
        }
        const roll = new CONFIG.Dice.DamageRoll(bonusDamage.baseFormula, bonusDamage.roll.data);
        const dieTerm = roll.terms.find(i => i.faces);
        if (dieTerm) dieTerm.number += value;
        roll.resetFormula();
        return roll;
    }
    static defaultValidate({bonusDamage, workflow, otherBonusDamages}) {
        return true;
    }
    static async defaultUse({workflow, bonusDamage, otherBonusDamages}) {
        await workflowUtils.bonusDamage(workflow, bonusDamage.roll.formula, {damageType: workflow.defaultDamageType});
        if (bonusDamage.document.documentName === 'Item') {
            await workflowUtils.completeItemUse(bonusDamage.document, Array.from(bonusDamage.targets));
        } else {
            await workflowUtils.completeActivityUse(bonusDamage.document, Array.from(bonusDamage.targets));
        }
    }
    /** @type {boolean} True if this bonus requires user input. */
    get optional() {
        return this.#optional;
    }
    /** @type {'action'|'bonus'|'reaction'|undefined} Action economy required. See `CONFIG.DND5E.activityActivationTypes`. */
    get actionRequired() {
        return this.#action;
    }
    /** @type {boolean} True if this bonus will be applied. */
    get active() {
        return this.#active;
    }
    set active(value) {
        this.#active = Boolean(value);
    } 
}