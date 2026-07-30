import {activityUtils, effectUtils, workflowUtils} from '../utilities/_module.mjs';
export default class BonusDamage {
    #targets;       // Set      | Target(s) of the bonus damage.
    #roll;          // Roll     | The unevaluated roll.
    #maxTargets;    // Number   | Max targets, if any.
    #document;      // Document | Item, Activity, and possibly the effect providing this bonus damage.
    #activity;      // Activity | Used for default consumption and scaling if a `scaling` callback is not provided.
    #validate;      // Function | Callback function that returns true if the bonus damage may apply. 
    #scaling;       // Function | Callback function that gets called when a slider is moved in the UI to update values of the bonus damage, such as the roll, max targets, etc.
    #maxScaling;    // Number   | Max value of the scaling slider.
    #use;           // Function | Asynchronoud callback function that will be called after the selection is confirmed.
    #consumeLabels; // String   | An array of labels for the UI that lists consumption targets.
    #scalingHint;   // String   | Text for the UI scaling hint.
    #maxTargetsHint;// String   | Text for the UI max targets hint.    
    #validateHint;  // String   | Text for the UI that explains the validity of bonus damage.
    #optional;      // Boolean  | Whether this bonus damage is optional or not. If there are only static bonus damages and no optional ones, the dialog shouldn't be shown.
    #action;        // Boolean  | Action economy required to use the bonus. Only reactions can be used outside of your own turn.
    #active;        // Boolean  | Whether this bonus damage is active or not.
    constructor(document, {maxTargets, validate, scaling, use, consumeLabels, scalingHint, maxTargetsHint, validateHint, maxScaling, roll, optional = true, action} = {}) {
        this.#document = document;
        if (!scaling) this.#getActivity(document);
        this.#maxTargets = maxTargets;
        this.#validate = validate ?? BonusDamage.defaultValidate;
        this.#scaling = scaling ?? BonusDamage.defaultScaling;
        this.#use = use ?? BonusDamage.defaultUse;
        this.#targets = new Set();
        this.#consumeLabels = consumeLabels ?? this.#getConsumption();
        this.#scalingHint = scalingHint;
        this.#maxTargetsHint = maxTargetsHint;
        this.#validateHint = validateHint;
        this.maxScaling = maxScaling ?? (this.#document.documentName === 'Item' ? this.#document.system.uses.max : this.#document.uses.max);
        this.#roll = roll ?? new CONFIG.Dice.DamageRoll('1d4', (this.#activity ?? this.#document).getRollData?.());
        this.#optional = optional;
        this.#action = action;
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
    #getConsumption() {
        const consume = this.#activity?.consumption;
        if (!consume) return '';
        const targets = new Set();
        const types = CONFIG.DND5E.activityConsumptionTypes;
        if (consume.spellSlot && this.#activity.requiresSpellSlot) 
            targets.add(types.spellSlots.label);
        consume.targets.forEach(t => targets.add(types[t.type].label));
        if (!targets.size) return '';
        return Array.from(targets);
    }
    /** @type {dnd5e.dice.DamageRoll} */
    get roll() {
        return this.#roll;
    }
    set roll(newRoll) {
        if (!(newRoll instanceof CONFIG.Dice.DamageRoll)) return;
        this.#roll = newRoll;
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
    validate(workflow, otherBonusDamages) {
        return this.#validate({bonusDamage: this, workflow, otherBonusDamages});
    }
    /** @type {dnd5e.dataModels.activity.BaseActivityData|foundry.documents.Item|foundry.documents.ActiveEffect} */
    get document() {
        return this.#document;
    }
    updateScaling(value, workflow, otherBonusDamages) {
        return this.#scaling({value, bonusDamage: this, workflow, otherBonusDamages});
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
    /** @type {string} */
    get scalingHint() {
        return this.#scalingHint;
    }
    /** @type {string} */
    get maxTargetsHint() {
        return this.#maxTargetsHint;
    }
    /** @type {string} */
    get validateHint() {
        return this.#validateHint;
    }
    /** @type {number} */
    get maxScaling() {
        return this.#maxScaling;
    }
    set maxScaling(value) {
        this.#maxScaling = Number(value);
    }
    static defaultScaling({value, bonusDamage, workflow, otherBonusDamages}) {
        if (bonusDamage.#activity?.damage?.parts.length) {
            if (!bonusDamage.#activity.canScaleDamage) return bonusDamage.roll;
            const formula = bonusDamage.#activity.damage.parts.map(part => part.scaledFormula(value)).join(' + ');
            return new CONFIG.Dice.DamageRoll(formula, bonusDamage.roll.data);
        }
        const dieTerm = bonusDamage.roll.terms.find(i => i.faces);
        if (dieTerm) dieTerm.number = Math.min(value, bonusDamage.maxScaling);
        bonusDamage.roll.resetFormula();
        return bonusDamage.roll;
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