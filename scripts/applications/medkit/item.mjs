import MedkitApp from './base.mjs';
import {constants} from '../../lib/_module.mjs';
import {documentUtils, automationUtils} from '../../utilities/_module.mjs';
import DocPropertyEditorApp from '../doc-property-editor.mjs';
const {fields} = foundry.data;

// Item types that expose the Document Properties tab
const DOC_PROP_TYPES = ['feat'];
// Doc-prop flags
const ARRAY_DOC_PROPS = ['alternateFormula', 'rollModifiers'];

function docPropChoices() {
    const D = CONFIG.DND5E ?? {};
    const label = v => (typeof v === 'string' ? v : (v?.label ?? v?.name ?? ''));
    const mapOf = obj => Object.entries(obj ?? {}).reduce((acc, [key, val]) => {
        const text = label(val) || key;
        acc[key] = text.includes('.') ? _loc(text) : text;
        return acc;
    }, {});
    const itemTypes = Object.entries(CONFIG.Item?.typeLabels ?? {}).reduce((acc, [key, val]) => {
        acc[key] = (typeof val === 'string' && val.includes('.')) ? _loc(val) : (val ?? key);
        return acc;
    }, {});
    return {ability: mapOf(D.abilities), type: itemTypes, property: mapOf(D.itemProperties), school: mapOf(D.spellSchools), damageTypes: mapOf(D.damageTypes), level: mapOf(D.spellLevels), method: mapOf(D.spellcasting)};
}

export default class ItemMedkit extends MedkitApp {
    static DOCUMENT_TYPE = 'item';
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-item',
        actions: {
            addDocProp: ItemMedkit.#addDocProp,
            editDocProp: ItemMedkit.#editDocProp,
            removeDocProp: ItemMedkit.#removeDocProp
        }
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        automation: {template: 'modules/cat/templates/medkit/item/automation.hbs'},
        configuration: {template: 'modules/cat/templates/medkit/item/configuration.hbs'},
        generic: {template: 'modules/cat/templates/medkit/item/generic.hbs'},
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        docprops: {template: 'modules/cat/templates/medkit/item/docprops.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'automation', icon: 'fa-solid fa-circle-info', label: 'CAT.MEDKIT.TABS.Automation'},
                {id: 'configuration', icon: 'fa-solid fa-wrench', label: 'CAT.MEDKIT.TABS.Configuration'},
                {id: 'generic', icon: 'fa-solid fa-toolbox', label: 'CAT.MEDKIT.TABS.Generic'},
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'docprops', icon: 'fa-solid fa-sliders', label: 'CAT.MEDKIT.TABS.DocProps'},
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
            ],
            initial: 'automation'
        }
    };

    get #showDocProps() {
        return DOC_PROP_TYPES.includes(this.document.type);
    }

    _prepareTabs(group) {
        const tabs = super._prepareTabs(group);
        if (group === 'sheet' && !this.#showDocProps) delete tabs.docprops;
        return tabs;
    }

    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        if (!this.#showDocProps) delete parts.docprops;
        return parts;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.fields = {
            identifier: new fields.StringField({label: _loc('CAT.MEDKIT.Identifier.Label')}),
            source: new fields.StringField({label: _loc('CAT.MEDKIT.Source.Label'), required: true, blank: false}),
            version: new fields.StringField({label: _loc('CAT.MEDKIT.Version.Label')}),
            ignore: new fields.BooleanField({label: _loc('CAT.MEDKIT.IgnoreItem.Label')}),
            rules: new fields.StringField({
                label: _loc('CAT.MEDKIT.RulesToggle.Current'),
                choices: {'2014': _loc('CAT.MEDKIT.RulesToggle.2014'), '2024': _loc('CAT.MEDKIT.RulesToggle.2024')},
                required: true,
                blank: false
            })
        };
        const identifier = documentUtils.getIdentifier(this.document);
        const actorType = this.document.type === 'spell' ? 'character' : this.document.actor?.type ?? 'character';
        const monsterIdentifier = actorType === 'npc' ? documentUtils.getIdentifier(this.document.actor) : undefined;
        const selectedSource = this._getSelectedSource();
        const rulesValue = this._getRulesValue();
        const itemType = this.document.type;
        // Refetch automation using in-memory source so the Configuration tab reacts to source changes.
        const currAutomation = (identifier && rulesValue && selectedSource && selectedSource !== 'none')
            ? constants.automations.getAutomationByIdentifier(identifier, {rules: rulesValue, source: selectedSource, monsterIdentifier, type: itemType})
            : undefined;
        context.source = selectedSource;
        const availableAutomations = automationUtils.getAvailableAutomations(this.document);
        switch (automationUtils.getAutomationStatus(this.document)) {
            case -2:
                if (context.source !== 'none') {
                    context.medkitStatus = constants.MEDKIT_STATUSES.UNKNOWN;
                    context.statusLabel = 'CAT.MEDKIT.STATUSES.HasUnregistered';
                } else {
                    context.statusLabel = 'CAT.MEDKIT.STATUSES.Unavailable';
                }
                break;
            case -1:
                context.medkitStatus = constants.MEDKIT_STATUSES.AVAILABLE;
                context.statusLabel = 'CAT.MEDKIT.STATUSES.Available';
                break;
            case 0:
                context.medkitStatus = constants.MEDKIT_STATUSES.OUTDATED;
                context.statusLabel = 'CAT.MEDKIT.STATUSES.Outdated';
                break;
            case 1:
                context.medkitStatus = constants.MEDKIT_STATUSES.UP_TO_DATE;
                context.statusLabel = 'CAT.MEDKIT.STATUSES.UpToDate';
                break;
            case 2:
                context.medkitStatus = constants.MEDKIT_STATUSES.CONFIGURABLE;
                context.statusLabel = 'CAT.MEDKIT.STATUSES.Configurable';
                break;
            case 3:
                context.medkitStatus = constants.MEDKIT_STATUSES.CONFIGURABLE;
                context.statusLabel = 'CAT.MEDKIT.STATUSES.Generic';
        }

        // Source label = registry only (constants.automations.sourceNames). Raw id when not registered.
        const labelFor = src => constants.automations.getSourceName?.(src) ?? src;
        const priority = automationUtils.getAutomationSources();
        const availableSet = new Set(availableAutomations.map(a => a.source));
        const orderedSources = [
            ...priority.filter(s => availableSet.has(s)),
            ...[...availableSet].filter(s => !priority.includes(s))
        ];
        const availableSources = {none: _loc('DND5E.None')};
        for (const src of orderedSources) availableSources[src] = labelFor(src);
        if (context.source && context.source !== 'none' && !(context.source in availableSources)) {
            availableSources[context.source] = labelFor(context.source);
        }
        context.availableSources = availableSources;
        context.disableSources = Object.keys(availableSources).length === 1;
        context.version = currAutomation?.version ?? documentUtils.getVersion(this.document);
        if (currAutomation?.notes?.length) context.notes = currAutomation.notes;
        context.ignoreItem = this._getFlags().ignoreItem ?? false;

        const otherRules = rulesValue === '2014' ? '2024' : '2014';
        context.rules = rulesValue;
        context.otherRulesLabel = _loc(`CAT.MEDKIT.RulesToggle.${otherRules}`);
        context.canToggleRules = this.document.documentName === 'Item' && this.document.system?.source?.rules !== undefined;
        const otherRulesAutomations = identifier ? constants.automations.getAutomationByIdentifier(identifier, {rules: otherRules, multiple: true, type: itemType}) : [];
        context.otherRulesAutomationAvailable = !availableAutomations.length && otherRulesAutomations.length > 0;

        context.configurationCategories = this._prepareConfigurationCategories(currAutomation);

        const genericData = this._prepareGenericFeatures();
        context.genericChoices = genericData.choices;
        context.genericSelected = genericData.selected;
        context.genericFeatures = genericData.features;

        context.hero = this._prepareHero({
            availableAutomations,
            sourceLabel: availableSources[context.source] ?? context.source,
            currentVersion: context.version,
            configCount: context.configurationCategories.reduce((n, c) => n + c.options.length, 0),
            genericCount: genericData.selected.length,
            statusLabel: context.statusLabel,
            medkitStatus: context.medkitStatus
        });

        if (this.#showDocProps) this.#prepareDocProps(context);

        return context;
    }

    // Document Properties tab: list the three feat flags, resolving ability labels for the summaries.
    #prepareDocProps(context) {
        const flags = this._getFlags();
        const choices = docPropChoices();
        const labelList = (keys, map) => keys.map(k => map[k] ?? k).join(', ');
        context.alternateFormula = (Array.isArray(flags.alternateFormula) ? flags.alternateFormula : []).map((entry, index) => ({index, value: entry?.value ?? '', identifiers: (entry?.identifiers ?? []).join(', ')}));
        context.alternateAbilities = Object.entries(flags.alternateAbilities ?? {}).map(([identifier, entry]) => ({identifier, summary: labelList(entry?.value ?? [], choices.ability)}));
        context.rollModifiers = (flags.rollModifiers ?? []).map((entry, index) => ({
            index,
            modifiers: (entry.modifiers ?? []).join(', '),
            summary: Object.keys(entry.restrictions ?? {}).join(', ')
        }));
    }

    #openDocPropEditor(type, entry, onSubmit) {
        new DocPropertyEditorApp({type, entry, choices: docPropChoices(), onSubmit, titleName: this.document.name}).render(true);
    }

    /** @this {ItemMedkit} */
    static #addDocProp(_event, target) {
        const type = target.dataset.prop;
        this.#openDocPropEditor(type, undefined, entry => this.#writeDocProp(type, entry, null));
    }

    /** @this {ItemMedkit} */
    static #editDocProp(_event, target) {
        const type = target.dataset.prop;
        const flags = this._getFlags();
        if (ARRAY_DOC_PROPS.includes(type)) {
            const index = Number(target.dataset.index);
            const entry = (foundry.utils.getProperty(flags, type) ?? [])[index];
            if (!entry) return;
            this.#openDocPropEditor(type, entry, next => this.#writeDocProp(type, next, index));
        } else {
            const key = target.dataset.key;
            const stored = foundry.utils.getProperty(flags, type)?.[key];
            if (!stored) return;
            this.#openDocPropEditor(type, {identifier: key, value: stored.value}, next => this.#writeDocProp(type, next, key));
        }
    }

    /** @this {ItemMedkit} */
    static #removeDocProp(_event, target) {
        const type = target.dataset.prop;
        const flags = this._getFlags();
        if (ARRAY_DOC_PROPS.includes(type)) {
            const list = foundry.utils.getProperty(flags, type);
            if (Array.isArray(list)) list.splice(Number(target.dataset.index), 1);
        } else {
            const map = foundry.utils.getProperty(flags, type);
            if (map) delete map[target.dataset.key];
        }
        this.render();
    }

    // Persist a normalized editor entry.
    #writeDocProp(type, entry, original) {
        const flags = this._getFlags();
        if (ARRAY_DOC_PROPS.includes(type)) {
            const existing = foundry.utils.getProperty(flags, type);
            const list = Array.isArray(existing) ? existing : [];
            if (original === null) list.push(entry);
            else list[original] = entry;
            foundry.utils.setProperty(flags, type, list);
            this.render();
            return;
        }
        const map = (foundry.utils.getProperty(flags, type) ?? {});
        const renaming = original !== null && original !== entry.identifier;
        if ((original === null || renaming) && map[entry.identifier]) {
            ui.notifications.error(_loc('CAT.MEDKIT.DocProps.Duplicate', {name: entry.identifier}));
            return false;
        }
        if (renaming) delete map[original];
        map[entry.identifier] = {value: entry.value};
        foundry.utils.setProperty(flags, type, map);
        this.render();
    }
}
