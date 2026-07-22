import {workflowUtils} from '../utilities/_module.mjs';
class BonusDamage {
    #targets;       // Set      | Target(s) of the bonus damage.
    #roll;          // Roll     | The unevaluated roll.
    #maxTargets;    // Number   | Max targets, if any.
    #document;      // Document | Item, Activity, and possibly the effect providing this bonus damage.
    #validate;      // Function | Callback function that returns true if the bonus damage may apply. 
    #scaling;       // Function | Callback function that gets called when a slider is moved in the UI to update values of the bonus damage, such as the roll, max targets, etc.
    #maxScaling;    // Number   | Max value of the scaling slider.
    #use;           // Function | Callback function that will be called after the selection is confirmed.
    #scalingHint;   // String   | Text for the UI scaling hint.
    #maxTargetsHint;// String   | Text for the UI max targets hint.    
    #validateHint;  // String   | Text for the UI that explains the validity of bonus damage.
    #optional;      // Boolean  | Whether this bonus damage is optional or not. If there are only static bonus damages and no optional ones, the dialog shouldn't be shown.
    #bonusAction;   // Boolean  | Whether this bonus damage takes a bonus action to use. If true only one bonus action bonus damage may be selected. Additionally requires the attack to be on your own turn.
    #active;        // Boolean  | Whether this bonus damage is active or not.
    constructor(document, {maxTargets, validate, scaling, use, scalingHint, maxTargetsHint, validateHint, maxScaling, roll, optional = true, bonusAction} = {}) {
        this.#document = document;
        this.#maxTargets = maxTargets;
        this.#validate = validate ?? BonusDamage.defaultValidate;
        this.#scaling = scaling ?? BonusDamage.defaultScaling;
        this.#use = use ?? BonusDamage.defaultUse;
        this.#targets = new Set();
        this.#scalingHint = scalingHint;
        this.#maxTargetsHint = maxTargetsHint;
        this.#validateHint = validateHint;
        this.maxScaling = maxScaling ?? (this.#document.documentName === 'Item' ? this.#document.system.uses.max : this.#document.uses.max);
        this.#roll = roll ?? new CONFIG.Dice.DamageRoll('1d4', this.#document.getRollData());
        this.#optional = optional;
    }
    get roll() {
        return this.#roll;
    }
    set roll(newRoll) {
        if (!(newRoll instanceof CONFIG.Dice.DamageRoll)) return;
        this.#roll = newRoll;
    }
    get targets() {
        return this.#targets;
    }
    set targets(tokens) {
        this.#targets = new Set(tokens);
        if (this.#maxTargets && this.#targets.size > this.#maxTargets) this.#targets = new Set(Array.from(this.#targets).slice(0, this.#maxTargets));
    }
    get maxTargets() {
        return this.#maxTargets;
    }
    set maxTargets(value) {
        this.#maxTargets = Number(value);
    }
    async validate(workflow, otherBonusDamages) {
        return this.#validate({bonusDamage: this, workflow, otherBonusDamages});
    }
    get document() {
        return this.#document;
    }
    async updateScaling(value, workflow, otherBonusDamages) {
        return await this.#scaling({value, bonusDamage: this, workflow, otherBonusDamages});
    }
    async use(workflow, otherBonusDamages) {
        return await this.#use({workflow, bonusDamage: this, otherBonusDamages});
    }
    get img() {
        return this.#document.img;
    }
    get name() {
        return this.#document.name;
    }
    get description() {
        return this.#document.system.description.value;
    }
    get scalingHint() {
        return this.#scalingHint;
    }
    get maxTargetsHint() {
        return this.#maxTargetsHint;
    }
    get validateHint() {
        return this.#validateHint;
    }
    get maxScaling() {
        return this.#maxScaling;
    }
    set maxScaling(value) {
        this.#maxScaling = Number(value);
    }
    static async defaultScaling({value, bonusDamage, workflow, otherBonusDamages}) {
        const dieTerm = bonusDamage.roll.terms.find(i => i.faces);
        if (dieTerm) dieTerm.number = Math.min(value, bonusDamage.maxScaling);
        bonusDamage.roll.resetFormula();
        return bonusDamage.roll;
    }
    static async defaultValidate({bonusDamage, workflow, otherBonusDamages}) {
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
    get optional() {
        return this.#optional;
    }
    get bonusAction() {
        return this.#bonusAction;
    }
    get active() {
        return this.#active;
    }
    set active(value) {
        this.#active = Boolean(value);
    } 
}