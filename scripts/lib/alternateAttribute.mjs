import {Logging} from './_module.mjs';
import {itemUtils} from '../utilities/_module.mjs';
import {AttributeRestrictions as Restrictions} from './_module.mjs';

const fields = foundry.data.fields;
const dndFields = dnd5e.dataModels.fields;

class AlternateAttribute {

    #type;
    #schema;
    #allowedFlagHolders;

    constructor({type, valueSchema, restrictionSchema, allowedFlagHolders}) {
        this.#type = type;
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
            if (!resolveDamageParts(context)) continue;
            if (Array.isArray(cleaned.value)) cleaned.value.forEach(v => options.add(v));
            else options.add(cleaned.value);
        }
        return options;
    }
}

function resolveDamageParts({item, partIndex, allowedDamageParts}) {
    if (!item) return;
    const weapon = item.type === 'weapon';
    if (!allowedDamageParts?.length) return weapon ? partIndex === undefined : partIndex === 0;
    return allowedDamageParts.includes(String((partIndex ?? -1) + weapon));
}

function getFormulaRestrictions() {
    return [
        Restrictions.Item.Identifier,
        Restrictions.Item.DamagePart,
        Restrictions.Item.DamageType,
        Restrictions.Item.Type,
        Restrictions.Item.WeaponType,
        Restrictions.Item.Property,
        Restrictions.Item.Ability,
        Restrictions.Item.School,
        Restrictions.Item.Method,
        Restrictions.Item.Level
    ];
}

function buildAttributes() {
    const ATTRIBUTES = {};
    const registerAttribute = attribute => ATTRIBUTES[attribute.type] = new AlternateAttribute({
        ...attribute,
        restrictionSchema: attribute.restrictions.reduce((list, r) => (list[r.type] = r.schema, list), {})
    });

    registerAttribute({
        type: 'DamageFormula',
        valueSchema: new dndFields.FormulaField({
            hint: 'CAT.MEDKIT.DocProps.Props.DamageFormula.Hint',
            label: 'CAT.MEDKIT.DocProps.Props.DamageFormula.Field',
            placeholder: '1d4 + @mod',
            required: true
        }),
        allowedFlagHolders: ['feat', 'equipment'],
        restrictions: getFormulaRestrictions()
    });

    registerAttribute({
        type: 'RollModifier',
        valueSchema: new fields.ArrayField(new fields.StringField({
            hint: 'CAT.MEDKIT.DocProps.Props.RollModifier.Hint',
            label: 'CAT.MEDKIT.DocProps.Props.RollModifier.Field',
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
            hint: 'CAT.MEDKIT.DocProps.Props.Ability.Hint',
            label: 'CAT.MEDKIT.DocProps.Props.Ability.Field',
            placeholder: 'dex, con',
            required: true
        })),
        allowedFlagHolders: ['feat'],
        restrictions: [
            Restrictions.Item.Identifier,
            Restrictions.Item.DamageType,
            Restrictions.Item.Property,
            Restrictions.Item.Type,
            Restrictions.Item.WeaponType
        ]
    });

    registerAttribute({
        type: 'ACFormula',
        valueSchema: new dndFields.FormulaField({
            deterministic: true,
            required: true
        }),
        allowedFlagHolders: ['feat'],
        restrictions: [
            Restrictions.Actor.Armor
        ]
    });

    registerAttribute({
        type: 'ACAbility',
        valueSchema: new fields.StringField({
            choices: () => Restrictions.mapKeyLabel(CONFIG.DND5E.abilities),
            initial: 'dex',
            required: true
        }),
        allowedFlagHolders: ['feat'],
        restrictions: [
            Restrictions.Actor.Armor
        ]
    });

    return ATTRIBUTES;
}

export default {
    buildAttributes
};
