import {genericUtils} from '../utilities/_module.mjs';

const fields = foundry.data.fields;
const RESULTS = {
    PASS: true,
    FAIL: false,
    FORCE_PASS: 'force',
    FORCE_FAIL: 'force-fail'
};
const TYPES = {Item: {}, Actor: {}};

const mapKeyKey = config => Object.entries(config).reduce((acc, [key, _]) => (acc[key] = key, acc), {});
const mapKeyLabel = config => Object.entries(config).reduce((acc, [key, value]) => (acc[key] = value.label, acc), {});

class AttributeRestriction {

    #type;
    #choices;
    #evaluate;
    #canInvert;
    #canRequireAll;
    #propertyPath;

    constructor({type, evaluate, choices, canInvert, canRequireAll, propertyPath}) {
        this.#type = type;
        this.#choices = choices;
        this.#evaluate = evaluate;
        this.#canInvert = canInvert;
        this.#propertyPath = propertyPath;
        this.#canRequireAll = canRequireAll;
    }

    get type() {
        return this.#type;
    }

    get schema() {
        const data = {
            value: new fields.ArrayField(new fields.StringField({choices: this.#choices}))
        };
        if (this.#canRequireAll) data.requireAll = new fields.BooleanField({required: true, initial: false});
        if (this.#canInvert) data.invert = new fields.BooleanField({required: true, initial: false});
        return new fields.SchemaField(data, {required: false});
    }

    evaluate(restriction, context) {
        if (!restriction.value?.length) return true;
        context.propertyPath = this.#propertyPath;
        const result = this.#evaluate(restriction, context);
        if (result == RESULTS.FORCE_PASS) return true;
        if (result == RESULTS.FORCE_FAIL) return false;
        return restriction.invert ? !result : result;
    }
}

function registerItemRestriction(config) {
    TYPES.Item[config.type] = new AttributeRestriction(config);
}

function registerActorRestriction(config) {
    TYPES.Actor[config.type] = new AttributeRestriction(config);
}

function checkList({value, requireAll}, {data, item, propertyPath}) {
    data ??= genericUtils.getProperty(item, propertyPath);
    if (!data) return RESULTS.FORCE_FAIL;
    if (data instanceof Set) {
        return requireAll ? value.every(v => data.has(v)) : value.some(v => data.has(v));
    }
    if (Array.isArray(data)) {
        return requireAll ? value.every(v => data.includes(v)) : value.some(v => data.includes(v));
    }
    return requireAll ? value.every(v => v === data) : value.some(v => v === data);
}

registerItemRestriction({
    type: 'Identifier',
    evaluate: ({value: ids}, {identifier, activityIdentifier, partIndex}) => {
        return ids.some(id => {
            let [itemID, activityID, idx = 0] = id.split('|').map(i => i.trim());
            if (itemID !== identifier) return false;
            if (activityID !== activityIdentifier) return false;
            if (idx === 'all' || !activityID?.length) return true;
            return idx == partIndex;
        });
    }
});

const ITEM_TYPES = ['consumable', 'equipment' ,'feat', 'loot', 'spell', 'tool', 'weapon'];
registerItemRestriction({
    type: 'Type',
    propertyPath: 'type',
    canInvert: true,
    choices: () => ITEM_TYPES.reduce((acc, key) => (acc[key] = _loc(CONFIG.Item.typeLabels[key]), acc), {}),
    evaluate: checkList
});

registerItemRestriction({
    type: 'Property',
    propertyPath: 'system.properties',
    canRequireAll: true,
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.itemProperties),
    evaluate: checkList
});

registerItemRestriction({
    type: 'School',
    propertyPath: 'system.school',
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.spellSchools),
    evaluate: checkList
});

registerItemRestriction({
    type: 'Level',
    propertyPath: 'system.level',
    canInvert: true,
    choices: () => CONFIG.DND5E.spellLevels,
    evaluate: checkList
});

registerItemRestriction({
    type: 'Ability',
    propertyPath: 'system.ability',
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.abilities),
    evaluate: checkList
});

registerItemRestriction({
    type: 'Method',
    propertyPath: 'system.method',
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.spellcasting),
    evaluate: checkList
});

registerItemRestriction({
    type: 'DamageType',
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.damageTypes),
    evaluate: (restriction, {damage}) => {
        if (!damage) return RESULTS.FORCE_FAIL;
        return checkList(restriction, {data: damage.types || [damage.type]});
    }
});

registerItemRestriction({
    type: 'WeaponType',
    propertyPath: 'system.type.value',
    canInvert: true,
    choices: () => CONFIG.DND5E.weaponTypes,
    evaluate: checkList
});

registerItemRestriction({
    type: 'DamagePart',
    choices: () => ({
        0: _loc('CAT.MEDKIT.DocProps.Restrictions.DamagePart.Base'),
        1: _loc('CAT.MEDKIT.DocProps.Restrictions.DamagePart.First'),
        2: _loc('CAT.MEDKIT.DocProps.Restrictions.DamagePart.Second'),
        3: _loc('CAT.MEDKIT.DocProps.Restrictions.DamagePart.Third')
    }),
    evaluate: (restriction, context) => {
        context.allowedDamageParts = restriction.value;
        return RESULTS.FORCE_PASS;
    }
});

registerActorRestriction({
    type: 'Armor',
    canInvert: true,
    canRequireAll: true,
    choices: () => ({
        heavy: CONFIG.DND5E.armorTypes.heavy,
        light: CONFIG.DND5E.armorTypes.light,
        medium: CONFIG.DND5E.armorTypes.medium,
        shield: CONFIG.DND5E.armorTypes.shield,
        unarmored: _loc('DND5E.ArmorClassUnarmored')
    }),
    evaluate: (restriction, {actor}) => {
        const armors = [];
        const ac = genericUtils.getProperty(actor, 'system.attributes.ac');
        for (const requirement of restriction.value) switch (requirement) {
            case 'heavy':
            case 'medium':
            case 'light':
                armors.push(requirement);
                break;
            case 'shield': {
                const shield = !!ac.equippedShield;
                if (shield && !restriction.requireAll) return RESULTS.PASS;
                if (!shield && restriction.requireAll) return RESULTS.FAIL;
                break;
            }
            case 'unarmored': {
                const unarmored = !ac.equippedArmor;
                if (unarmored && !restriction.requireAll) return RESULTS.PASS;
                if (!unarmored && restriction.requireAll) return RESULTS.FAIL;
                break;
            }
        }
        if (!armors.length) return RESULTS.PASS;
        return armors.includes(ac.equippedArmor?.system.type.value);
    }
});

export default {
    mapKeyKey,
    mapKeyLabel,
    ...TYPES
};
