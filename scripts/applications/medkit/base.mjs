import contextmenu from '../../handlers/contextmenu.mjs';
import {constants, Logging} from '../../lib/_module.mjs';
import {automationUtils, dialogUtils, documentUtils, genericUtils, itemUtils} from '../../utilities/_module.mjs';
import uiUtils from '../../utilities/uiUtils.mjs';
import CatApp from '../cat-app.mjs';
import DialogApp from '../dialog.mjs';
import EmbeddedMacroEditorApp from '../embedded-macros.mjs';
const {fields} = foundry.data;

Hooks.once('setup', () => {
    foundry.applications.handlebars.loadTemplates([
        'modules/cat/templates/medkit/shared/option-field.hbs',
        'modules/cat/templates/medkit/shared/identifier-field.hbs',
        'modules/cat/templates/medkit/shared/automation-tree.hbs'
    ]);
});

function embeddedToFlat(entry) {
    const macro = entry.macros?.[0] ?? {};
    return {name: entry.name ?? '', event: entry.event, pass: entry.pass, priority: macro.priority ?? 0, macro: macro.macro ?? '', distance: macro.distance, configDistance: macro.configDistance, dispositions: macro.dispositions, configDispositions: macro.configDispositions, disabled: macro.disabled, configDisabled: macro.configDisabled};
}
function flatToEmbedded(flat) {
    const macro = {macro: flat.macro ?? '', priority: flat.priority ?? 0};
    if (flat.distance != null && flat.distance !== '') macro.distance = Number(flat.distance);
    if (flat.configDistance) macro.configDistance = flat.configDistance;
    if (flat.dispositions) macro.dispositions = flat.dispositions;
    if (flat.configDispositions) macro.configDispositions = flat.configDispositions;
    if (Array.isArray(flat.disabled) && flat.disabled.length) macro.disabled = flat.disabled;
    if (flat.configDisabled) macro.configDisabled = flat.configDisabled;
    return {name: flat.name, event: flat.event, pass: flat.pass, macros: [macro]};
}

export default class MedkitApp extends CatApp {
    #document;
    #flags;
    #listValues = {};
    #selectedSource;
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
        if (!actor) return;
        switch (this.#document.documentName) {
            case 'Item': this.#document = actor.items.get(this.#document.id) ?? this.#document; break;
            case 'Activity': this.#document = actor.items.get(this.#document.item.id)?.system.activities.get(this.#document.id) ?? this.#document; break;
        }
    }

    static INITIAL_SIZE = {width: 700, height: 500};

    static DEFAULT_OPTIONS = {
        id: 'cat-medkit-window',
        classes: ['cat', 'cat-medkit'],
        window: {frame: false, positioned: true},
        position: {width: 700, height: 'auto'},
        tag: 'form',
        form: {submitOnChange: false, closeOnSubmit: false},
        actions: {
            update: MedkitApp.#update,
            applyAvailable: MedkitApp.#applyAvailable,
            gotoTab: MedkitApp.#gotoTab,
            save: MedkitApp.#save,
            openMedkit: MedkitApp.#openMedkit,
            saveClose: MedkitApp.#saveClose,
            cancel: MedkitApp.#cancel,
            addEmbeddedMacro: MedkitApp.#addEmbeddedMacro,
            editEmbeddedMacro: MedkitApp.#editEmbeddedMacro,
            removeEmbeddedMacro: MedkitApp.#removeEmbeddedMacro,
            addListEntry: MedkitApp.#addListEntry,
            removeListEntry: MedkitApp.#removeListEntry,
            addSummonEntry: MedkitApp.#addSummonEntry,
            removeSummonEntry: MedkitApp.#removeSummonEntry,
            addSummonItem: MedkitApp.#addSummonItem,
            removeSummonItem: MedkitApp.#removeSummonItem,
            openCompendiumActor: MedkitApp.#openCompendiumActor,
            openCompendiumItem: MedkitApp.#openCompendiumItem,
            openSequencerDb: MedkitApp.#openSequencerDb,
            massApply: MedkitApp.#massApply
        }
    };

    static SHARED_PARTS = {
        header: CatApp.HEADER_PART,
        nav: {template: 'modules/cat/templates/medkit/shared/nav.hbs'},
        footer: CatApp.FOOTER_PART
    };

    static PARTS = {...MedkitApp.SHARED_PARTS};

    static GENERIC_PART = {generic: {template: 'modules/cat/templates/medkit/shared/generic.hbs'}};
    static GENERIC_TAB = {id: 'generic', icon: 'fa-solid fa-toolbox', label: 'CAT.MEDKIT.TABS.Generic'};

    static SCENE_LEVEL_PARTS = {
        ...MedkitApp.SHARED_PARTS,
        automations: {template: 'modules/cat/templates/medkit/shared/mass-apply-tab.hbs'},
        generic: {template: 'modules/cat/templates/medkit/shared/generic.hbs'},
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'}
    };

    static SCENE_LEVEL_TABS = {
        sheet: {
            tabs: [
                {id: 'automations', icon: 'fa-solid fa-download', label: 'CAT.MEDKIT.TABS.Automations'},
                {id: 'generic', icon: 'fa-solid fa-toolbox', label: 'CAT.MEDKIT.TABS.Generic'},
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
            ],
            initial: 'automations'
        }
    };

    static TABS = {sheet: {tabs: [], initial: undefined}};

    static KEEP_PATHS = [];

    static PERMISSION_SETTINGS = {
        automation: 'permissionsAutomation',
        automations: 'permissionsAutomation',
        configuration: 'permissionsConfiguration',
        generic: 'permissionsGeneric',
        embedded: 'permissionsEmbedded',
        docprops: 'permissionsDocProps',
        macros: 'permissionsMacros',
        region: 'permissionsPlacedRegion'
    };

    static canEditTab(tabId) {
        const key = MedkitApp.PERMISSION_SETTINGS[tabId];
        if (!key) return true;
        return game.user.role >= Number(game.settings.get('cat', key));
    }

    get document() {
        return this.#document;
    }

    get title() {
        const name = this.#document.metadata?.label ?? this.#document.name ?? '';
        return _loc('CAT.MEDKIT.Title', {name});
    }

    get detachable() {
        return true;
    }

    get footerButtons() {
        return [
            {type: 'button', action: 'cancel', label: 'CAT.MEDKIT.Footer.Cancel', name: 'cancel', icon: 'fa-solid fa-xmark', tooltip: 'CAT.MEDKIT.Footer.CancelTooltip'},
            {type: 'button', action: 'saveClose', label: 'CAT.MEDKIT.Footer.SaveClose', name: 'saveClose', icon: 'fa-solid fa-check', tooltip: 'CAT.MEDKIT.Footer.SaveCloseTooltip'},
            {type: 'button', action: 'save', label: 'CAT.MEDKIT.Footer.Save', name: 'save', icon: 'fa-solid fa-download', tooltip: 'CAT.MEDKIT.Footer.SaveTooltip'}
        ];
    }

    get closeAction() {
        return 'cancel';
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

    _getMassApplyItems() { return []; }

    _massApplyBucket(item) {
        const applied = automationUtils.getCurrentAutomation(item);
        const available = (automationUtils.getAvailableAutomations(item, {excludeSources: constants.massApplyExcludeSources}) ?? [])
            .filter(automation => automation.uuid !== item.uuid);
        if (!automationUtils.isSelfAutomation(item, {automation: applied}) && (applied || automationUtils.getStoredHash(item))) {
            return automationUtils.isUpToDate(item, {automation: applied}) ? {reason: 'current', applied, available} : {reason: 'outdated', applied, available};
        }
        return available.length ? {reason: 'available', available} : null;
    }

    async _prepareAutomationCounts() {
        const items = Array.from(await this._getMassApplyItems() ?? []).filter(item => !['class', 'subclass'].includes(item.type));
        const buckets = {
            'up-to-date': [],
            available: [],
            outdated: []
        };
        const statusFor = {current: 'up-to-date', available: 'available', outdated: 'outdated'};
        for (const item of items) {
            const bucket = this._massApplyBucket(item);
            if (bucket) buckets[statusFor[bucket.reason]].push(item.name);
        }
        return Object.entries(buckets).map(([status, names]) => ({
            status,
            label: `CAT.MEDKIT.MassApply.Counts.${status === 'up-to-date' ? 'UpToDate' : status === 'available' ? 'Available' : 'Outdated'}`,
            count: names.length,
            names: names.join(', ')
        }));
    }

    static _massApplyItemsFromScene(scene, {level} = {}) {
        const items = [];
        for (const token of scene?.tokens ?? []) {
            if (level && token.level !== level) continue;
            const actor = token.actor;
            if (!actor) continue;
            for (const item of actor.items) items.push(item);
        }
        return items;
    }

    async _canMassApply() { return true; }

    async _preparePartContext(partId, context) {
        const partContext = await super._preparePartContext(partId, context);
        if (partId in partContext.tabs) partContext.tab = partContext.tabs[partId];
        if (partId === 'nav') {
            partContext.tabs = foundry.utils.deepClone(partContext.tabs);
            for (const [id, hit] of Object.entries(this._prepareTabIndicators(context))) {
                if (!hit || !partContext.tabs[id]) continue;
                const key = hit.indicator === 'inherited' ? 'inherited' : id;
                partContext.tabs[id].indicator = hit.indicator;
                partContext.tabs[id].indicatorLabel = _loc(`CAT.MEDKIT.Indicator.${key}.${hit.count === 1 ? 'One' : 'Other'}`, {count: hit.count});
            }
            if (partContext.tabs.automation && context.hero) {
                partContext.tabs.automation.icon = context.hero.icon;
                partContext.tabs.automation.status = context.hero.medkitStatus;
                partContext.tabs.automation.indicatorLabel = _loc(context.statusLabel);
            }
        }
        return partContext;
    }

    _prepareTabIndicators(context) {
        const flags = this.#flags;
        const counted = (indicator, count) => count ? {indicator, count} : null;
        const docProps = Object.values(flags.alternateAttributes ?? {}).reduce((total, list) => total + (list?.length ?? 0), 0)
            + Object.keys(flags.classDifficultyClass ?? {}).length
            + Object.keys(flags.classAttackBonus ?? {}).length
            + (flags.hidden ? 1 : 0) + (flags.spellIdentifier ? 1 : 0) + (flags.otherAbilities ? 1 : 0);
        const picked = Object.values(flags.macros ?? {}).reduce((total, entry) => total + (Array.isArray(entry) ? entry.length : 0), 0);
        const options = (context.configurationCategories ?? []).reduce((total, category) => total + category.options.length, 0);
        return {
            configuration: counted('configurable', options),
            generic: counted('generic', context.genericSelected?.length ?? 0)
                ?? counted('inherited', automationUtils.countDescendantGenerics(this.#document)),
            embedded: counted('content', (flags.embeddedMacros ?? []).length),
            macros: counted('content', picked),
            docprops: counted('content', docProps),
            region: counted('content', (flags.placed?.region?.activities ?? []).length)
        };
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        this.#listValues = {};
        context.document = this.#document;
        context.title = this.#document.metadata?.label ?? this.#document.name ?? '';
        context.medkitStatus = undefined;
        context.statusLabel = 'CAT.MEDKIT.STATUSES.Unavailable';
        context.isDirty = this.isDirty;
        Object.assign(context, uiUtils.detachContext(this, options));
        context.embeddedMacros = (this.#flags.embeddedMacros ?? []).map((entry, index) => ({index, name: entry.name ?? '', event: entry.event ?? '', pass: entry.pass ?? ''}));
        if ('automations' in this.constructor.PARTS) context.automationCounts = await this._prepareAutomationCounts();
        if ('macros' in this.constructor.PARTS) context.macroChoices = this._prepareRegisteredMacros().choices;
        if ('generic' in this.constructor.PARTS) {
            const generic = this._prepareGenericFeatures();
            context.genericChoices = generic.choices;
            context.genericSelected = generic.selected;
            context.genericFeatures = generic.features;
        }
        return context;
    }

    _prepareConfigurationCategories(automation) {
        const configs = Object.entries(automation?.config ?? {}).map(([key, value]) => ({
            ...value,
            key: key
        }));
        if (!configs?.length) return [];
        const currentValues = this.#flags.config ?? {};
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
            const option = this.#buildOption(cfg, {name: `flags.cat.config.${cfg.key}`, value, configPath: `config.${cfg.key}`});
            grouped.get(category).options.push(option);
        }
        const categories = Array.from(grouped.values());
        for (const category of categories) category.groups = this.#groupRepeatedOptions(category.options);
        return categories;
    }

    #groupRepeatedOptions(options) {
        const words = key => key.split(/(?=[A-Z])/);
        const labelCounts = options.reduce((tally, option) => {
            tally[option.label] = (tally[option.label] ?? 0) + 1;
            return tally;
        }, {});
        const groups = [];
        for (const option of options) {
            const parts = words(option.key);
            const shared = labelCounts[option.label] > 1 && parts.length > 1 ? parts[0] : null;
            const previous = groups.at(-1);
            if (previous && previous.shared === shared) previous.options.push(option);
            else groups.push({shared, options: [option]});
        }
        return groups.map(group => {
            if (!group.shared) return {label: null, options: group.options};
            const wordLists = group.options.map(option => words(option.key));
            const common = [];
            for (let index = 0; index < wordLists[0].length - 1; index++) {
                const word = wordLists[0][index];
                if (!wordLists.every(list => list[index] === word)) break;
                common.push(word);
            }
            return {label: this.#humanize(common.join('')), options: group.options};
        });
    }

    #buildOption(descriptor, {name, value, configPath, source, identifier} = {}) {
        const {key} = descriptor;
        const label = descriptor.label ? _loc(descriptor.label) : this.#humanize(key);
        const hint = descriptor.hint || descriptor.tooltip;
        const option = {key, name, label, value, configPath, tooltip: hint ? _loc(hint) : undefined, i18nOption: descriptor.i18nOption ? _loc(descriptor.i18nOption) : undefined};
        try {
            this.#applyOptionField(option, descriptor, {label, value, source, identifier});
        } catch (err) {
            console.warn(`CAT | Skipping malformed medkit option "${key}".`, err);
        }
        if (option.isList && configPath) this.#listValues[configPath] = Array.isArray(value) ? value : [];
        return option;
    }

    #applyOptionField(option, descriptor, {label, value, source, identifier}) {
        const {type} = descriptor;
        const COMBOBOX_THRESHOLD = 8;
        const sortedOptions = () => {
            const opts = typeof descriptor.options === 'function' ? descriptor.options() : (descriptor.options ?? []);
            return opts.map(o => ({...o, label: _loc(o.label)})).sort((a, b) => (b.value === '') - (a.value === '') || a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
        };
        switch (type) {
            case 'checkbox': option.field = new fields.BooleanField({label}); break;
            case 'number': option.field = new fields.NumberField({label}); break;
            case 'text': option.field = new fields.StringField({label}); break;
            case 'file': {
                const category = descriptor.fileType?.toUpperCase();
                const categories = category && category in CONST.FILE_CATEGORIES ? [category] : ['IMAGE'];
                if (descriptor.sequencer && globalThis.Sequencer) {
                    option.isSequencerFile = true;
                    option.fileType = descriptor.fileType ?? 'imagevideo';
                } else {
                    option.field = new fields.FilePathField({label, categories});
                }
                break;
            }
            case 'select': {
                const sorted = sortedOptions();
                if (sorted.length > COMBOBOX_THRESHOLD) {
                    option.isCombobox = true;
                    option.choices = sorted.map(o => ({value: o.value, label: o.label, image: o.image, invert: o.invertColor}));
                } else {
                    const choices = sorted.reduce((acc, o) => { acc[o.value] = o.label; return acc; }, {});
                    option.field = new fields.StringField({label, choices, required: true, blank: false});
                }
                break;
            }
            case 'select-many': {
                const sorted = sortedOptions();
                const selectedValues = Array.isArray(value) ? value : [];
                option.isMultiCombobox = true;
                option.choices = sorted.map(o => ({value: o.value, label: o.label, image: o.image, invert: o.invertColor, selected: selectedValues.includes(o.value)}));
                option.value = selectedValues;
                break;
            }
            case 'documents':
                option.isList = true;
                option.validate = 'uuid';
                option.placeholder = 'CAT.MEDKIT.Documents.Placeholder';
                option.addTooltip = 'CAT.MEDKIT.Documents.Add';
                option.entries = (Array.isArray(value) ? value : []).map(uuid => {
                    const doc = fromUuidSync(uuid);
                    return {value: uuid, label: doc?.name ?? uuid, img: doc?.img};
                });
                break;
            case 'selectActivity':
                option.isCombobox = true;
                option.allowBlank = true;
                option.choices = this.#activityChoices();
                break;
            case 'selectActivities': {
                const activities = this.#activityChoices();
                const selectedValues = Array.isArray(value) ? value : [];
                option.isMultiCombobox = true;
                option.choices = activities.map(a => ({value: a.value, label: a.label, image: a.image, selected: selectedValues.includes(a.value)}));
                option.value = selectedValues;
                break;
            }
            case 'selectEffect':
                option.isCombobox = true;
                option.allowBlank = true;
                option.choices = this.#effectChoices();
                break;
            case 'selectAnimation': {
                const sel = (value && typeof value === 'object') ? value : descriptor.default;
                option.isAnimationSelect = true;
                option.choices = this.#animationChoices(descriptor.inputs);
                option.value = sel?.source ? `${sel.source}|${sel.identifier}` : '';
                option.animationOptions = this.#animationSubOptions(source, identifier, sel);
                option.animationCredits = this.#animationCredits(sel);
                break;
            }
            case 'selectIdentifiers':
                option.isList = true;
                option.validate = 'none';
                option.placeholder = 'CAT.MEDKIT.Generic.IdentifierPlaceholder';
                option.addTooltip = 'CAT.MEDKIT.Generic.AddIdentifier';
                option.entries = (Array.isArray(value) ? value : []).map(v => ({value: v, label: v}));
                break;
            case 'selectSummons': {
                const entries = Array.isArray(value) ? value : [];
                const base = option.name;
                const max = Number.isFinite(descriptor.max) ? descriptor.max : Infinity;
                option.isSummonSelect = true;
                option.max = Number.isFinite(max) ? max : '';
                option.canAdd = entries.length < max;
                option.summonEntries = entries.map((entry, i) => ({
                    index: i,
                    legend: entry.sourceActorName ?? (entry.sourceActorUuid ? fromUuidSync(entry.sourceActorUuid)?.name : null) ?? (max > 1 ? `${option.label} ${i + 1}` : option.label),
                    fields: [
                        {key: `summon-uuid-${i}`, name: `${base}.${i}.sourceActorUuid`, label: _loc('CAT.MEDKIT.Summons.Actor'), value: entry.sourceActorUuid ?? '', isCombobox: true, allowBlank: true, choices: this.#actorChoices(entry), compendiumPicker: true, compendiumMax: Number.isFinite(max) ? max : ''},
                        this.#buildOption({key: `summon-initiative-${i}`, type: 'select', label: 'CAT.MEDKIT.Summons.Initiative', options: [
                            {value: 'standard', label: _loc('CAT.MEDKIT.Summons.InitiativeStandard')},
                            {value: 'follows', label: _loc('CAT.MEDKIT.Summons.InitiativeFollows')},
                            {value: 'none', label: _loc('CAT.MEDKIT.Summons.InitiativeNone')}
                        ]}, {name: `${base}.${i}.initiative`, value: entry.initiative ?? 'standard'}),
                        this.#buildOption({key: `summon-name-${i}`, type: 'text', label: 'CAT.MEDKIT.Summons.Name'}, {name: `${base}.${i}.name`, value: entry.name}),
                        this.#buildOption({key: `summon-avatar-${i}`, type: 'file', label: 'CAT.MEDKIT.Summons.AvatarImg'}, {name: `${base}.${i}.avatarImg`, value: entry.avatarImg}),
                        this.#buildOption({key: `summon-token-${i}`, type: 'file', label: 'CAT.MEDKIT.Summons.TokenImg'}, {name: `${base}.${i}.tokenImg`, value: entry.tokenImg}),
                        {key: `summon-anim-${i}`, name: `${base}.${i}.animation`, label: _loc('CAT.MEDKIT.Summons.Animation'), value: entry.animation?.source ? `${entry.animation.source}|${entry.animation.identifier}` : '', isAnimationSelect: true, choices: this.#animationChoices(['summon', 'location', 'token']), animationCredits: this.#animationCredits(entry.animation)},
                        this.#buildOption({key: `summon-sound-place-${i}`, type: 'file', fileType: 'audio', label: 'CAT.MEDKIT.Summons.SoundPlaced'}, {name: `${base}.${i}.sounds.place`, value: entry.sounds?.place}),
                        this.#buildOption({key: `summon-sound-removed-${i}`, type: 'file', fileType: 'audio', label: 'CAT.MEDKIT.Summons.SoundRemoved'}, {name: `${base}.${i}.sounds.removed`, value: entry.sounds?.removed}),
                        this.#buildOption({key: `summon-sound-death-${i}`, type: 'file', fileType: 'audio', label: 'CAT.MEDKIT.Summons.SoundDeath'}, {name: `${base}.${i}.sounds.death`, value: entry.sounds?.death})
                    ],
                    items: this.#summonItems(entry, `${base}.${i}.items`, `${option.configPath}.${i}.items`)
                }));
                break;
            }
            case 'packOrFolderMultiSelect': {
                const selectedValues = Array.isArray(value) ? value : [];
                option.isMultiCombobox = true;
                option.choices = this.#packFolderChoices(descriptor.documentType ?? 'Actor', descriptor.mode)
                    .map(o => ({value: o.value, label: o.label, tag: o.tag, selected: selectedValues.includes(o.value)}));
                option.value = selectedValues;
                break;
            }
            default: option.field = new fields.StringField({label});
        }
    }

    _getGenericMacros() {
        return constants.macros?.getAllMacros?.({genericOnly: true, documentType: this.constructor.DOCUMENT_TYPE}) ?? [];
    }

    #genericDescriptors(macro, source, identifier) {
        const raw = macro?.genericConfig;
        if (!raw) return [];
        return Object.entries(raw).map(([key, d]) => ({
            key: key,
            label: d?.label,
            hint: d?.hint,
            type: d?.type,
            default: d?.default,
            options: d?.options,
            fileType: d?.fileType,
            inputs: d?.inputs,
            documentType: d?.documentType,
            sequencer: d?.sequencer,
            mode: d?.mode,
            max: d?.max
        }));
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
                return this.#buildOption(c, {
                    name: `flags.cat.genericConfig.${source}.${identifier}.${c.key}`,
                    value,
                    configPath: `genericConfig.${source}.${identifier}.${c.key}`,
                    source,
                    identifier
                });
            });
            return {id: composite, label: macro?.label ?? identifier, options, groups: this.#groupRepeatedOptions(options)};
        });
        return {choices, selected, features};
    }

    _prepareIdentifierField(context) {
        context.identifierField = new fields.StringField({label: _loc('CAT.MEDKIT.Identifier.Label')});
        context.identifierValue = this.#flags.identifier ?? '';
    }

    // TODO: Make this not required by setting a label for everything.
    #humanize(key) {
        return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()).replace(/\bId\b/g, 'ID');
    }

    #activityChoices() {
        let activities = [];
        const documentName = this.#document.documentName;
        switch (documentName) {
            case 'Item': activities = this.#document.system?.activities; break;
            case 'ActiveEffect': {
                const parent = this.#document.parent;
                if (parent?.documentName !== 'Item') break;
                activities = parent.system?.activities;
                break;
            }
            default: return [];
        }
        return [...activities].map(a => ({value: a.id, label: a.name ?? a.id, image: a.img}));
    }

    #effectChoices() {
        const effects = this.#document.item ? this.#document.item.effects : this.#document.effects;
        if (!effects) return [];
        return [...effects].map(e => ({value: e.id, label: e.name ?? e.id, image: e.img}));
    }

    #summonItems(entry, base, configPath) {
        const items = Array.isArray(entry.items) ? entry.items : [];
        return {
            base: configPath,
            entries: items.map((item, j) => {
                const doc = item.uuid ? fromUuidSync(item.uuid) : null;
                const itemType = item.itemType ?? doc?.type;
                const model = itemType ? CONFIG.Item.dataModels[itemType] : null;
                const hasField = key => !!model?.schema?.fields?.[key];
                const canEquip = hasField('equipped');
                const canAttune = canEquip && (item.canAttune ?? (doc ? !!doc.system?.attunement : hasField('attunement')));
                const fields = [
                    {key: `${base}-uuid-${j}`, name: `${base}.${j}.uuid`, label: _loc('CAT.MEDKIT.Summons.Item'), value: item.uuid ?? '', isCombobox: true, allowBlank: true, choices: this.#itemChoices(item), compendiumItemPicker: true},
                    this.#buildOption({key: `${base}-dc-${j}`, type: 'checkbox', label: 'CAT.MEDKIT.Summons.MatchDC'}, {name: `${base}.${j}.matchDC`, value: item.matchDC ?? false}),
                    this.#buildOption({key: `${base}-attack-${j}`, type: 'checkbox', label: 'CAT.MEDKIT.Summons.MatchAttack'}, {name: `${base}.${j}.matchAttack`, value: item.matchAttack ?? false})
                ];
                if (itemType === 'spell') {
                    fields.push(
                        {key: `${base}-method-${j}`, name: `${base}.${j}.method`, label: _loc('CAT.MEDKIT.Summons.Method'), value: item.method ?? '', isCombobox: true, allowBlank: true, choices: this.#spellMethodChoices()},
                        this.#buildOption({key: `${base}-prepared-${j}`, type: 'select', label: 'CAT.MEDKIT.Summons.Prepared', options: this.#spellPreparedChoices()}, {name: `${base}.${j}.prepared`, value: String(item.prepared ?? 0)})
                    );
                }
                if (canEquip) {
                    fields.push(this.#buildOption({key: `${base}-equip-${j}`, type: 'checkbox', label: 'CAT.MEDKIT.Summons.Equip'}, {name: `${base}.${j}.equipped`, value: item.equipped ?? true}));
                    if (canAttune) fields.push(this.#buildOption({key: `${base}-attune-${j}`, type: 'checkbox', label: 'CAT.MEDKIT.Summons.Attune'}, {name: `${base}.${j}.attuned`, value: item.attuned ?? false}));
                }
                fields.push(
                    this.#buildOption({key: `${base}-uses-${j}`, type: 'text', label: 'CAT.MEDKIT.Summons.UsesMax'}, {name: `${base}.${j}.usesMax`, value: item.usesMax ?? ''}),
                    {key: `${base}-recovery-${j}`, name: `${base}.${j}.usesRecovery`, label: _loc('CAT.MEDKIT.Summons.UsesRecovery'), value: item.usesRecovery ?? '', isCombobox: true, allowBlank: true, choices: this.#usesRecoveryChoices()}
                );
                if (item.usesRecovery === 'recharge') fields.push(this.#buildOption({key: `${base}-recharge-${j}`, type: 'text', label: 'CAT.MEDKIT.Summons.RechargeValue'}, {name: `${base}.${j}.usesRechargeFormula`, value: item.usesRechargeFormula ?? '6'}));
                fields.push(this.#buildOption({key: `${base}-desc-${j}`, type: 'text', label: 'CAT.MEDKIT.Summons.Description'}, {name: `${base}.${j}.description`, value: item.description ?? ''}));
                return {
                    index: j,
                    legend: item.itemName ?? doc?.name ?? `${_loc('CAT.MEDKIT.Summons.Item')} ${j + 1}`,
                    fields
                };
            })
        };
    }

    #spellMethodChoices() {
        return Object.entries(CONFIG.DND5E.spellcasting).map(([value, c]) => ({value, label: _loc(c.label)}));
    }

    #spellPreparedChoices() {
        return Object.values(CONFIG.DND5E.spellPreparationStates).map(s => ({value: String(s.value), label: _loc(s.label)}));
    }

    #usesRecoveryChoices() {
        return CONFIG.DND5E.limitedUsePeriods.recoveryOptions.map(o => ({value: o.value, label: _loc(o.label)}));
    }

    #itemChoices(entry = {}) {
        const currentUuid = entry.uuid;
        const world = game.items.map(i => ({value: i.uuid, label: i.name, image: i.img}));
        if (currentUuid && !world.some(c => c.value === currentUuid)) {
            const doc = entry.itemName ? null : fromUuidSync(currentUuid);
            world.push({
                value: currentUuid,
                label: entry.itemName ?? doc?.name ?? currentUuid,
                image: entry.itemImg ?? doc?.img
            });
        }
        return world.sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
    }

    #actorChoices(entry = {}) {
        const currentUuid = entry.sourceActorUuid;
        const world = game.actors.filter(a => !a.flags?.cat?.summon).map(a => ({value: a.uuid, label: a.name, image: a.img}));
        if (currentUuid && !world.some(c => c.value === currentUuid)) {
            const doc = entry.sourceActorName ? null : fromUuidSync(currentUuid);
            world.push({
                value: currentUuid,
                label: entry.sourceActorName ?? doc?.name ?? currentUuid,
                image: entry.sourceActorImg ?? doc?.img
            });
        }
        return world.sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
    }

    #packFolderChoices(documentType, mode) {
        const choices = [];
        if (mode !== 'pack') {
            choices.push(...game.folders
                .filter(f => f.type === documentType)
                .map(f => ({value: `folder:${f.id}`, label: f.name, tag: _loc('CAT.MEDKIT.PackFolder.Folder')})));
        }
        if (mode !== 'folder') {
            choices.push(...game.packs
                .filter(p => p.metadata.type === documentType)
                .map(p => ({value: `pack:${p.metadata.id}`, label: p.metadata.label, tag: _loc('CAT.MEDKIT.PackFolder.Pack')})));
        }
        return choices.sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
    }

    #animationChoices(requiredInputs) {
        let animations = Array.from(constants.animations.animations.values());
        if (Array.isArray(requiredInputs)) {
            const required = [...requiredInputs].sort();
            animations = animations.filter(a => {
                const inputs = [...(a.inputs ?? [])].sort();
                return inputs.length === required.length && inputs.every((v, i) => v === required[i]);
            });
        }
        return [
            {value: 'none|none', label: _loc('DND5E.None')},
            ...animations.map(a => ({value: `${a.source}|${a.identifier}`, label: a.name ? _loc(a.name) : a.identifier}))
        ];
    }

    #animationCredits(selection) {
        if (!selection?.source || !selection?.identifier) return [];
        const animation = constants.animations?.getAnimation(selection.source, selection.identifier);
        return animation?.credits ?? [];
    }

    #animationSubOptions(source, identifier, selection) {
        if (!selection?.source || !selection?.identifier) return [];
        if (!source || !identifier) {
            const stored = this.#flags.animationConfig?.[selection.source]?.[selection.identifier] ?? {};
            return this.#animationConfigOptions(selection, stored, `animationConfig.${selection.source}.${selection.identifier}`);
        }
        const stored = this.#flags.animationGenericConfig?.[source]?.[identifier]?.[selection.source]?.[selection.identifier] ?? {};
        return this.#animationConfigOptions(selection, stored, `animationGenericConfig.${source}.${identifier}.${selection.source}.${selection.identifier}`);
    }

    #animationConfigOptions(selection, stored, prefix) {
        if (!selection?.source || !selection?.identifier) return [];
        const animation = constants.animations?.getAnimation(selection.source, selection.identifier);
        if (!animation?.config) return [];
        return Object.entries(animation.config).map(([key, desc]) => {
            const normalized = {key, type: desc.type, label: desc.label, default: desc.default, fileType: desc.fileType, sequencer: desc.sequencer};
            if (desc.type === 'select') {
                normalized.options = Object.entries(desc.options ?? {})
                    .filter(([, opt]) => !opt?.requirements?.length || opt.requirements.every(r => game.modules.get(r)?.active))
                    .map(([value, opt]) => ({value, label: opt?.label ? _loc(opt.label) : value}));
            }
            const value = stored[key] ?? desc.default;
            return this.#buildOption(normalized, {name: `flags.cat.${prefix}.${key}`, value});
        });
    }

    _animationFlagOption({key, label, tooltip, path, macroKey}) {
        const stored = foundry.utils.getProperty(this.#flags, path);
        const selection = stored && typeof stored === 'object' ? stored : undefined;
        const animations = Array.from(constants.animations.animations.values()).filter(a => a.macros?.[macroKey]);
        return {
            key,
            name: `flags.cat.${path}`,
            label,
            tooltip,
            isAnimationSelect: true,
            choices: [
                {value: 'none|none', label: _loc('DND5E.None')},
                ...animations.map(a => ({value: `${a.source}|${a.identifier}`, label: a.name ? _loc(a.name) : a.identifier}))
            ],
            value: selection?.source ? `${selection.source}|${selection.identifier}` : '',
            animationOptions: this.#animationConfigOptions(selection, selection?.config ?? {}, `${path}.config`),
            animationCredits: this.#animationCredits(selection)
        };
    }

    #partitionMacroEntries(macrosMap) {
        const generics = this._getGenericMacros();
        const isGeneric = e => generics.some(g => g.source === e.source && g.identifier === e.identifier);
        const generic = {}, other = {};
        for (const [event, entries] of Object.entries(macrosMap ?? {})) {
            for (const entry of entries ?? []) {
                const bucket = isGeneric(entry) ? generic : other;
                (bucket[event] ??= []).push(entry);
            }
        }
        return {generic, other};
    }

    #mergeMacroEntries(target, additions) {
        for (const [event, entries] of Object.entries(additions ?? {})) {
            const list = (target[event] ??= []);
            for (const entry of entries) {
                if (!list.some(e => e.source === entry.source && e.identifier === entry.identifier && e.rules === entry.rules)) list.push(entry);
            }
        }
    }

    _writeGenericSelection(compositeKeys) {
        const macros = this._getGenericMacros();
        const existing = this.#flags.genericConfig ?? {};
        const next = {};
        const bindings = {};
        for (const composite of compositeKeys) {
            const [source, identifier] = composite.split('|');
            const macro = macros.find(m => m.source === source && m.identifier === identifier);
            const prior = existing[source]?.[identifier];
            if (prior) {
                (next[source] ??= {})[identifier] = prior;
            } else {
                const defaults = {};
                for (const c of this.#genericDescriptors(macro, source, identifier)) if (c.default !== undefined) defaults[c.key] = c.default;
                (next[source] ??= {})[identifier] = defaults;
            }
            if (macro?.flagData) this.#mergeMacroEntries(bindings, macro.flagData);
        }
        this.#flags.genericConfig = next;
        const {other} = this.#partitionMacroEntries(this.#flags.macros);
        this.#mergeMacroEntries(other, bindings);
        if (Object.keys(other).length) this.#flags.macros = other;
        else delete this.#flags.macros;
    }

    _prepareRegisteredMacros(flagPath = 'macros') {
        if (!constants.macros) return {choices: []};
        const all = constants.macros.getAllMacros({genericOnly: false});
        const sourceLabel = src => {
            const name = constants.automations?.getSourceName?.(src) ?? src;
            const words = String(name).split(/\s+/).filter(word => !['of', 'the', 'and', 'for', 'a', '&'].includes(word.toLowerCase()));
            return words.length > 1 ? words.map(word => word[0]).join('').toUpperCase() : name;
        };
        const choicesData = all.map(m => {
            const key = m.source + '|' + m.identifier + '|' + m.rules;
            const events = Object.entries(m.macros ?? {}).filter(([, arr]) => arr?.length).map(([event]) => event);
            return {
                value: key,
                source: m.source,
                identifier: m.identifier,
                rules: m.rules,
                label: m.identifier + '  [' + sourceLabel(m.source) + ' - ' + m.rules + ']',
                events
            };
        });
        const flagsMacros = foundry.utils.getProperty(this.#flags, flagPath) ?? {};
        const pickedKeys = new Set();
        for (const arr of Object.values(flagsMacros)) {
            if (!Array.isArray(arr)) continue;
            for (const entry of arr) {
                pickedKeys.add(entry.source + '|' + entry.identifier + '|' + (entry.rules ?? 'all'));
            }
        }
        const choices = choicesData.map(c => ({...c, selected: pickedKeys.has(c.value)})).sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
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
        if (flagPath === 'macros') this.#mergeMacroEntries(next, this.#partitionMacroEntries(this.#flags.macros).generic);
        foundry.utils.setProperty(this.#flags, flagPath, next);
    }

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
            const priority = automationUtils.getAutomationSources();
            const rank = src => { const i = priority.indexOf(src); return i === -1 ? Infinity : i; };
            const seen = new Set();
            const sources = [...availableAutomations]
                .sort((a, b) => rank(a.source) - rank(b.source))
                .filter(a => !seen.has(a.source) && seen.add(a.source))
                .map(a => ({value: a.source, label: labelFor(a.source), selected: a.source === this.#selectedSource}));
            return {
                variant: 'available',
                isAvailable: true,
                medkitStatus,
                icon: 'fa-solid fa-circle-plus',
                heading: _loc('CAT.MEDKIT.Hero.Available.Heading'),
                copy: sources.map(s => s.label).join('\n'),
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

    #needsReload() {
        if (!this.#document.inCompendium) return false;
        if (documentUtils.getVersion(this.#document) !== genericUtils.getProperty(this.#flags, 'automation.version')) return true;
        if (this.#rulesValue !== (this.#document.system?.source?.rules ?? null)) return true;
        if (this.#document.documentName !== 'Item') return false;
        if (itemUtils.getAdvancementSourceKey(this.#document) !== genericUtils.getProperty(this.#flags, 'automation.sourceType')) return true;
        return false;
    }

    async _commit() {
        const committedSource = documentUtils.getSource(this.#document) ?? 'none';
        if (this.#selectedSource !== committedSource) {
            if (this.#selectedSource === 'none') {
                const sourceData = this.#document._stats?.compendiumSource ? (await fromUuid(this.#document._stats.compendiumSource)) : null;
                const updateData = sourceData?.toObject?.() ?? {};
                genericUtils.setProperty(updateData, 'flags.cat', _del);
                const currentDescription = genericUtils.getProperty(updateData, 'system.description.value') ?? this.#document.system?.description?.value;
                if (currentDescription) genericUtils.setProperty(updateData, 'system.description.value', itemUtils.stripDescriptionBlock(currentDescription));
                await documentUtils.update(this.#document, updateData, {diff: false});
            } else {
                await automationUtils.updateItem(this.#document, {source: this.#selectedSource});
                this.#reacquireDocument();
            }
            this.#hydrateState();
        }
        if (this.#needsReload()) genericUtils.notify('CAT.MEDKIT.ReloadWarning', {type: 'warn'});
        const updates = {flags: {cat: _replace(this.#flags)}};
        if (this.#rulesValue !== (this.#document.system?.source?.rules ?? null)) {
            updates['system.source.rules'] = this.#rulesValue;
        }
        await documentUtils.update(this.#document, updates);
        this.#reacquireDocument();
        if (this.#document.documentName === 'Item' && this.#document.actor) await automationUtils.updateScales(this.#document);
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
        genericUtils.notify('CAT.MEDKIT.Notif.Updated', {format: {identifier, before: before ?? '?', after: after ?? '?'}});
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
        genericUtils.notify('CAT.MEDKIT.Notif.Applied', {format: {source: constants.automations.getSourceName?.(pick.source) ?? pick.source, version: pick.version ?? '?'}});
        this.render();
    }

    /** @this {MedkitApp} */
    static #gotoTab(_event, target) {
        const tab = target.dataset.tab;
        if (tab) this.changeTab(tab, 'sheet');
    }

    /** @this {MedkitApp} */
    static async #openCompendiumActor(_event, target) {
        const CompendiumBrowser = dnd5e?.applications?.CompendiumBrowser;
        const name = target.dataset.flagName;
        const match = name?.match(/^flags\.cat\.(.+)\.(\d+)\.sourceActorUuid$/);
        if (!CompendiumBrowser || !match) return;
        const [, listPath, indexStr] = match;
        const startIndex = Number(indexStr);
        const max = Number(target.dataset.summonMax) || Infinity;
        const remaining = Number.isFinite(max) ? Math.max(1, max - startIndex) : null;
        const types = new Set(game.documentTypes.Actor);
        const result = await CompendiumBrowser.select({filters: {locked: {documentClass: 'Actor', types}}, selection: {min: 1, max: remaining}});
        if (!result?.size) return;
        const flags = this._getFlags();
        const list = foundry.utils.getProperty(flags, listPath) ?? [];
        const uuids = [...result];
        for (let j = 0; j < uuids.length && startIndex + j < max; j++) {
            const doc = await fromUuid(uuids[j]);
            list[startIndex + j] = {...(list[startIndex + j] ?? {}), sourceActorUuid: uuids[j], sourceActorName: doc?.name ?? uuids[j], sourceActorImg: doc?.img};
        }
        foundry.utils.setProperty(flags, listPath, list);
        this.render();
    }

    /** @this {MedkitApp} */
    static #addSummonEntry(_event, target) {
        const wrap = target.closest('.summons');
        const path = wrap?.dataset.flagPath;
        if (!path) return;
        const max = Number(wrap.dataset.max) || Infinity;
        const flags = this._getFlags();
        const list = foundry.utils.getProperty(flags, path) ?? [];
        if (list.length >= max) return;
        foundry.utils.setProperty(flags, path, [...list, {}]);
        this.render();
    }

    /** @this {MedkitApp} */
    static #removeSummonEntry(_event, target) {
        const wrap = target.closest('.summons');
        const path = wrap?.dataset.flagPath;
        if (!path) return;
        const flags = this._getFlags();
        const list = foundry.utils.getProperty(flags, path) ?? [];
        foundry.utils.setProperty(flags, path, list.filter((_, i) => i !== Number(target.dataset.index)));
        this.render();
    }

    /** @this {MedkitApp} */
    static async #openCompendiumItem(_event, target) {
        const CompendiumBrowser = dnd5e?.applications?.CompendiumBrowser;
        const name = target.dataset.flagName;
        const match = name?.match(/^flags\.cat\.(.+)\.(\d+)\.uuid$/);
        if (!CompendiumBrowser || !match) return;
        const [, listPath, indexStr] = match;
        const startIndex = Number(indexStr);
        const types = new Set(game.documentTypes.Item);
        const result = await CompendiumBrowser.select({filters: {locked: {documentClass: 'Item', types}}, selection: {min: 1, max: null}});
        if (!result?.size) return;
        const flags = this._getFlags();
        const list = foundry.utils.getProperty(flags, listPath) ?? [];
        const uuids = [...result];
        for (let j = 0; j < uuids.length; j++) {
            const doc = await fromUuid(uuids[j]);
            list[startIndex + j] = {...(list[startIndex + j] ?? {}), uuid: uuids[j], itemName: doc?.name ?? uuids[j], itemImg: doc?.img, itemType: doc?.type, canAttune: !!doc?.system?.attunement};
        }
        foundry.utils.setProperty(flags, listPath, list);
        this.render();
    }

    /** @this {MedkitApp} */
    static #addSummonItem(_event, target) {
        const wrap = target.closest('.summon-items');
        const path = wrap?.dataset.flagPath;
        if (!path) return;
        const flags = this._getFlags();
        const list = foundry.utils.getProperty(flags, path) ?? [];
        foundry.utils.setProperty(flags, path, [...list, {}]);
        this.render();
    }

    /** @this {MedkitApp} */
    static #removeSummonItem(_event, target) {
        const wrap = target.closest('.summon-items');
        const path = wrap?.dataset.flagPath;
        if (!path) return;
        const flags = this._getFlags();
        const list = foundry.utils.getProperty(flags, path) ?? [];
        foundry.utils.setProperty(flags, path, list.filter((_, i) => i !== Number(target.dataset.index)));
        this.render();
    }

    static #openSequencerDb(_event, target) {
        const viewer = globalThis.Sequencer?.DatabaseViewer;
        if (!viewer?.show) return;
        const picker = target.closest('.form-fields')?.querySelector('file-picker');
        viewer.show();
        if (!picker) return;
        let timer;
        const onCopy = () => {
            clearTimeout(timer);
            document.removeEventListener('copy', onCopy, true);
            const el = document.activeElement;
            const text = (el && 'value' in el ? el.value : '').replace(/^"|"$/g, '').trim();
            if (!text) return;
            picker.value = text;
            picker.dispatchEvent(new Event('change', {bubbles: true}));
        };
        document.addEventListener('copy', onCopy, true);
        timer = setTimeout(() => document.removeEventListener('copy', onCopy, true), 120000);
    }

    /** @this {MedkitApp} */
    static async #massApply() {
        if (!await this._canMassApply()) return;
        const rawItems = Array.from(await this._getMassApplyItems() ?? []);
        if (!rawItems.length) return;
        const dependencyMap = new Map();
        rawItems.forEach(item => dependencyMap.set(item.id, itemUtils.getDependencies(item)));
        const sortedItems = [];
        const visited = new Set();
        const visiting = new Set();
        let cycleDetected = false;
        const visit = (item) => {
            if (visited.has(item.id)) return;
            if (visiting.has(item.id)) {
                Logging.addEntry('WARNING', 'Circular dependency detected involving item:' + item.name + '(ID: ' + item.id + ')');
                cycleDetected = true;
                return;
            }
            visiting.add(item.id);
            const deps = dependencyMap.get(item.id) || new Set();
            deps.forEach(depId => {
                const depItem = rawItems.find(i => i.id === depId);
                if (depItem) visit(depItem);
            });
            visiting.delete(item.id);
            visited.add(item.id);
            const bucket = this._massApplyBucket(item);
            if (bucket && (bucket.reason !== 'current' || bucket.available?.length > 1)) sortedItems.push({item, ...bucket});
        };
        rawItems.forEach(visit);
        if (!sortedItems.length) return genericUtils.notify('CAT.MEDKIT.MassApply.NoUpdates', {type: 'warn'});
        if (cycleDetected) genericUtils.notify('CAT.MEDKIT.MassApply.CycleWarning', {type: 'warn'});
        const choices = await this.#massApplyPrompt(sortedItems);
        if (!choices) return;
        const applying = sortedItems.filter(entry => choices[this.#massApplyID(entry.item)].included);
        const progress = genericUtils.notify('CAT.MEDKIT.MassApply.Started', {progress: true});
        let done = 0;
        for (const entry of applying) {
            const options = choices[this.#massApplyID(entry.item)];
            await automationUtils.updateItem(entry.item, {source: options.source});
            done++;
            progress.update({pct: done / applying.length, message: _loc('CAT.MEDKIT.MassApply.Progress', {done, total: applying.length, name: entry.item.name})});
        }
        progress.update({pct: 1, message: _loc('CAT.MEDKIT.MassApply.Done')});
        this.render();
    }

    #massApplyID(item) { return item.actor ? `${item.actor.id}|${item.id}` : item.id; }

    async #massApplyPrompt(items) {
        const data = {};
        for (const entry of items) {
            let preferred;
            const i = entry.item;
            const subinputs = [];
            const reasonTags = {available: {label: 'CAT.MEDKIT.MassApply.Counts.Available', status: 'available'}, outdated: {label: 'CAT.MEDKIT.MassApply.Counts.Outdated', status: 'outdated'}, current: {label: 'CAT.MEDKIT.MassApply.Counts.UpToDate', status: 'up-to-date'}};
            const reason = {...reasonTags[entry.reason], id: 'reason'};
            const tags = [];
            if (entry.available?.length > 1) {
                preferred = automationUtils.getAutomationSources().find(s => entry.available.some(e => e.source === s));
                tags.push({label: 'CAT.MEDKIT.MassApply.ChooseSource', id: 'choose'});
                subinputs.push(['selectOption', [{
                    label: _loc('CAT.MEDKIT.MassApply.ChooseSource'),
                    name: this.#massApplyID(i) + '.source',
                    options: {
                        currentValue: preferred ?? entry.available[0].source,
                        options: entry.available.map(a => ({
                            label: automationUtils.getSourceName(a.source),
                            value: a.source
                        })),
                        onchange: ({input, getInputById}) => {
                            const tag = getInputById(input.id.split(DialogApp.SUBINPUT_SEPARATOR)[0])?.tags.find(t => t.id === 'source');
                            if (!tag) return;
                            tag.label = automationUtils.getSourceName(input.value);
                            return true;
                        }
                    }
                }]]);
            }
            if (entry.available?.length) tags.unshift({label: automationUtils.getSourceName(preferred ?? entry.available[0].source), id: 'source'});
            if (entry.applied) {
                const version = documentUtils.getVersion(i) ?? '0';
                const label = entry.reason === 'current' ? version : `${version} ⟶ ${entry.applied.version}`;
                tags.push({label, id: 'update', status: reason.status});
            }
            tags.push(reason);
            let collection;
            if (i.actor) {
                data[i.actor.uuid] ??= {name: i.actor.name, inputs: []};
                collection = data[i.actor.uuid].inputs;
            } else {
                data.items ??= {inputs: []};
                collection = data.items.inputs;
            }
            collection.push({
                label: i.name,
                name: this.#massApplyID(i) + '.included',
                options: {
                    tooltip: await uiUtils.enrichHTML(i.system?.description?.value, i.getRollData()),
                    isChecked: entry.reason !== 'current',
                    image: i.img,
                    subinputs,
                    tags
                }
            });
        }
        const inputs = Object.values(data)
            .map(d => (['checkbox', d.inputs, {displayAsRows: true, legend: d.name, requireSelection: true}]))
            .sort((a, b) => {
                if (!a[2].legend) return 1;
                if (!b[2].legend) return -1;
                return a[2].legend.localeCompare(b[2].legend, game.i18n.lang);
            });
        const choices = await DialogApp.dialog('CAT.MEDKIT.MassApply.ConfirmTitle', 'CAT.MEDKIT.MassApply.ConfirmPrompt', inputs, 'yesNo');
        if (!choices || !choices.buttons) return false;
        return choices;
    }

    #openEmbeddedEditor(macro, onSubmit) {
        new EmbeddedMacroEditorApp({macro, onSubmit, titleName: this.#document.name, documentType: this.constructor.DOCUMENT_TYPE}).render(true);
    }

    /** @this {MedkitApp} */
    static #addEmbeddedMacro() {
        this.#openEmbeddedEditor(undefined, flat => {
            const list = (this.#flags.embeddedMacros ??= []);
            if (list.some(entry => entry.name === flat.name)) {
                genericUtils.notify('CAT.MEDKIT.EmbeddedMacros.Duplicate', {type: 'error', format: {name: flat.name}});
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
                genericUtils.notify('CAT.MEDKIT.EmbeddedMacros.Duplicate', {type: 'error', format: {name: flat.name}});
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
    static async #addListEntry(_event, target) {
        const group = target.closest('[data-flag-path]');
        const path = group?.dataset.flagPath;
        const input = group?.querySelector('input[type="text"]');
        const entry = input?.value?.trim();
        if (!path || !entry) return;
        if (group.dataset.validate === 'uuid' && !fromUuidSync(entry)) {
            genericUtils.notify('CAT.MEDKIT.Documents.InvalidUuid', {type: 'error'});
            return;
        }
        const current = foundry.utils.getProperty(this.#flags, path) ?? this.#listValues[path] ?? [];
        if (current.includes(entry)) return;
        foundry.utils.setProperty(this.#flags, path, [...current, entry]);
        this.render();
    }

    /** @this {MedkitApp} */
    static #removeListEntry(_event, target) {
        const group = target.closest('[data-flag-path]');
        const path = group?.dataset.flagPath;
        if (!path) return;
        const current = foundry.utils.getProperty(this.#flags, path) ?? this.#listValues[path] ?? [];
        foundry.utils.setProperty(this.#flags, path, current.filter(v => v !== target.dataset.value));
        this.render();
    }

    bringToFront() {
        uiUtils.bringToFront(this);
    }

    async _onChangeForm(formConfig, event) {
        await super._onChangeForm(formConfig, event);
        const target = event.target;
        const filePicker = target?.closest?.('file-picker');
        const named = filePicker ?? target;
        const name = named?.name ?? named?.getAttribute?.('name');
        if (!name) return;
        const multi = target.closest?.('cat-multi-combobox');
        const inMultiCombobox = !!multi;
        const singleCombobox = !inMultiCombobox && target.matches?.('cat-combobox') ? target : null;
        const isAnimationSelect = !!singleCombobox?.hasAttribute('data-animation-select');
        let value;
        if (filePicker) {
            value = filePicker.value ?? '';
        } else if (inMultiCombobox) {
            const raw = multi.querySelector('input[type="hidden"]')?.value ?? target.value;
            try { value = raw ? JSON.parse(raw) : []; }
            catch { value = []; }
        } else if (singleCombobox) {
            value = singleCombobox.querySelector('input[type="hidden"]')?.value ?? '';
        } else if (target.type === 'checkbox') value = target.checked;
        else if (target.type === 'number') value = Number(target.value);
        else value = target.value;
        if (name === 'system.source.rules') {
            this.#rulesValue = value;
        } else if (name === 'selectedSource' || name === 'heroSourcePick') {
            this.#selectedSource = value;
        } else if (inMultiCombobox && name === 'flags.cat.macros') {
            this._writeMacroSelection(Array.isArray(value) ? value : []);
        } else if (inMultiCombobox && name === 'flags.cat.genericConfig') {
            this._writeGenericSelection(Array.isArray(value) ? value : []);
        } else if (isAnimationSelect) {
            const path = name.slice('flags.cat.'.length);
            const [animSource, animIdentifier] = value ? value.split('|') : [];
            foundry.utils.setProperty(this.#flags, path, animSource ? {source: animSource, identifier: animIdentifier} : '');
        } else if (name.startsWith('flags.cat.')) {
            foundry.utils.setProperty(this.#flags, name.slice('flags.cat.'.length), value);
            if (singleCombobox) { this.render(); return; }
            return;
        } else {
            return;
        }
        this.render();
    }

    #bindDrop(el, handler) {
        if (el.dataset.dropWired === '1') return;
        el.dataset.dropWired = '1';
        el.addEventListener('dragover', e => e.preventDefault());
        el.addEventListener('drop', async event => {
            event.preventDefault();
            const uuid = foundry.applications.ux.TextEditor.implementation.getDragEventData(event)?.uuid;
            if (uuid) await handler(uuid);
        });
    }

    #wireDocumentDrop() {
        for (const el of this.element.querySelectorAll('.documents[data-validate="uuid"]')) {
            this.#bindDrop(el, async uuid => {
                const path = el.dataset.flagPath;
                if (!path) return;
                if (!fromUuidSync(uuid)) return genericUtils.notify('CAT.MEDKIT.Documents.InvalidUuid', {type: 'error'});
                const current = foundry.utils.getProperty(this.#flags, path) ?? [];
                if (current.includes(uuid)) return;
                foundry.utils.setProperty(this.#flags, path, [...current, uuid]);
                this.render();
            });
        }
    }

    #wireFieldDrop() {
        for (const el of this.element.querySelectorAll('cat-combobox[name]')) {
            const match = el.getAttribute('name').match(/^flags\.cat\.(.+)\.(\d+)\.(sourceActorUuid|uuid)$/);
            if (!match) continue;
            const [, listPath, indexStr, field] = match;
            const kind = field === 'sourceActorUuid' ? 'Actor' : 'Item';
            this.#bindDrop(el, async uuid => {
                const doc = await fromUuid(uuid);
                if (!doc) return genericUtils.notify('CAT.MEDKIT.Documents.InvalidUuid', {type: 'error'});
                if (doc.documentName !== kind) return genericUtils.notify('CAT.MEDKIT.Documents.WrongType', {type: 'warn', format: {type: kind}});
                const index = Number(indexStr);
                const list = foundry.utils.getProperty(this.#flags, listPath) ?? [];
                list[index] = kind === 'Actor'
                    ? {...(list[index] ?? {}), sourceActorUuid: uuid, sourceActorName: doc.name, sourceActorImg: doc.img}
                    : {...(list[index] ?? {}), uuid, itemName: doc.name, itemImg: doc.img};
                foundry.utils.setProperty(this.#flags, listPath, list);
                this.render();
            });
        }
    }

    async _prepareAutomationTree() {
        const statusKeys = {
            [constants.automationStatus.AVAILABLE]: constants.MEDKIT_STATUSES.AVAILABLE,
            [constants.automationStatus.OUTDATED]: constants.MEDKIT_STATUSES.OUTDATED,
            [constants.automationStatus.UP_TO_DATE]: constants.MEDKIT_STATUSES.UP_TO_DATE,
            [constants.automationStatus.CONFIGURABLE]: constants.MEDKIT_STATUSES.UP_TO_DATE,
            [constants.automationStatus.GENERIC]: constants.MEDKIT_STATUSES.UP_TO_DATE
        };
        const shape = node => {
            const tags = (node.kinds ?? []).map(kind => _loc('CAT.MEDKIT.Tree.Config.' + kind));
            return {
                uuid: node.uuid,
                name: node.name,
                automated: node.automated,
                statusKey: statusKeys[node.status] ?? '',
                kindLabel: 'CAT.MEDKIT.Tree.Kind.' + node.documentName,
                tags,
                tooltip: node.name
            };
        };
        const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children)]);
        const branches = await automationUtils.getAutomationTree(this.document);
        const rows = [];
        for (const node of branches) {
            const tiles = flatten(node.children).map(shape);
            const kinds = new Set(tiles.map(tile => tile.kindLabel));
            rows.push({...shape(node), tiles, tilesKind: kinds.size === 1 ? tiles[0].kindLabel : null});
        }
        return {rows};
    }

    /** @this {MedkitApp} */
    static async #openMedkit(_event, target) {
        const document = await fromUuid(target.dataset.uuid);
        if (document) contextmenu.openMedkit(document);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.#wireDocumentDrop();
        this.#wireFieldDrop();
        this.#applyTabPermissions();
        if (options.isFirstRender) {
            this.#fitNavToOneRow();
            this.#warnIfLocked();
        }
    }

    #warnIfLocked() {
        const pack = this.#document?.compendium ?? this.#document?.item?.compendium;
        if (pack?.locked) ui.notifications.warn(_loc('CAT.MEDKIT.LockedPack', {pack: pack.metadata.label}));
    }

    #fitNavToOneRow() {
        if (this.constructor.REMEMBER_POSITION && uiUtils.storedWindowPosition(this.options)) return;
        const nav = this.element.querySelector(':scope > nav');
        if (!nav) return;
        const styles = getComputedStyle(nav);
        const tabs = Array.from(nav.children);
        const gaps = parseFloat(styles.columnGap || 0) * Math.max(tabs.length - 1, 0);
        const padding = parseFloat(styles.paddingLeft || 0) + parseFloat(styles.paddingRight || 0);
        const needed = Math.ceil(tabs.reduce((total, tab) => total + tab.offsetWidth, 0) + gaps + padding) + (this.element.offsetWidth - this.element.clientWidth);
        if (needed > this.position.width) this.setPosition({width: needed});
    }

    #applyTabPermissions() {
        if (game.user.isGM) return;
        for (const section of this.element.querySelectorAll('section.tab[data-tab]')) {
            if (MedkitApp.canEditTab(section.dataset.tab)) continue;
            section.querySelectorAll('input, select, textarea, button, multi-select, multi-checkbox, [contenteditable]').forEach(el => {
                el.disabled = true;
                el.setAttribute('contenteditable', 'false');
            });
            const notice = document.createElement('p');
            notice.className = 'notice notification warning';
            notice.textContent = _loc('CAT.MEDKIT.NoPermission');
            section.prepend(notice);
        }
    }
}
