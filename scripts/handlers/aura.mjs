import {constants} from '../lib/_module.mjs';
import {automationUtils, documentUtils} from '../utilities/_module.mjs';
const triggerKeys = {
    enter: 'enterActivity',
    exit: 'exitActivity',
    turnStart: 'turnStartActivity',
    turnEnd: 'turnEndActivity'
};
function getFilter(value) {
    if (!value) return;
    const [kind, ...rest] = value.split('|');
    if (kind === 'embedded') return rest.join('|');
    const [rules, ...identifier] = rest;
    return {source: kind, rules, identifier: identifier.join('|')};
}
function filterOptions(document, flags) {
    const registered = new Map();
    [true, false].flatMap(genericOnly => constants.macros.getAllMacros({genericOnly})).forEach(macro => {
        if (!macro.macros.aura?.some(entry => entry.pass === 'filter')) return;
        registered.set(macro.source + '|' + macro.rules + '|' + macro.identifier, macro.identifier + ' (' + macro.source + ', ' + macro.rules + ')');
    });
    const embedded = (flags?.embeddedMacros ?? document?.flags?.cat?.embeddedMacros ?? []).filter(macro => macro.event === 'aura' && macro.pass === 'filter');
    return [
        {value: '', label: 'CAT.Config.None'},
        ...Array.from(registered.entries()).map(([value, label]) => ({value, label})),
        ...embedded.map(macro => ({value: 'embedded|' + macro.name, label: macro.name}))
    ];
}
function descriptor({document}) {
    const config = automationUtils.getGenericConfigValues(document, 'cat', 'aura', configKeys);
    const base = {
        id: documentUtils.getIdentifier(document) || document.name?.slugify() || 'aura',
        radius: config.radius,
        dispositions: config.dispositions,
        includeSelf: config.includeSelf,
        sourceDisable: config.sourceDisable,
        targetDisable: config.targetDisable,
        creatureTypes: config.creatureTypes,
        sourceStatuses: config.sourceStatuses,
        walls: config.walls,
        effect: config.effect,
        value: config.value ? {formula: config.value, stacking: config.stackHighest ? 'highest' : 'nearest'} : undefined,
        enterOnCreate: config.enterOnCreate,
        triggers: Object.entries(triggerKeys).filter(([, key]) => config[key]).map(([event, key]) => ({event, activity: config[key], oncePerTurn: config.oncePerTurn})),
        filter: getFilter(config.filter)
    };
    if (!config.enemyEffect) return base;
    return [
        {...base, dispositions: ['ally']},
        {...base, id: base.id + '-enemy', dispositions: ['enemy'], effect: config.enemyEffect}
    ];
}
const aura = {
    source: 'cat',
    identifier: 'aura',
    rules: 'all',
    generic: true,
    documents: ['item', 'activity', 'activeeffect'],
    aura: [
        {
            pass: 'descriptor',
            macro: descriptor,
            priority: 50
        }
    ],
    genericConfig: {
        radius: {
            default: '30',
            type: 'formula',
            category: 'behavior',
            label: 'CAT.Macros.Aura.Radius.Label',
            hint: 'CAT.Macros.Aura.Radius.Hint'
        },
        dispositions: {
            default: ['ally'],
            type: 'select-many',
            category: 'behavior',
            label: 'CAT.Config.Dispositions',
            hint: 'CAT.Macros.Aura.Dispositions.Hint',
            get options() { return constants.dispositionOptions; }
        },
        includeSelf: {
            default: true,
            type: 'checkbox',
            category: 'behavior',
            label: 'CAT.Macros.Aura.IncludeSelf.Label',
            hint: 'CAT.Macros.Aura.IncludeSelf.Hint'
        },
        sourceDisable: {
            default: [],
            type: 'select-many',
            category: 'behavior',
            label: 'CAT.Macros.Aura.SourceDisable.Label',
            hint: 'CAT.Macros.Aura.SourceDisable.Hint',
            get options() { return constants.statusOptions; }
        },
        targetDisable: {
            default: [],
            type: 'select-many',
            category: 'behavior',
            label: 'CAT.Macros.Aura.TargetDisable.Label',
            hint: 'CAT.Macros.Aura.TargetDisable.Hint',
            get options() { return constants.statusOptions; }
        },
        creatureTypes: {
            default: [],
            type: 'select-many',
            category: 'behavior',
            label: 'CAT.Config.CreatureTypes',
            hint: 'CAT.Macros.Aura.CreatureTypes.Hint',
            get options() { return constants.creatureTypeOptions; }
        },
        sourceStatuses: {
            default: [],
            type: 'select-many',
            category: 'behavior',
            label: 'CAT.Macros.Aura.SourceStatuses.Label',
            hint: 'CAT.Macros.Aura.SourceStatuses.Hint',
            get options() { return constants.statusOptions; }
        },
        walls: {
            default: false,
            type: 'checkbox',
            category: 'behavior',
            label: 'CAT.Macros.Aura.Walls.Label',
            hint: 'CAT.Macros.Aura.Walls.Hint'
        },
        effect: {
            default: '',
            type: 'selectEffect',
            category: 'behavior',
            label: 'CAT.Config.Effect',
            hint: 'CAT.Macros.Aura.Effect.Hint'
        },
        enemyEffect: {
            default: '',
            type: 'selectEffect',
            category: 'behavior',
            label: 'CAT.Macros.Aura.EnemyEffect.Label',
            hint: 'CAT.Macros.Aura.EnemyEffect.Hint'
        },
        value: {
            default: '',
            type: 'formula',
            category: 'behavior',
            label: 'CAT.Macros.Aura.Value.Label',
            hint: 'CAT.Macros.Aura.Value.Hint'
        },
        stackHighest: {
            default: false,
            type: 'checkbox',
            category: 'behavior',
            label: 'CAT.Macros.Aura.StackHighest.Label',
            hint: 'CAT.Macros.Aura.StackHighest.Hint'
        },
        enterActivity: {
            default: '',
            type: 'selectActivity',
            category: 'behavior',
            label: 'CAT.Macros.Aura.EnterActivity.Label',
            hint: 'CAT.Macros.Aura.EnterActivity.Hint'
        },
        exitActivity: {
            default: '',
            type: 'selectActivity',
            category: 'behavior',
            label: 'CAT.Macros.Aura.ExitActivity.Label',
            hint: 'CAT.Macros.Aura.ExitActivity.Hint'
        },
        turnStartActivity: {
            default: '',
            type: 'selectActivity',
            category: 'behavior',
            label: 'CAT.Macros.Aura.TurnStartActivity.Label',
            hint: 'CAT.Macros.Aura.TurnStartActivity.Hint'
        },
        turnEndActivity: {
            default: '',
            type: 'selectActivity',
            category: 'behavior',
            label: 'CAT.Macros.Aura.TurnEndActivity.Label',
            hint: 'CAT.Macros.Aura.TurnEndActivity.Hint'
        },
        enterOnCreate: {
            default: true,
            type: 'checkbox',
            category: 'behavior',
            label: 'CAT.Macros.Aura.EnterOnCreate.Label',
            hint: 'CAT.Macros.Aura.EnterOnCreate.Hint'
        },
        oncePerTurn: {
            default: false,
            type: 'checkbox',
            category: 'behavior',
            label: 'CAT.Macros.Aura.OncePerTurn.Label',
            hint: 'CAT.Macros.Aura.OncePerTurn.Hint'
        },
        filter: {
            default: '',
            type: 'select',
            category: 'behavior',
            label: 'CAT.Macros.Aura.Filter.Label',
            hint: 'CAT.Macros.Aura.Filter.Hint',
            options: filterOptions
        }
    }
};
const configKeys = Object.keys(aura.genericConfig);
function register() {
    constants.macros.registerFnMacro(aura);
}
export default {
    register,
    getFilter,
    filterOptions
};
