import {constants} from '../lib/_module.mjs';
import {documentUtils, genericUtils} from '../utilities/_module.mjs';
const {fields} = foundry.data;

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
export default class ItemMedkit extends HandlebarsApplicationMixin(ApplicationV2) {
    #document;
    #selectedSource;
    constructor({document, ...options}) {
        super({...options});
        this.#document = document;
        this.#selectedSource = documentUtils.getSource(document) ?? 'none';
    }
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-item',
        window: {
            icon: 'fa-solid fa-cat',
            resizable: true,
            contentClasses: ['standard-form']
        },
        position: {
            width: 550
        },
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            update: ItemMedkit.#update,
            apply: ItemMedkit.#apply,
            confirm: ItemMedkit.#confirm,
            changeRules: ItemMedkit.#changeRules,
            openEmbeddedMacros: ItemMedkit.#openEmbeddedMacros,
            addDocument: ItemMedkit.#addDocument,
            removeDocument: ItemMedkit.#removeDocument
        }
    };

    static PARTS = {
        header: {
            template: 'modules/cat/templates/medkit-header.hbs'
        },
        tabs: {
            template: 'templates/generic/tab-navigation.hbs'
        },
        automation: {
            template: 'modules/cat/templates/medkit-item/automation.hbs'
        },
        configuration: {
            template: 'modules/cat/templates/medkit-item/configuration.hbs'
        },
        generic: {
            template: 'modules/cat/templates/medkit-item/generic.hbs'
        },
        embedded: {
            template: 'modules/cat/templates/medkit-embedded-macros.hbs'
        },
        // TODO: document properties?
        macros: {
            template: 'modules/cat/templates/medkit-item/registered-macros.hbs'
        },
        footer: {
            template: 'templates/generic/form-footer.hbs'
        }
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'automation', icon: 'fa-hammer', label: 'CAT.MEDKIT.TABS.Automation'},
                {id: 'configuration', icon: 'fa-wrench', label: 'CAT.MEDKIT.TABS.Configuration'},
                {id: 'generic', icon: 'fa-toolbox', label: 'CAT.MEDKIT.TABS.Generic'},
                {id: 'embedded', icon: 'fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'macros', icon: 'fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
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

    get title() {
        return _loc('CAT.MEDKIT.Title', {name: this.document.name});
    }

    get document() {
        return this.#document;
    }

    async _preparePartContext(partId, context) {
        const partContext = await super._preparePartContext(partId, context);
        if (partId in partContext.tabs) partContext.tab = partContext.tabs[partId];
        return partContext;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.document = this.document;
        const currAutomation = documentUtils.getCurrentAutomation(this.document);
        context.source = currAutomation?.source ?? documentUtils.getSource(this.document) ?? 'none';
        const availableAutomations = documentUtils.getAvailableAutomations(this.document);
        // TODO:
        // Header:
        // label
        context.label = 'Example Label';
        // statusLabel
        context.statusLabel = 'Example Status';
        // medkitColor
        const knownSources = [
            'chris-premades',
            'gambits-premades',
            'midi-item-showcase-community',
            'automated-crafted-creations'
        ];
        if (this.document.flags.cat?.config?.generic) context.medkitStatus = constants.MEDKIT_STATUSES.CONFIGURABLE;
        else if (currAutomation) {
            const statusSuffix = context.source === 'chris-premades' ? 'CPR' : 'OTHER';
            if (foundry.utils.isNewerVersion(currAutomation.version, documentUtils.getVersion(this.document))) {
                context.medkitStatus = constants.MEDKIT_STATUSES[`OUTDATED_${statusSuffix}`];
            } else if (currAutomation.config) {
                context.medkitStatus = constants.MEDKIT_STATUSES.CONFIGURABLE;
            } else if (knownSources.includes(context.source)) {
                context.medkitStatus = constants.MEDKIT_STATUSES[`UP_TO_DATE_${statusSuffix}`];
            } else {
                context.medkitStatus = constants.MEDKIT_STATUSES.UNKNOWN;
            }
        } else if (availableAutomations.length) {
            context.medkitStatus = constants.MEDKIT_STATUSES.AVAILABLE;
        } else if (!knownSources.includes(context.source) && context.source !== 'none') {
            context.medkitStatus = constants.MEDKIT_STATUSES.UNKNOWN;
        }
        
        // Automation tab:
        const availableSources = availableAutomations.map(a => a.source).reduce((acc, source) => {
            if (source in acc) return acc;
            const localizationKey = `CAT.MEDKIT.SOURCES.${source}`;
            acc[source] = foundry.utils.hasProperty(game.i18n.translations, localizationKey) ? _loc(localizationKey) : source;
            return acc;
        }, {none: _loc('DND5E.None')});
        if (context.source && !(context.source in availableSources)) availableSources[context.source] = context.source;
        context.availableSources = availableSources;
        context.sourceField = new fields.StringField({required: true, blank: false, nullable: false});
        context.version = currAutomation?.version ?? documentUtils.getVersion(this.document);
        // automation notes
        if (currAutomation?.notes?.length) context.notes = currAutomation.notes;
        // ignore toggle for actor mass update
        
        // Configuration tab:
        // config stuff
        
        // Generic Automations tab:
        // generic stuff

        // Document Properties tab: Whatever this means

        // Registered Macros tab:
        // source
        // events
        // passes
        context.buttons = [
            {type: 'button', action: 'apply', label: 'DND5E.Apply', name: 'apply', icon: 'fa-solid fa-download'},
            {type: 'button', action: 'confirm', label: 'DND5E.Confirm', name: 'confirm', icon: 'fa-solid fa-check'}
        ];
        return context;
    }

    _onChangeForm(formConfig, event) {
        super._onChangeForm(formConfig, event);
        if (event.target.name === 'selectedSource') {
            this.#selectedSource = event.target.value;
        }
    }

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
        // TODO: fix cast activities?
        // TODO: itemMedkit event?
        return item;
    }

    /** @this {ItemMedkit} */
    static async #update(event, target) {
        // TODO
    }

    /** @this {ItemMedkit} */
    static async #apply(event, target) {
        // TODO: notes of things we do in CPR which hopefully we can clean up
        // CPR store active tab
        // CPR merge embedded macros to flags
        // CPR clean flags
        // CPR fix up generic flags
        // CPR clobber flags
        const currSource = documentUtils.getSource(this.document) ?? 'none';
        if (currSource !== this.#selectedSource) {
            if (this.#selectedSource === 'none') {
                const updateData = await fromUuid(this.document._stats.compendiumSource) ?? {};
                genericUtils.setProperty(updateData, 'flags.cat', _del);
                await this.document.update(updateData, {diff: false});
            } else {
                // TODO: consider development source?
                const selectedAutomation = documentUtils.getAvailableAutomations(this.document).find(a => a.source === this.#selectedSource);
                if (selectedAutomation) {
                    const selectedDocument = await fromUuid(selectedAutomation.uuid);
                    await ItemMedkit.updateItem(this.document, selectedDocument, selectedAutomation);
                }
            }
        }
        this.render();
    }

    /** @this {ItemMedkit} */
    static async #confirm(event, target) {
        await ItemMedkit.#apply.call(this, event, target);
        this.close();
    }

    /** @this {ItemMedkit} */
    static async #changeRules(event, target) {
        // TODO
    }

    /** @this {ItemMedkit} */
    static async #openEmbeddedMacros(event, target) {
        // TODO
    }

    /** @this {ItemMedkit} */
    static async #addDocument(event, target) {
        // TODO
    }

    /** @this {ItemMedkit} */
    static async #removeDocument(event, target) {
        // TODO
    }
}