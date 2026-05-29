import MedkitApp from './base.mjs';
import {constants} from '../../lib/_module.mjs';
import {documentUtils, automationUtils} from '../../utilities/_module.mjs';
const {fields} = foundry.data;

export default class ItemMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-item'
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        automation: {template: 'modules/cat/templates/medkit/item/automation.hbs'},
        configuration: {template: 'modules/cat/templates/medkit/item/configuration.hbs'},
        generic: {template: 'modules/cat/templates/medkit/item/generic.hbs'},
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'automation', icon: 'fa-solid fa-circle-info', label: 'CAT.MEDKIT.TABS.Automation'},
                {id: 'configuration', icon: 'fa-solid fa-wrench', label: 'CAT.MEDKIT.TABS.Configuration'},
                {id: 'generic', icon: 'fa-solid fa-toolbox', label: 'CAT.MEDKIT.TABS.Generic'},
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
            ],
            initial: 'automation'
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.fields = {
            // TODO - is this field needed? Writes to flags.cat.nameOverride but Items match by system.identifier, not name.
            name: new fields.StringField({label: _loc('CAT.MEDKIT.Name.Label')}),
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
        context.nameOverride = this._getFlags().nameOverride ?? '';

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

        const isKnown = constants.automations.sources.has(context.source);
        const statusSuffix = context.source === 'chris-premades' ? 'CPR' : 'OTHER';
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
                context.medkitStatus = constants.MEDKIT_STATUSES[`OUTDATED_${statusSuffix}`];
                context.statusLabel = 'CAT.MEDKIT.STATUSES.Outdated';
                break;
            case 1:
                context.medkitStatus = constants.MEDKIT_STATUSES[isKnown ? `UP_TO_DATE_${statusSuffix}` : 'UNKNOWN'];
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

        return context;
    }
}
