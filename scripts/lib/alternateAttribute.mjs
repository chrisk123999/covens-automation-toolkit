import {Logging} from './_module.mjs';
import {AttributeRestrictions as Restrictions} from './_module.mjs';

const fields = foundry.data.fields;
const dndFields = dnd5e.dataModels.fields;
const TYPES = [];

class AlternateAttribute {

    #type;
    #schema;
    #getFlagHolders;

    constructor({type, valueSchema, restrictionSchema, getFlagHolders}) {
        this.#type = type;
        this.#getFlagHolders = getFlagHolders;
        this.#schema = new fields.SchemaField({
            value: valueSchema,
            restrictions: new fields.SchemaField(restrictionSchema, {required: false})
        });
    }

    get type() {
        return this.#type;
    }

    get schema() {
        return this.#schema;
    }

    #validate(item, data) {
        const cleaned = this.#schema.clean(data, {partial: true});
        const validationError = this.#schema.validate(cleaned);
        if (validationError) {
            Logging.addAttributeError(item, cleaned, validationError.asError());
            return false;
        }
        return cleaned;
    }

    #validAttributeSource(sourceItem) {
        if (!sourceItem) return false;
        if (sourceItem.type !== 'equipment') return true;
        if (!sourceItem.system.equipped) return false;
        if (sourceItem.system.attunement === 'required' && !sourceItem.system.attuned) return false;
        return true;
    }

    getFlagHolders(actor) {
        return this.#getFlagHolders?.(actor) ?? actor.items;
    }

    create(item, value, restrictions) {
        return this.#validate(item, {type: this.#type, value, restrictions});
    }

    evaluate({sourceItem, ...context}) {
        const attributes = sourceItem?.flags.cat?.alternateAttributes?.[this.#type];
        if (!attributes) return;
        if (!this.#validAttributeSource(sourceItem)) return;
        const options = new Set();
        for (const a of attributes) {
            const cleaned = this.#validate(sourceItem, a);
            if (!cleaned) continue;
            let succeeds = true;
            for (const [type, r] of Object.entries(cleaned.restrictions)) {
                if (!r) continue;
                const evaluate = Restrictions[type]?.evaluate?.bind(Restrictions[type]);
                if (!evaluate) {
                    Logging.addAttributeError(sourceItem, r, new Error(`Restriction of type ${type} is missing an evaluator!`));
                    continue;
                }
                if (!evaluate(r, context)) {
                    succeeds = false;
                    break;
                }
            }
            if (!succeeds) continue; 
            if (Array.isArray(cleaned.value)) cleaned.value.forEach(v => options.add(v));
            else options.add(cleaned.value);
        }
        return options;
    }
}

function registerAttribute({type, valueSchema, getRestrictionSchema, getFlagHolders}) {
    TYPES.push({type, valueSchema, getRestrictionSchema, getFlagHolders});
}

function buildAttributes() {
    return TYPES.reduce((list, attribute) => (list[attribute.type] = new AlternateAttribute({
        type: attribute.type,
        valueSchema: attribute.valueSchema,
        getFlagHolders: attribute.getFlagHolders,
        restrictionSchema: attribute.getRestrictionSchema().reduce((list, r) => (list[r.type] = r.schema, list), {})
    }), list), {});
}

function getFormulaRestrictions() {
    return [
        Restrictions.DamageType,
        Restrictions.Identifier,
        Restrictions.Property,
        Restrictions.Ability,
        Restrictions.School,
        Restrictions.Method,
        Restrictions.Level,
        Restrictions.Type
    ];
}

function getFormulaFlagHolders(actor) {
    return [
        ...actor.itemTypes.feat,
        ...actor.itemTypes.equipment
    ];
}

registerAttribute({
    type: 'DamageFormula',
    valueSchema: new dndFields.FormulaField({
        placeholder: '1d4 + @mod',
        required: true
    }),
    getFlagHolders: getFormulaFlagHolders,
    getRestrictionSchema: getFormulaRestrictions
});

registerAttribute({
    type: 'RollModifier',
    valueSchema: new fields.ArrayField(new fields.StringField({
        placeholder: 'x, min2, r',
        required: true
    })),
    getFlagHolders: getFormulaFlagHolders,
    getRestrictionSchema: getFormulaRestrictions
});

registerAttribute({
    type: 'Ability',
    valueSchema: new fields.ArrayField(new fields.StringField({
        choices: () => Restrictions.mapKeyLabel(CONFIG.DND5E.abilities),
        placeholder: 'dex, con',
        required: true
    })),
    getRestrictionSchema: () => [
        Restrictions.DamageType,
        Restrictions.Identifier,
        Restrictions.Property,
        Restrictions.Type
    ],
    getFlagHolders: (actor) => actor.itemTypes.feat
});

export default {
    buildAttributes
};
