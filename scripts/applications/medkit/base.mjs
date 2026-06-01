import {constants} from '../../lib/_module.mjs';
import {documentUtils, genericUtils, automationUtils, dialogUtils, uiUtils} from '../../utilities/_module.mjs';
import EmbeddedMacroEditorApp from '../embedded-macros.mjs';
const {fields} = foundry.data;

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

function embeddedToFlat(entry) {
    const macro = entry.macros?.[0] ?? {};
    return {name: entry.name ?? '', event: entry.event, pass: entry.pass, priority: macro.priority ?? 0, code: macro.macro ?? '', distance: macro.distance, configDistance: macro.configDistance, dispositions: macro.dispositions, configDispositions: macro.configDispositions, disabled: macro.disabled, configDisabled: macro.configDisabled};
}
function flatToEmbedded(flat) {
    const macro = {macro: flat.code ?? '', priority: flat.priority ?? 0};
    if (flat.distance != null && flat.distance !== '') macro.distance = Number(flat.distance);
    if (flat.configDistance) macro.configDistance = flat.configDistance;
    if (flat.dispositions) macro.dispositions = flat.dispositions;
    if (flat.configDispositions) macro.configDispositions = flat.configDispositions;
    if (Array.isArray(flat.disabled) && flat.disabled.length) macro.disabled = flat.disabled;
    if (flat.configDisabled) macro.configDisabled = flat.configDisabled;
    return {name: flat.name, event: flat.event, pass: flat.pass, macros: [macro]};
}

// Shared shell + in-memory state model + actions for every CAT medkit app.
// Subclasses declare DEFAULT_OPTIONS (id), PARTS, TABS, KEEP_PATHS, and override
// `static updateDocument` for doc-type-specific source-switch apply logic.
export default class MedkitApp extends HandlebarsApplicationMixin(ApplicationV2) {
    #document;
    /** In-memory mutable copy of document.flags.cat; flushed on Save. */
    #flags;
    /** In-memory mutable source selection; flushed on Save. */
    #selectedSource;
    /** In-memory mutable system.source.rules; flushed on Save. */
    #rulesValue;

    constructor({document, ...options}) {
        super({...options});
        this.#document = document;
        this.#hydrateState();
    }

    #hydrateState() {
        this.#flags = foundry.utils.deepClone(this.#document.flags?.cat ?? {});
        this.#selectedSource = this.#document.flags ? (documentUtils.getSource(this.#document) ?? 'none') : 'none';
        this.#rulesValue = this.#document.system?.source?.rules ?? null;
    }

    #reacquireDocument() {
        const actor = this.#document.actor;
        if (actor) this.#document = actor.items.get(this.#document.id) ?? this.#document;
    }

    static DEFAULT_OPTIONS = {
        id: 'cat-medkit-window',
        classes: ['cat', 'cat-medkit'],
        window: {frame: false, positioned: true},
        position: {width: 700, height: 'auto'},
        tag: 'form',
        form: {submitOnChange: false, closeOnSubmit: false},
        actions: {
            update: MedkitApp.#update,
            applyDefault: MedkitApp.#applyDefault,
            applyAvailable: MedkitApp.#applyAvailable,
            gotoTab: MedkitApp.#gotoTab,
            save: MedkitApp.#save,
            saveClose: MedkitApp.#saveClose,
            cancel: MedkitApp.#cancel,
            addEmbeddedMacro: MedkitApp.#addEmbeddedMacro,
            editEmbeddedMacro: MedkitApp.#editEmbeddedMacro,
            removeEmbeddedMacro: MedkitApp.#removeEmbeddedMacro,
            addDocument: MedkitApp.#addDocument,
            removeDocument: MedkitApp.#removeDocument,
            massApply: MedkitApp.#massApply
        }
    };

    /** Header/nav/footer parts shared by every medkit. Subclass spreads into its own PARTS. */
    static SHARED_PARTS = {
        header: {template: 'modules/cat/templates/medkit/shared/header.hbs'},
        nav: {template: 'modules/cat/templates/medkit/shared/nav.hbs'},
        footer: {template: 'modules/cat/templates/medkit/shared/footer.hbs'}
    };

    static PARTS = {...MedkitApp.SHARED_PARTS};

    // Scene / Level share an identical Automations / Embedded / Macros layout.
    static SCENE_LEVEL_PARTS = {
        ...MedkitApp.SHARED_PARTS,
        automations: {template: 'modules/cat/templates/medkit/shared/mass-apply-tab.hbs'},
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'}
    };

    static SCENE_LEVEL_TABS = {
        sheet: {
            tabs: [
                {id: 'automations', icon: 'fa-solid fa-download', label: 'CAT.MEDKIT.TABS.Automations'},
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
            ],
            initial: 'automations'
        }
    };

    static TABS = {sheet: {tabs: [], initial: undefined}};

    static KEEP_PATHS = [];

    get document() {
        return this.#document;
    }

    get title() {
        const name = this.#document.metadata?.label ?? this.#document.name ?? '';
        return _loc('CAT.MEDKIT.Title', {name});
    }

    get isDirty() {
        const committedFlags = this.#document.flags?.cat ?? {};
        const committedSource = this.#document.flags ? (documentUtils.getSource(this.#document) ?? 'none') : 'none';
        const committedRules = this.#document.system?.source?.rules ?? null;
        return !foundry.utils.equals(this.#flags, committedFlags)
            || this.#selectedSource !== committedSource
            || this.#rulesValue !== committedRules;
    }

    _getFlags() { return this.#flags; }
    _getSelectedSource() { return this.#selectedSource; }
    _setSelectedSource(value) { this.#selectedSource = value; }
    _getRulesValue() { return this.#rulesValue; }

    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        for (const [id, part] of Object.entries(parts)) {
            if (id === 'header' || id === 'nav' || id === 'footer') continue;
            if (!part.scrollable) part.scrollable = [''];
        }
        return parts;
    }

    // Override per subclass to return iterable of Items for mass apply.
    _getMassApplyItems() { return []; }

    static _massApplyItemsFromScene(scene) {
        const items = [];
        for (const token of scene?.tokens ?? []) {
            const actor = token.actor;
            if (!actor) continue;
            for (const item of actor.items) items.push(item);
        }
        return items;
    }

    async _preparePartContext(partId, context) {
        const partContext = await super._preparePartContext(partId, context);
        if (partId in partContext.tabs) partContext.tab = partContext.tabs[partId];
        if (partId === 'nav') {
            partContext.tabs = foundry.utils.deepClone(partContext.tabs);
            if (partContext.tabs.configuration && context.configurationCategories?.length) {
                partContext.tabs.configuration.indicator = 'configurable';
            }
            if (partContext.tabs.generic && context.genericSelected?.length) {
                partContext.tabs.generic.indicator = 'generic';
            }
        }
        return partContext;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.document = this.#document;
        context.label = this.#document.metadata?.label ?? this.#document.name ?? '';
        context.medkitStatus = constants.MEDKIT_STATUSES?.UNKNOWN;
        context.statusLabel = 'CAT.MEDKIT.STATUSES.Unavailable';
        context.isDirty = this.isDirty;
        context.embeddedCount = (this.#flags.embeddedMacros ?? []).length;
        context.embeddedMacros = (this.#flags.embeddedMacros ?? []).map((entry, index) => ({index, name: entry.name ?? '', event: entry.event ?? '', pass: entry.pass ?? ''}));
        context.buttons = [
            {type: 'button', action: 'cancel', label: 'CAT.MEDKIT.Footer.Cancel', name: 'cancel', icon: 'fa-solid fa-xmark', tooltip: 'CAT.MEDKIT.Footer.CancelTooltip'},
            {type: 'button', action: 'saveClose', label: 'CAT.MEDKIT.Footer.SaveClose', name: 'saveClose', icon: 'fa-solid fa-check', tooltip: 'CAT.MEDKIT.Footer.SaveCloseTooltip'},
            {type: 'button', action: 'save', label: 'CAT.MEDKIT.Footer.Save', name: 'save', icon: 'fa-solid fa-download', tooltip: 'CAT.MEDKIT.Footer.SaveTooltip'}
        ];
        if ('macros' in this.constructor.PARTS) context.macroChoices = this._prepareRegisteredMacros().choices;
        return context;
    }

    // Convert AutomationConfig[] into template-ready category groups.
    _prepareConfigurationCategories(automation) {
        const configs = automation?.config;
        if (!configs?.length) return [];
        const currentValues = this.#flags.config ?? {};
        const COMBOBOX_THRESHOLD = 8;
        const grouped = new Map();
        for (const cfg of configs) {
            const category = cfg.category ?? 'general';
            if (!grouped.has(category)) {
                grouped.set(category, {
                    id: category,
                    label: _loc(`CAT.MEDKIT.Categories.${category}.Label`),
                    tooltip: `CAT.MEDKIT.Categories.${category}.Tooltip`,
                    options: []
                });
            }
            const value = currentValues[cfg.key] ?? cfg.default;
            const option = {
                key: cfg.key,
                name: `flags.cat.config.${cfg.key}`,
                label: cfg.label,
                value,
                tooltip: cfg.tooltip,
                i18nOption: cfg.i18nOption ? _loc(cfg.i18nOption) : undefined
            };
            switch (cfg.type) {
                case 'checkbox':
                    option.field = new fields.BooleanField({label: cfg.label});
                    break;
                case 'number':
                    option.field = new fields.NumberField({label: cfg.label});
                    break;
                case 'text':
                    option.field = new fields.StringField({label: cfg.label});
                    break;
                case 'file':
                    option.field = new fields.FilePathField({label: cfg.label, categories: cfg.fileType ? [cfg.fileType.toUpperCase()] : ['IMAGE']});
                    break;
                case 'select': {
                    const opts = typeof cfg.options === 'function' ? cfg.options() : (cfg.options ?? []);
                    const sorted = [...opts].sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
                    const choices = sorted.reduce((acc, o) => { acc[o.value] = o.label; return acc; }, {});
                    if (sorted.length > COMBOBOX_THRESHOLD) {
                        option.isCombobox = true;
                        option.choices = sorted.map(o => ({value: o.value, label: o.label, image: o.image}));
                    } else {
                        option.field = new fields.StringField({label: cfg.label, choices, required: true, blank: false});
                    }
                    break;
                }
                case 'select-many': {
                    const opts = typeof cfg.options === 'function' ? cfg.options() : (cfg.options ?? []);
                    const sorted = [...opts].sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
                    const selectedValues = Array.isArray(value) ? value : [];
                    option.isMultiCombobox = true;
                    option.choices = sorted.map(o => ({
                        value: o.value,
                        label: o.label,
                        image: o.image,
                        selected: selectedValues.includes(o.value)
                    }));
                    option.value = selectedValues;
                    break;
                }
                case 'documents': {
                    option.isDocuments = true;
                    option.documents = (Array.isArray(value) ? value : []).map(uuid => {
                        const doc = fromUuidSync(uuid);
                        return {uuid, name: doc?.name ?? uuid, img: doc?.img};
                    });
                    break;
                }
                default:
                    option.field = new fields.StringField({label: cfg.label});
            }
            grouped.get(category).options.push(option);
        }
        return Array.from(grouped.values());
    }

    _getGenericMacros() {
        return constants.macros?.getAllMacros?.({genericOnly: true}) ?? [];
    }

    #genericDescriptors(macro, source, identifier) {
        const raw = macro?.genericConfig;
        if (Array.isArray(raw)) return raw;
        const nested = raw?.[source]?.[identifier];
        if (nested) return Object.entries(nested).map(([key, d]) => ({key, label: d?.label ?? key, type: d?.type, default: d?.default}));
        return [];
    }

    _prepareGenericFeatures() {
        const macros = this._getGenericMacros();
        const stored = this.#flags.genericConfig ?? {};
        const selected = [];
        for (const [source, ids] of Object.entries(stored)) {
            for (const identifier of Object.keys(ids ?? {})) selected.push(`${source}|${identifier}`);
        }
        const choices = macros.map(m => {
            const composite = `${m.source}|${m.identifier}`;
            return {value: composite, label: m.label ?? m.identifier, image: m.img, selected: selected.includes(composite)};
        });
        const features = selected.map(composite => {
            const [source, identifier] = composite.split('|');
            const macro = macros.find(m => m.source === source && m.identifier === identifier);
            const storedCfg = stored[source]?.[identifier] ?? {};
            const options = this.#genericDescriptors(macro, source, identifier).map(c => {
                const value = storedCfg[c.key] ?? c.default;
                const option = {key: c.key, name: `flags.cat.genericConfig.${source}.${identifier}.${c.key}`, label: c.label, value};
                switch (c.type) {
                    case 'checkbox': option.field = new fields.BooleanField({label: c.label}); break;
                    case 'number': option.field = new fields.NumberField({label: c.label}); break;
                    case 'text': option.field = new fields.StringField({label: c.label}); break;
                    default: option.field = new fields.StringField({label: c.label});
                }
                return option;
            });
            return {id: composite, label: macro?.label ?? identifier, options};
        });
        return {choices, selected, features};
    }

    _writeGenericSelection(compositeKeys) {
        const macros = this._getGenericMacros();
        const existing = this.#flags.genericConfig ?? {};
        const next = {};
        for (const composite of compositeKeys) {
            const [source, identifier] = composite.split('|');
            const prior = existing[source]?.[identifier];
            if (prior) {
                (next[source] ??= {})[identifier] = prior;
            } else {
                const macro = macros.find(m => m.source === source && m.identifier === identifier);
                const defaults = {};
                for (const c of this.#genericDescriptors(macro, source, identifier)) if (c.default !== undefined) defaults[c.key] = c.default;
                (next[source] ??= {})[identifier] = defaults;
            }
        }
        this.#flags.genericConfig = next;
    }

    // Every globally registered FnMacro (deduped by source|identifier|rules) is a choice.
    // flagPath selects which flag map holds the picked entries (e.g. 'macros' or 'placed.region.macros').
    _prepareRegisteredMacros(flagPath = 'macros') {
        if (!constants.macros) return {choices: []};
        const all = [...(constants.macros.fnMacros ?? []), ...(constants.macros.overwriteMacros ?? [])];
        const sourceLabel = src => constants.automations?.getSourceName?.(src) ?? src;
        const seen = new Map();
        for (const m of all) {
            const key = `${m.source}|${m.identifier}|${m.rules}`;
            if (seen.has(key)) continue;
            const events = Object.entries(m.macros ?? {}).filter(([, arr]) => arr?.length).map(([event]) => event);
            seen.set(key, {
                value: key,
                source: m.source,
                identifier: m.identifier,
                rules: m.rules,
                label: `${m.identifier}  [${sourceLabel(m.source)} · ${m.rules}]`,
                events
            });
        }
        const flagsMacros = foundry.utils.getProperty(this.#flags, flagPath) ?? {};
        const pickedKeys = new Set();
        for (const arr of Object.values(flagsMacros)) {
            if (!Array.isArray(arr)) continue;
            for (const entry of arr) pickedKeys.add(`${entry.source}|${entry.identifier}|${entry.rules ?? 'all'}`);
        }
        const choices = Array.from(seen.values())
            .map(c => ({...c, selected: pickedKeys.has(c.value)}))
            .sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
        return {choices};
    }

    // TODO: replace with Chris's forthcoming automationUtils.setItemMacros (or similar) when it lands.
    _writeMacroSelection(compositeKeys, flagPath = 'macros') {
        const lookup = new Map();
        for (const c of this._prepareRegisteredMacros(flagPath).choices) lookup.set(c.value, c);
        const next = {};
        for (const key of compositeKeys) {
            const choice = lookup.get(key);
            if (!choice) continue;
            const entry = {source: choice.source, rules: choice.rules, identifier: choice.identifier};
            for (const event of choice.events) {
                (next[event] ??= []).push(entry);
            }
        }
        foundry.utils.setProperty(this.#flags, flagPath, next);
    }

    // CONFIGURABLE + GENERIC overlay UP_TO_DATE; nav pips surface those.
    _prepareHero({availableAutomations, sourceLabel, currentVersion, configCount, genericCount, statusLabel, medkitStatus}) {
        const isOutdated = medkitStatus === constants.MEDKIT_STATUSES.OUTDATED;
        const isUpToDate = medkitStatus === constants.MEDKIT_STATUSES.UP_TO_DATE
            || statusLabel === 'CAT.MEDKIT.STATUSES.Configurable'
            || statusLabel === 'CAT.MEDKIT.STATUSES.Generic';
        if (isOutdated) {
            const newest = availableAutomations.find(a => a.source === this.#selectedSource);
            return {
                variant: 'outdated',
                medkitStatus,
                icon: 'fa-solid fa-circle-exclamation',
                heading: _loc('CAT.MEDKIT.Hero.Outdated.Heading', {current: currentVersion ?? '?', next: newest?.version ?? '?'}),
                copy: _loc('CAT.MEDKIT.Hero.Outdated.Copy', {source: sourceLabel}),
                cta: {action: 'update', label: _loc('CAT.MEDKIT.Hero.Outdated.CTA')}
            };
        }
        if (isUpToDate) {
            let cta;
            if (configCount > 0) cta = {action: 'gotoTab', tab: 'configuration', label: _loc('CAT.MEDKIT.Hero.Configurable.CTA')};
            else if (genericCount > 0) cta = {action: 'gotoTab', tab: 'generic', label: _loc('CAT.MEDKIT.Hero.Generic.CTA')};
            return {
                variant: 'uptodate',
                medkitStatus,
                icon: 'fa-solid fa-circle-check',
                heading: _loc('CAT.MEDKIT.Hero.UpToDate.Heading'),
                copy: _loc('CAT.MEDKIT.Hero.UpToDate.Copy', {source: sourceLabel}),
                cta
            };
        }
        if (medkitStatus === 'available') {
            const labelFor = src => constants.automations.getSourceName?.(src) ?? src;
            const sources = availableAutomations.map(a => ({value: a.source, label: labelFor(a.source)}));
            return {
                variant: 'available',
                isAvailable: true,
                medkitStatus,
                icon: 'fa-solid fa-circle-plus',
                heading: _loc('CAT.MEDKIT.Hero.Available.Heading'),
                copy: sources.map(s => s.label).join(', '),
                sources
            };
        }
        return {
            variant: 'unavailable',
            medkitStatus,
            icon: 'fa-solid fa-circle-question',
            heading: _loc('CAT.MEDKIT.Hero.Unavailable.Heading'),
            copy: _loc('CAT.MEDKIT.Hero.Unavailable.Copy')
        };
    }

    async _commit() {
        const committedSource = documentUtils.getSource(this.#document) ?? 'none';
        if (this.#selectedSource !== committedSource) {
            if (this.#selectedSource === 'none') {
                const sourceData = this.#document._stats?.compendiumSource ? (await fromUuid(this.#document._stats.compendiumSource)) : null;
                const updateData = sourceData?.toObject?.() ?? {};
                genericUtils.setProperty(updateData, 'flags.cat', _del);
                await documentUtils.update(this.#document, updateData, {diff: false});
            } else {
                await automationUtils.updateItem(this.#document, {source: this.#selectedSource});
                this.#reacquireDocument();
            }
            this.#hydrateState();
        }
        const updates = {flags: {cat: this.#flags}};
        if (this.#rulesValue !== (this.#document.system?.source?.rules ?? null)) {
            updates['system.source.rules'] = this.#rulesValue;
        }
        await documentUtils.update(this.#document, updates);
        this.#hydrateState();
    }

    /** @this {MedkitApp} */
    static async #save() {
        await this._commit();
        this.render();
    }

    /** @this {MedkitApp} */
    static async #saveClose() {
        await this._commit();
        this.close();
    }

    /** @this {MedkitApp} */
    static async #cancel() {
        if (this.isDirty) {
            const confirmed = await dialogUtils.confirm('CAT.MEDKIT.Footer.DiscardTitle', _loc('CAT.MEDKIT.Footer.DiscardPrompt'));
            if (!confirmed) return;
        }
        this.#hydrateState();
        this.close();
    }

    /** @this {MedkitApp} */
    static async #update() {
        const source = documentUtils.getSource(this.#document);
        if (!source) return;
        const before = documentUtils.getVersion(this.#document);
        await automationUtils.updateItem(this.#document, {source});
        this.#reacquireDocument();
        const after = documentUtils.getVersion(this.#document);
        const identifier = documentUtils.getIdentifier(this.#document) ?? this.#document.name;
        ui.notifications.info(_loc('CAT.MEDKIT.Notif.Updated', {identifier, before: before ?? '?', after: after ?? '?'}));
        this.#hydrateState();
        this.render();
    }

    /** @this {MedkitApp} */
    static async #applyAvailable() {
        const select = this.element.querySelector('select[name="heroSourcePick"]');
        const pickedSource = select?.value;
        if (!pickedSource) return;
        const available = automationUtils.getAvailableAutomations(this.#document);
        const pick = available.find(a => a.source === pickedSource);
        if (!pick) return;
        this.#selectedSource = pick.source;
        await this._commit();
        ui.notifications.info(_loc('CAT.MEDKIT.Notif.Applied', {source: constants.automations.getSourceName?.(pick.source) ?? pick.source, version: pick.version ?? '?'}));
        this.render();
    }

    /** @this {MedkitApp} */
    static async #applyDefault() {
        const available = automationUtils.getAvailableAutomations(this.#document);
        const priority = automationUtils.getAutomationSources();
        const pick = priority.map(s => available.find(a => a.source === s)).find(Boolean) ?? available[0];
        if (!pick) return;
        this.#selectedSource = pick.source;
        await this._commit();
        ui.notifications.info(_loc('CAT.MEDKIT.Notif.Applied', {source: constants.automations.getSourceName?.(pick.source) ?? pick.source, version: pick.version ?? '?'}));
        this.render();
    }

    /** @this {MedkitApp} */
    static #gotoTab(_event, target) {
        const tab = target.dataset.tab;
        if (tab) this.changeTab(tab, 'sheet');
    }

    /** @this {MedkitApp} */
    static async #massApply() {
        const items = Array.from(await this._getMassApplyItems() ?? []);
        if (!items.length) return;
        const confirmed = await dialogUtils.confirm('CAT.MEDKIT.MassApply.ConfirmTitle', _loc('CAT.MEDKIT.MassApply.ConfirmPrompt'));
        if (!confirmed) return;
        for (const item of items) {
            const source = documentUtils.getSource(item);
            if (!source) continue;
            await automationUtils.updateItem(item, {source});
        }
        ui.notifications.info(_loc('CAT.MEDKIT.MassApply.Done'));
        this.render();
    }

    #openEmbeddedEditor(macro, onSubmit) {
        new EmbeddedMacroEditorApp({macro, onSubmit, titleName: this.#document.name, documentType: this.constructor.DOCUMENT_TYPE}).render(true);
    }

    /** @this {MedkitApp} */
    static #addEmbeddedMacro() {
        this.#openEmbeddedEditor(undefined, flat => {
            const list = (this.#flags.embeddedMacros ??= []);
            if (list.some(entry => entry.name === flat.name)) {
                ui.notifications.error(_loc('CAT.MEDKIT.EmbeddedMacros.Duplicate', {name: flat.name}));
                return false;
            }
            list.push(flatToEmbedded(flat));
            this.render();
        });
    }

    /** @this {MedkitApp} */
    static #editEmbeddedMacro(_event, target) {
        const index = Number(target.dataset.index);
        const list = this.#flags.embeddedMacros ?? [];
        if (!list[index]) return;
        this.#openEmbeddedEditor(embeddedToFlat(list[index]), flat => {
            if (list.some((entry, i) => i !== index && entry.name === flat.name)) {
                ui.notifications.error(_loc('CAT.MEDKIT.EmbeddedMacros.Duplicate', {name: flat.name}));
                return false;
            }
            list[index] = flatToEmbedded(flat);
            this.render();
        });
    }

    /** @this {MedkitApp} */
    static #removeEmbeddedMacro(_event, target) {
        (this.#flags.embeddedMacros ?? []).splice(Number(target.dataset.index), 1);
        this.render();
    }

    /** @this {MedkitApp} */
    static async #addDocument(_event, target) {
        const group = target.closest('[data-config-key]');
        const key = group?.dataset.configKey;
        const input = group?.querySelector('input[type="text"]');
        const uuid = input?.value?.trim();
        if (!key || !uuid) return;
        const doc = fromUuidSync(uuid);
        if (!doc) {
            ui.notifications.error(_loc('CAT.MEDKIT.Documents.InvalidUuid'));
            return;
        }
        const path = `config.${key}`;
        const current = foundry.utils.getProperty(this.#flags, path) ?? [];
        if (current.includes(uuid)) return;
        foundry.utils.setProperty(this.#flags, path, [...current, uuid]);
        this.render();
    }

    /** @this {MedkitApp} */
    static async #removeDocument(_event, target) {
        const group = target.closest('[data-config-key]');
        const key = group?.dataset.configKey;
        const uuid = target.dataset.uuid;
        if (!key || !uuid) return;
        const path = `config.${key}`;
        const current = foundry.utils.getProperty(this.#flags, path) ?? [];
        const next = current.filter(u => u !== uuid);
        foundry.utils.setProperty(this.#flags, path, next);
        this.render();
    }

    bringToFront() {
        uiUtils.bringToFront(this);
    }

    // Mutates in-memory state; document.update is deferred until Save / Save & Close.
    async _onChangeForm(formConfig, event) {
        await super._onChangeForm(formConfig, event);
        const target = event.target;
        const name = target?.name ?? target?.getAttribute?.('name');
        if (!name) return;
        const multi = target.closest?.('cat-multi-combobox');
        const inMultiCombobox = !!multi;
        let value;
        if (inMultiCombobox) {
            const raw = multi.querySelector('input[type="hidden"]')?.value ?? target.value;
            try { value = raw ? JSON.parse(raw) : []; }
            catch { value = []; }
        } else if (target.type === 'checkbox') value = target.checked;
        else if (target.type === 'number') value = Number(target.value);
        else value = target.value;
        if (name === 'system.source.rules') {
            this.#rulesValue = value;
        } else if (name === 'selectedSource') {
            this.#selectedSource = value;
        } else if (inMultiCombobox && name === 'flags.cat.macros') {
            this._writeMacroSelection(Array.isArray(value) ? value : []);
        } else if (inMultiCombobox && name === 'flags.cat.genericConfig') {
            this._writeGenericSelection(Array.isArray(value) ? value : []);
        } else if (name.startsWith('flags.cat.')) {
            const path = name.slice('flags.cat.'.length);
            foundry.utils.setProperty(this.#flags, path, value);
        }
        this.render();
    }

    #wireDocumentDrop() {
        for (const el of this.element.querySelectorAll('.cat-medkit-documents')) {
            if (el.dataset.dropWired === '1') continue;
            el.dataset.dropWired = '1';
            el.addEventListener('dragover', e => e.preventDefault());
            el.addEventListener('drop', async event => {
                event.preventDefault();
                const key = el.dataset.configKey;
                if (!key) return;
                const payload = foundry.applications.ux.DragDrop.implementation.getPayload(event);
                const uuid = payload?.uuid;
                if (!uuid) return;
                const doc = fromUuidSync(uuid);
                if (!doc) return ui.notifications.error(_loc('CAT.MEDKIT.Documents.InvalidUuid'));
                const path = `config.${key}`;
                const current = foundry.utils.getProperty(this.#flags, path) ?? [];
                if (current.includes(uuid)) return;
                foundry.utils.setProperty(this.#flags, path, [...current, uuid]);
                this.render();
            });
        }
    }

    async _preClose(options) {
        options.animate = false;
        await uiUtils.fadeOut(this.element);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        uiUtils.enableWindowDrag(this, '.cat-medkit-header');
        this.#wireDocumentDrop();
        if (options.isFirstRender) {
            this.bringToFront();
            uiUtils.centerWindow(this, {width: 700, height: 500});
        }
    }
}
