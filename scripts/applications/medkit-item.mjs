import {constants} from '../lib/_module.mjs';

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
export default class ItemMedkit extends HandlebarsApplicationMixin(ApplicationV2) {
    #document;
    constructor({document, ...options}) {
        super({...options});
        this.#document = document;
    }
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-item',
        window: {
            icon: 'fa-solid fa-kit-medical',
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
        // TODO:
        // Header:
        // label
        context.label = 'Example Label';
        // statusLabel
        context.statusLabel = 'Example Status';
        // medkitColor
        context.medkitStatus = constants.MEDKIT_STATUSES.CONFIGURABLE;

        // Automation tab:
        // automation version
        // automation notes
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

    /** @this {ItemMedkit} */
    static async #update(event, target) {
        // TODO
    }

    /** @this {ItemMedkit} */
    static async #apply(event, target) {
        // TODO
    }

    /** @this {ItemMedkit} */
    static async #confirm(event, target) {
        // TODO
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