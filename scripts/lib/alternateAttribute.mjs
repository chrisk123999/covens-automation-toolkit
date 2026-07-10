import {Logging} from './_module.mjs';
import {itemUtils} from '../utilities/_module.mjs';
import {AttributeRestrictions as Restrictions} from './_module.mjs';

const fields = foundry.data.fields;
const dndFields = dnd5e.dataModels.fields;

class AlternateAttribute {

    #type;
    #schema;
    #getValueSummary;
    #allowedFlagHolders;

    constructor({type, valueSchema, restrictionSchema, allowedFlagHolders, getValueSummary}) {
        this.#type = type;
        this.#getValueSummary = getValueSummary;
        this.#allowedFlagHolders = allowedFlagHolders;
        this.#schema = new fields.SchemaField({
            value: valueSchema,
            restrictions: new fields.SchemaField(restrictionSchema)
        });
    }

    get type() {
        return this.#type;
    }

    get schema() {
        return this.#schema;
    }

    get allowedFlagHolders() {
        return this.#allowedFlagHolders;
    }

    #validAttributeSource(sourceItem) {
        if (!sourceItem) return false;
        return itemUtils.getEquipmentState(sourceItem);
    }

    getFlagHolders(actor) {
        if (!this.#allowedFlagHolders?.length) return actor.items;
        return this.#allowedFlagHolders.reduce((list, type) => {
            const allowed = actor.itemTypes[type] ?? [];
            list.push(...allowed);
            return list;
        }, []);
    }

    validate(item, data) {
        const cleaned = this.#schema.clean(data, {partial: true});
        const validationError = this.#schema.validate(cleaned);
        if (validationError) {
            Logging.addAttributeError(item, cleaned, validationError.asError());
            return {cleaned, valid: false, failure: validationError};
        }
        return {cleaned, valid: true};
    }

    evaluate({sourceItem, ...context}) {
        const attributes = sourceItem?.flags.cat?.alternateAttributes?.[this.#type];
        if (!attributes) return;
        if (!this.#validAttributeSource(sourceItem)) return;
        const options = new Set();
        for (const a of attributes) {
            const {cleaned, valid} = this.validate(sourceItem, a);
            if (!valid) continue;
            delete context.allowedDamageParts;
            let succeeds = true;
            for (const [type, r] of Object.entries(cleaned.restrictions)) {
                if (!r) continue;
                const restriction = Restrictions[type];
                if (!restriction.evaluate) {
                    Logging.addAttributeError(sourceItem, r, new Error(`Restriction of type ${type} is missing an evaluator!`));
                    continue;
                }
                if (!restriction.evaluate(r, context)) {
                    succeeds = false;
                    break;
                }
            }
            if (!succeeds) continue;
            if (context.item && !resolveDamageParts(context)) continue;
            if (Array.isArray(cleaned.value)) for (const v of cleaned.value) options.add(v);
            else options.add(cleaned.value);
        }
        return options;
    }

    getValueSummary(values) {
        if (this.#getValueSummary) return this.#getValueSummary(values);
        if (!Array.isArray(values)) return values;
        const choices = this.#schema.fields.value.element.choices;
        const options = typeof choices === 'function' ? choices() : choices;
        if (!options) return values.join(', ');
        return values.map(v => options[v]).join(', ');
    }
}

function resolveDamageParts({item, partIndex, allowedDamageParts}) {
    const targetIndex = (partIndex ?? -1) + (item.type === 'weapon');
    if (allowedDamageParts === undefined) return targetIndex === 0;
    return (allowedDamageParts & 1 << targetIndex) !== 0;
}

function getFormulaRestrictions() {
    return [
        Restrictions.Identifier,
        Restrictions.DamagePart,
        Restrictions.DamageType,
        Restrictions.Type,
        Restrictions.WeaponType,
        Restrictions.Property,
        Restrictions.Ability,
        Restrictions.School,
        Restrictions.Method,
        Restrictions.Level
    ];
}

function buildAttributes() {
    const ATTRIBUTES = {};
    const registerAttribute = attribute => ATTRIBUTES[attribute.type] = new AlternateAttribute({
        ...attribute,
        restrictionSchema: attribute.restrictions.reduce((list, r) => (r ? list[r.type] = r.schema : '', list), {})
    });

    registerAttribute({
        type: 'DamageFormula',
        valueSchema: new dndFields.FormulaField({
            placeholder: '1d4 + @mod',
            required: true
        }),
        allowedFlagHolders: ['feat', 'equipment'],
        restrictions: getFormulaRestrictions()
    });

    registerAttribute({
        type: 'RollModifier',
        valueSchema: new fields.ArrayField(new fields.StringField({
            placeholder: 'x, min2, r',
            required: true
        })),
        allowedFlagHolders: ['feat', 'equipment'],
        restrictions: getFormulaRestrictions()
    });

    registerAttribute({
        type: 'Ability',
        valueSchema: new fields.ArrayField(new fields.StringField({
            choices: () => Restrictions.mapKeyLabel(CONFIG.DND5E.abilities),
            placeholder: 'dex, con',
            required: true
        })),
        allowedFlagHolders: ['feat'],
        restrictions: [
            Restrictions.Identifier,
            Restrictions.DamageType,
            Restrictions.Property,
            Restrictions.Type,
            Restrictions.WeaponType
        ]
    });

    registerAttribute({
        type: 'ACFormula',
        valueSchema: new dndFields.FormulaField({
            placeholder: '13 + @abilities.dex.mod',
            deterministic: true,
            required: true
        }),
        allowedFlagHolders: ['feat'],
        restrictions: [
            Restrictions.Armor
        ]
    });

    registerAttribute({
        type: 'ACAbility',
        valueSchema: new fields.StringField({
            choices: () => Restrictions.mapKeyLabel(CONFIG.DND5E.abilities),
            initial: 'dex',
            required: true
        }),
        getValueSummary: value => CONFIG.DND5E.abilities[value]?.label ?? value,
        allowedFlagHolders: ['feat'],
        restrictions: [
            Restrictions.Armor
        ]
    });

    return ATTRIBUTES;
}

export default {
    buildAttributes
};
