import {genericUtils} from '../utilities/_module.mjs';

const fields = foundry.data.fields;
const RESULTS = {
    PASS: true,
    FAIL: false,
    FORCE_PASS: 'force',
    FORCE_FAIL: 'force-fail'
};
const TYPES = {};

const mapKeyKey = config => Object.entries(config).reduce((acc, [key, _]) => (acc[key] = key, acc), {});
const mapKeyLabel = config => Object.entries(config).reduce((acc, [key, value]) => (acc[key] = value.label, acc), {});

class AttributeRestriction {

    #type;
    #choices;
    #evaluate;
    #canInvert;
    #canRequireAll;
    #propertyPath;

    constructor({type, evaluate, choices, canInvert, canRequireAll, propertyPath, hint, label}) {
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

function registerRestriction({type, evaluate, choices, canInvert, canRequireAll, propertyPath}) {
    TYPES[type] = new AttributeRestriction({type, evaluate, choices, canInvert, canRequireAll, propertyPath});
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

registerRestriction({
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
registerRestriction({
    type: 'Type',
    propertyPath: 'type',
    canInvert: true,
    choices: () => ITEM_TYPES.reduce((acc, key) => (acc[key] = _loc(CONFIG.Item.typeLabels[key]), acc), {}),
    evaluate: checkList
});

registerRestriction({
    type: 'Property',
    propertyPath: 'system.properties',
    canRequireAll: true,
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.itemProperties),
    evaluate: checkList
});

registerRestriction({
    type: 'School',
    propertyPath: 'system.school',
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.spellSchools),
    evaluate: checkList
});

registerRestriction({
    type: 'Level',
    propertyPath: 'system.level',
    canInvert: true,
    choices: () => CONFIG.DND5E.spellLevels,
    evaluate: checkList
});

registerRestriction({
    type: 'Ability',
    propertyPath: 'system.ability',
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.abilities),
    evaluate: checkList
});

registerRestriction({
    type: 'Method',
    propertyPath: 'system.method',
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.spellcasting),
    evaluate: checkList
});

registerRestriction({
    type: 'DamageType',
    canInvert: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.damageTypes),
    evaluate: (restriction, {damage}) => {
        if (!damage) return RESULTS.FORCE_FAIL;
        return checkList(restriction, {data: damage.types || [damage.type]});
    }
});

registerRestriction({
    type: 'WeaponType',
    propertyPath: 'system.type.value',
    canInvert: true,
    choices: () => CONFIG.DND5E.weaponTypes,
    evaluate: checkList
});

registerRestriction({
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

export default {
    mapKeyKey,
    mapKeyLabel,
    ...TYPES
};
