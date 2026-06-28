import MedkitApp from './base.mjs';
import {constants} from '../../lib/_module.mjs';
import {documentUtils, automationUtils} from '../../utilities/_module.mjs';
import DocPropertyEditorApp from '../doc-property-editor.mjs';
const {fields} = foundry.data;

export default class ItemMedkit extends MedkitApp {
    static DOCUMENT_TYPE = 'item';
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-item',
        actions: {
            addDocProp: ItemMedkit.#addDocProp,
            editDocProp: ItemMedkit.#editDocProp,
            removeDocProp: ItemMedkit.#removeDocProp,
            addClassBonus: ItemMedkit.#addClassBonus,
            removeClassBonus: ItemMedkit.#removeClassBonus
        }
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        automation: {template: 'modules/cat/templates/medkit/item/automation.hbs'},
        configuration: {template: 'modules/cat/templates/medkit/item/configuration.hbs'},
        generic: {template: 'modules/cat/templates/medkit/shared/generic.hbs'},
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
        const allowed = constants.alternateAttributes.DamageFormula.allowedFlagHolders;
        return !allowed?.length || allowed.includes(this.document.type);
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

    #prepareDocProps(context) {
        const attributes = Object.entries(constants.alternateAttributes);
        context.docPropHint = _loc('CAT.MEDKIT.DocProps.Hint', {list: attributes.map(a => _loc(`CAT.MEDKIT.DocProps.Props.${a[0]}.Label`)).join(', ')});
        const flags = this._getFlags();
        context.alternateAttributes = [];
        const valueSummary = (attr, values) => {
            if (!Array.isArray(values)) return values;
            const choices = attr.element.choices;
            const options = typeof choices === 'function' ? choices() : choices;
            if (!options) return values.join(', ');
            return values.map(v => options[v]).join(', ');
        };
        for (const [type, attributeConfig] of attributes) {
            if (!attributeConfig.allowedFlagHolders.includes(this.document.type)) continue;
            context.alternateAttributes.push({
                type,
                label: _loc(`CAT.MEDKIT.DocProps.Props.${type}.Label`),
                attributes: (flags.alternateAttributes[type] ?? []).map((attr, index) => ({
                    index, 
                    valueSummary: valueSummary(attributeConfig.schema.fields.value, attr.value),
                    restrictionSummary: Object.entries(attr.restrictions).filter(r => !!r[1]).map(r => _loc(`CAT.MEDKIT.DocProps.Restrictions.${r[0]}.Label`)).join(', ')
                }))
            });
        }
        context.classBonuses = this.#prepareClassBonuses();
    }

    #prepareClassBonuses() {
        const flags = this._getFlags();
        const dcMap = flags.classDifficultyClass ?? {};
        const attackMap = flags.classAttackBonus ?? {};
        const ids = new Set([...Object.keys(dcMap), ...Object.keys(attackMap)]);
        const rows = [...ids].map(id => ({
            identifier: id,
            dc: dcMap[id]?.value ?? 0,
            attack: attackMap[id]?.value ?? 0
        })).sort((a, b) => a.identifier.localeCompare(b.identifier, 'en', {sensitivity: 'base'}));
        return {rows};
    }

    /** @this {ItemMedkit} */
    static #addClassBonus(_event, target) {
        const input = target.closest('[data-class-bonus-add]')?.querySelector('input');
        const id = input?.value?.trim();
        if (!id) return;
        const flags = this._getFlags();
        const dcMap = (flags.classDifficultyClass ??= {});
        const attackMap = (flags.classAttackBonus ??= {});
        if (dcMap[id] || attackMap[id]) {
            ui.notifications.error(_loc('CAT.MEDKIT.ClassBonus.Duplicate', {identifier: id}));
            return;
        }
        dcMap[id] = {value: 0};
        attackMap[id] = {value: 0};
        this.render();
    }

    /** @this {ItemMedkit} */
    static #removeClassBonus(_event, target) {
        const id = target.dataset.key;
        const flags = this._getFlags();
        delete flags.classDifficultyClass?.[id];
        delete flags.classAttackBonus?.[id];
        if (flags.classDifficultyClass && !Object.keys(flags.classDifficultyClass).length) delete flags.classDifficultyClass;
        if (flags.classAttackBonus && !Object.keys(flags.classAttackBonus).length) delete flags.classAttackBonus;
        this.render();
    }

    #openDocPropEditor(type, entry, onSubmit) {
        new DocPropertyEditorApp({type, entry, onSubmit, titleName: this.document.name}).render(true);
    }

    /** @this {ItemMedkit} */
    static #addDocProp(_event, target) {
        const type = target.dataset.prop;
        this.#openDocPropEditor(type, undefined, entry => this.#writeDocProp(type, entry, null));
    }

    /** @this {ItemMedkit} */
    static #editDocProp(_event, target) {
        const type = target.dataset.prop;
        const index = Number(target.dataset.index);
        const entry = (this._getFlags().alternateAttributes?.[type] ?? [])[index];
        if (!entry) return;
        this.#openDocPropEditor(type, entry, next => this.#writeDocProp(type, next, index));
    }

    /** @this {ItemMedkit} */
    static #removeDocProp(_event, target) {
        const flags = this._getFlags();
        const type = target.dataset.prop;
        const list = flags.alternateAttributes?.[type];
        if (Array.isArray(list)) {
            list.splice(Number(target.dataset.index), 1);
            if (!list.length) delete flags.alternateAttributes[type];
        }
        this.render();
    }

    #writeDocProp(type, entry, original) {
        const attribute = constants.alternateAttributes[type];
        if (!attribute) {
            ui.notifications.error(_loc('CAT.MEDKIT.DocProps.NotDefined', {type}));
            return false;
        }
        const {cleaned, valid, failure} = attribute.validate(this.document, entry);
        if (!valid) {
            ui.notifications.error(failure.toString());
            return false;
        }
        const flags = this._getFlags();
        flags.alternateAttributes ??= {};
        flags.alternateAttributes[type] ??= [];
        if (original === null) flags.alternateAttributes[type].push(cleaned);
        else flags.alternateAttributes[type][original] = cleaned;
        this.render();
    }
}
