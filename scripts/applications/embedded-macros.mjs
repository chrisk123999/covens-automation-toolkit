import {constants} from '../lib/_module.mjs';
import {uiUtils} from '../utilities/_module.mjs';
import {macroautocomplete} from '../integration/_modules.mjs';

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {fields} = foundry.data;

const CREATURE_SCOPES = ['actor', 'scene', 'nearby', 'region', 'level', 'group', 'vehicle', 'encounter'];
const WORKFLOW_SCOPES = ['activity', 'item', ...CREATURE_SCOPES,'token', 'target', 'enchantment', 'castEnchantment'];
const ACTOR_SCOPES = [...CREATURE_SCOPES.filter(scope => scope !== 'region'), 'target'];

// Which scope prefixes land on each document type at runtime (intersected with an event's scope set).
const DOCUMENT_SCOPES = {
    actor: ACTOR_SCOPES,
    item: ['item', ...ACTOR_SCOPES],
    activeeffect: [...ACTOR_SCOPES, 'enchantment'],
    activity: ['activity', 'item',...ACTOR_SCOPES, 'castEnchantment'],
    token: ['token', 'actor', 'scene', 'nearby', 'level', 'target'],
    region: ['region', 'target'],
    scene: ['scene'],
    level: ['level']
};
const PROXIMITY_FIELDS = ['distance', 'configDistance', 'dispositions', 'configDispositions', 'disabled', 'configDisabled'];
const EVENT_EXTRAS = {
    aura: {optional: PROXIMITY_FIELDS}
};
const SCOPE_EXTRAS = {
    nearby: {optional: PROXIMITY_FIELDS},
    target: {optional: PROXIMITY_FIELDS}
};
const CONFIG_KEYS = PROXIMITY_FIELDS;
// Statuses that suppress a proximity/aura macro when the target has them (trigger.mjs processDistanceMacros).
const DISABLED_STATUSES = ['incapacitated', 'dead', 'unconscious'];

let _eventStructure;
function getEventStructure() {
    if (_eventStructure) return _eventStructure;
    const c = constants;
    const rollChecks = Object.values(c.rollPasses).filter(pass => pass !== 'targetSituational');
    const itemBare = ['bulkUpdated', 'munched'];
    const itemScoped = Object.values(c.itemPasses).filter(pass => !itemBare.includes(pass));
    const mk = (list, self, scoped) => list.map(pass => ({pass, self, scoped}));
    return _eventStructure = {
        roll: {scopes: WORKFLOW_SCOPES, passes: mk(Object.values(c.workflowPasses), [], true)},
        combat: {scopes: CREATURE_SCOPES, passes: mk(Object.values(c.combatPasses), [], true)},
        move: {scopes: CREATURE_SCOPES, passes: mk(Object.values(c.movementPasses), [], true)},
        effect: {scopes: CREATURE_SCOPES, passes: mk(Object.values(c.effectPasses), ['activeeffect'], true)},
        item: {scopes: CREATURE_SCOPES, passes: [...mk(itemScoped, ['item'], true), ...mk(itemBare, ['item'], false)]},
        region: {scopes: [], passes: mk(Object.values(c.regionPasses), ['region'], false)},
        aura: {scopes: [], passes: mk(Object.values(c.auraPasses), ['item', 'activeeffect', 'actor', 'token', 'activity'], false)},
        rest: {scopes: CREATURE_SCOPES, passes: mk(Object.values(c.restPasses), [], true)},
        time: {scopes: CREATURE_SCOPES, passes: mk(Object.values(c.timePasses), [], true)},
        check: {scopes: CREATURE_SCOPES, passes: mk(rollChecks, [], true)},
        skill: {scopes: CREATURE_SCOPES, passes: mk(rollChecks, [], true)},
        save: {scopes: CREATURE_SCOPES, passes: mk(Object.values(c.rollPasses), [], true)},
        tool: {scopes: CREATURE_SCOPES, passes: mk(rollChecks, [], true)},
        summon: {scopes: CREATURE_SCOPES, passes: mk(Object.values(c.summonPasses), ['item', 'activity', 'actor', 'activeeffect'], true)},
        called: {scopes: CREATURE_SCOPES, passes: mk(c.calledPasses ? Object.values(c.calledPasses) : ['called'], ['item', 'activity', 'actor', 'activeeffect'], true)}
    };
}

// Yields {pass, scope, group} for every pass a document type can fire on an event (bare scope and ungrouped are null).
function* documentPassEntries(documentType, type) {
    const entry = getEventStructure()[type];
    if (!entry) return;
    const reach = DOCUMENT_SCOPES[documentType] ?? [];
    const scopes = entry.scopes.filter(scope => reach.includes(scope));
    for (const {pass, self, scoped} of entry.passes) {
        const group = entry.passes.length > 1 ? pass.capitalize() : null;
        if (self.includes(documentType)) yield {pass, scope: null, group};
        if (scoped) for (const scope of scopes) yield {pass: scope + pass.capitalize(), scope, group};
    }
}

// The pass strings a given document type can fire for one event type (bare + reachable scope variants).
function getDocumentPasses(documentType, type) {
    return [...documentPassEntries(documentType, type)].map(entry => ({label: entry.pass, value: entry.pass, group: entry.group}));
}

// Map of event type -> pass list for a document, omitting events with no applicable passes.
function getAllDocumentPasses(documentType) {
    const out = {};
    for (const type of Object.keys(getEventStructure())) {
        const passes = getDocumentPasses(documentType, type);
        if (passes.length) out[type] = passes;
    }
    return out;
}

// The extra config fields {required, optional} for one concrete pass (event extras + its scope extras).
function getPassFields(documentType, type, pass) {
    const entry = [...documentPassEntries(documentType, type)].find(i => i.pass === pass);
    if (!entry) return {required: [], optional: []};
    const event = EVENT_EXTRAS[type] ?? {};
    const scope = (entry.scope && SCOPE_EXTRAS[entry.scope]) || {};
    const required = [...(event.required ?? []), ...(scope.required ?? [])];
    const optional = [...(event.optional ?? []), ...(scope.optional ?? [])].filter(key => !required.includes(key));
    return {required, optional};
}

// Builds the input descriptor for one extra config field (a SchemaField formGroup, or a multi-combobox).
function extraFieldInput(key, macro) {
    switch (key) {
        case 'distance':
            return {field: new fields.NumberField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.Distance'), integer: true, min: 0}), value: macro.distance};
        case 'configDistance':
            return {field: new fields.StringField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.ConfigDistance')}), value: macro.configDistance};
        case 'dispositions':
            return {field: new fields.StringField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.Dispositions'), blank: true, choices: {all: _loc('CAT.MEDKIT.EmbeddedMacros.Disposition.All'), ally: _loc('CAT.MEDKIT.EmbeddedMacros.Disposition.Ally'), enemy: _loc('CAT.MEDKIT.EmbeddedMacros.Disposition.Enemy')}}), value: macro.dispositions};
        case 'configDispositions':
            return {field: new fields.StringField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.ConfigDispositions')}), value: macro.configDispositions};
        case 'disabled': {
            const picked = new Set(macro.disabled ?? []);
            return {combobox: true, label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.Disabled'), options: DISABLED_STATUSES.map(value => ({value, label: _loc(`CAT.MEDKIT.EmbeddedMacros.Disabled.${value.capitalize()}`), selected: picked.has(value)}))};
        }
        case 'configDisabled':
            return {field: new fields.StringField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.ConfigDisabled')}), value: macro.configDisabled};
        default:
            return null;
    }
}

export default class EmbeddedMacroEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
    #macro;
    #onSubmit;
    #titleName;
    #documentType;

    constructor({macro, onSubmit, titleName, documentType, ...options}) {
        super({...options});
        this.#macro = {name: '', event: undefined, pass: undefined, priority: 50, macro: '', ...(macro ?? {})};
        this.#onSubmit = onSubmit;
        this.#titleName = titleName ?? '';
        this.#documentType = documentType;
    }

    static DEFAULT_OPTIONS = {
        id: 'cat-embedded-macro-editor',
        classes: ['cat', 'cat-embedded-macros'],
        tag: 'form',
        window: {frame: false, positioned: true},
        position: {width: 820, height: 'auto'},
        form: {submitOnChange: false, closeOnSubmit: false},
        actions: {
            confirm: EmbeddedMacroEditorApp.#confirm
        }
    };

    static PARTS = {
        body: {template: 'modules/cat/templates/embedded-macros.hbs', scrollable: ['.cat-embedded-macros-body']}
    };

    get title() {
        return _loc('CAT.MEDKIT.EmbeddedMacros.Title', {name: this.#titleName});
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.title = this.title;
        const map = getAllDocumentPasses(this.#documentType);
        const eventChoices = Object.keys(map).sort((a, b) => a.localeCompare(b)).reduce((acc, key) => { acc[key] = key.titleCase(); return acc; }, {});
        const inputs = {
            name: {field: new fields.StringField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.Name')}), value: this.#macro.name},
            event: {field: new fields.StringField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.Event'), choices: eventChoices, blank: true}), value: this.#macro.event}
        };
        if (this.#macro.event) {
            if (this.#macro.event === 'called') {
                inputs.pass = {field: new fields.StringField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.Pass')}), value: this.#macro.pass};
            } else {
                const passChoices = (map[this.#macro.event] ?? []).reduce((acc, pass) => (acc[pass.value] = pass, acc), {});
                inputs.pass = {field: new fields.StringField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.Pass'), choices: passChoices, blank: true}), value: this.#macro.pass};
            }
            if (this.#macro.pass) {
                const {required, optional} = getPassFields(this.#documentType, this.#macro.event, this.#macro.pass);
                for (const key of [...required, ...optional]) inputs[key] = extraFieldInput(key, this.#macro);
            }
        }
        inputs.priority = {field: new fields.NumberField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.Priority'), integer: true, min: 0}), value: this.#macro.priority};
        inputs.macro = {field: new fields.JavaScriptField({label: _loc('CAT.MEDKIT.EmbeddedMacros.Fields.Macro'), async: true}), value: this.#macro.macro};
        context.inputs = inputs;
        return context;
    }

    async _onChangeForm(_formConfig, event) {
        const target = event.target;
        // cat-multi-combobox fires change from the element itself, which has no `.name` property.
        const name = target?.name ?? target?.getAttribute?.('name');
        if (!name) return;
        if (name === 'macro') {
            this.#macro.macro = target.value;
        } else if (name === 'priority') {
            this.#macro.priority = Number(target.value) || 50;
        } else if (name === 'distance') {
            this.#macro.distance = target.value === '' ? undefined : Number(target.value);
        } else if (name === 'disabled') {
            const raw = target.closest('cat-multi-combobox')?.querySelector('input[type="hidden"]')?.value ?? '';
            try { this.#macro.disabled = raw ? JSON.parse(raw) : []; }
            catch { this.#macro.disabled = []; }
        } else if (name === 'event') {
            this.#macro.event = target.value;
            if (!getDocumentPasses(this.#documentType, target.value).some(p => p.value === this.#macro.pass)) this.#macro.pass = undefined;
            this.render();
        } else if (name === 'pass') {
            this.#macro.pass = target.value;
            this.render();
        } else {
            this.#macro[name] = target.value;
        }
    }

    /** @this {EmbeddedMacroEditorApp} */
    static #confirm() {
        const macro = this.#macro;
        if (!macro.name?.trim() || !macro.event || !macro.pass) {
            ui.notifications.error(_loc('CAT.MEDKIT.EmbeddedMacros.Invalid', {name: macro.name?.trim() || '?'}));
            return;
        }
        const {required, optional} = getPassFields(this.#documentType, macro.event, macro.pass);
        const allowed = new Set([...required, ...optional]);
        const cleaned = {...macro, name: macro.name.trim()};
        for (const key of CONFIG_KEYS) if (!allowed.has(key)) delete cleaned[key];
        if (this.#onSubmit?.(cleaned) !== false) this.close();
    }

    async _preClose(options) {
        options.animate = false;
        await uiUtils.fadeOut(this.element);
    }

    bringToFront() {
        uiUtils.bringToFront(this);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        uiUtils.enableWindowDrag(this, '.cat-embedded-macros-header');
        if (options.isFirstRender) {
            this.bringToFront();
            uiUtils.centerWindow(this, {width: 820, height: 480});
        }
        macroautocomplete.inContext(context, this, this.#documentType);
    }
}
