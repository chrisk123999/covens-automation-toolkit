import MedkitApp from './base.mjs';
import {constants} from '../../lib/_module.mjs';
import {documentUtils, genericUtils, automationUtils} from '../../utilities/_module.mjs';
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
        macros: {template: 'modules/cat/templates/medkit/item/registered-macros.hbs'}
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

    static KEEP_PATHS = [
        '_stats.compendiumSource',
        'flags.cat.config',
        'flags.ddbimporter',
        'flags.dnd5e.advancementOrigin',
        'flags.dnd5e.cachedFor',
        'flags.dnd5e.sourceId',
        'flags.tidy5e-sheet',
        'folder',
        'name',
        'system.advancement',
        'system.attunement',
        'system.chatFlavor',
        'system.container',
        'system.description.chat',
        'system.description.value',
        'system.equipped',
        'system.materials',
        'system.quantity',
        'system.sourceItem',
        'system.source',
        'system.prepared',
        'system.method',
        'flags.core.sourceId'
    ];

    static async updateDocument(doc, sourceDoc, opts) {
        return ItemMedkit.updateItem(doc, sourceDoc, opts);
    }

    // Apply a registered automation's document data over an existing item, preserving KEEP_PATHS.
    static async updateItem(item, sourceItem, {source, version, rules} = {}) {
        const itemData = item.toObject();
        const sourceItemData = sourceItem.toObject();
        const keepPaths = [...ItemMedkit.KEEP_PATHS];
        if (item.type === 'spell') keepPaths.push('system.uses');
        const cleanPaths = [
            'flags.midi-qol.onUseMacroName',
            'flags.cat.macros'
        ];
        delete itemData.ownership;
        for (const field of keepPaths) {
            const fieldValue = genericUtils.getProperty(itemData, field);
            if (fieldValue) genericUtils.setProperty(sourceItemData, field, fieldValue);
        }
        if (source === 'gambits-premades') genericUtils.setProperty(itemData, 'system.source.custom', sourceItemData.system.source.custom);
        for (const field of cleanPaths) {
            const fieldValue = genericUtils.getProperty(sourceItemData, field);
            if (!fieldValue) continue;
            genericUtils.setProperty(sourceItemData, field, _del);
        }
        if (source) genericUtils.setProperty(sourceItemData, 'flags.cat.automation.source', source);
        if (version) genericUtils.setProperty(sourceItemData, 'flags.cat.automation.version', version);
        if (rules) genericUtils.setProperty(sourceItemData, 'flags.cat.automation.rules', rules);
        const defaultImages = Object.values(CONFIG.DND5E.defaultArtwork.Item);
        if (!defaultImages.includes(itemData.img)) {
            for (const sourceEffect of sourceItemData.effects ?? []) {
                if (sourceEffect.img === sourceItemData.img) sourceEffect.img = itemData.img;
            }
            for (const [key, value] of Object.entries(sourceItemData.system.activities ?? {})) {
                if (value.img === sourceItemData.img) sourceItemData.system.activities[key].img = itemData.img;
            }
            sourceItemData.img = itemData.img;
        }
        if (item.getFlag('dnd5e', 'cachedFor') && item.system.linkedActivity) {
            const enchantId = item.system.linkedActivity.constructor.ENCHANTMENT_ID;
            const enchantEffect = itemData.effects.find(i => i._id === enchantId);
            if (enchantEffect) {
                sourceItemData.effects ??= [];
                sourceItemData.effects.push(enchantEffect);
            }
        }
        if (item.effects.size) await item.deleteEmbeddedDocuments('ActiveEffect', item.effects.map(i => i.id));
        await item.update(sourceItemData, {diff: false, recursive: false});
        // TODO: fix cast activities.
        // TODO: itemMedkit event.
        return item;
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
        const type = this.document.type === 'spell' ? 'character' : this.document.actor?.type ?? 'character';
        const monsterIdentifier = type === 'npc' ? documentUtils.getIdentifier(this.document.actor) : undefined;
        const selectedSource = this._getSelectedSource();
        const rulesValue = this._getRulesValue();
        // Refetch automation using in-memory source so the Configuration tab reacts to source changes.
        const currAutomation = (identifier && rulesValue && selectedSource && selectedSource !== 'none')
            ? constants.automations.getAutomationByIdentifier(identifier, {rules: rulesValue, source: selectedSource, monsterIdentifier})
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

        const macroData = this._prepareRegisteredMacros();
        context.macroRows = macroData.rows;
        context.macroSources = macroData.sources;

        const otherRules = rulesValue === '2014' ? '2024' : '2014';
        context.rules = rulesValue;
        context.otherRulesLabel = _loc(`CAT.MEDKIT.RulesToggle.${otherRules}`);
        context.canToggleRules = this.document.documentName === 'Item' && this.document.system?.source?.rules !== undefined;
        const otherRulesAutomations = identifier ? constants.automations.getAutomationByIdentifier(identifier, {rules: otherRules, multiple: true}) : [];
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
