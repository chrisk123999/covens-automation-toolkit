/** @import {CompendiumCollection} from '@client/documents/collections/_module.mjs' */
import {Logging} from '../lib/_module.mjs';
import {documentUtils, genericUtils, itemUtils} from '../utilities/_module.mjs';
const fields = foundry.data.fields;

/**
 * @typedef {Object} AutomationData
 * @property {string} source
 * @property {'2014'|'2024'} rules
 * @property {string} version
 * @property {string} uuid
 * @property {AutomationConfig[]} [config]
 * @property {string} [notes] 
 * @property {string} [sourceType] The key for an advancement source that would grant this document, e.g. 'class:cleric'.
 * @property {object} [scales] Provide advancement scale data.
 * @property {string} [type] Override the document type.
  */

// TODO: More fully document
/**
 * @typedef {Object} AutomationConfig
 * @property {string} key
 * @property {string|boolean|null|number|string[]} default
 * @property {string} label
 * @property {string} type
 * @property {string} [i18nOption]
 * @property {string} [category]
 */

class Automation {
    constructor(source, rules, identifier, uuid, version, {config = {}, notes, monsterIdentifier, scales, type, sourceType} = {}) {
        this.source = source;
        this.rules = rules;
        this.identifier = identifier;
        this.version = version;
        this.uuid = uuid;
        this.config = config;
        this.notes = notes;
        this.monsterIdentifier = monsterIdentifier;
        this.scales = scales;
        this.type = type;
        this.sourceType = sourceType;
    }

    /**
     * @type {string}
     */
    source;

    /**
     * @type {'2014'|'2024'|'all'}
     */
    rules;

    /**
     * @type {string}
     */
    identifier;

    /**
     * @type {string}
     */
    version;

    /**
     * @type {string}
     */
    uuid;

    /**
     * @type {AutomationConfig[]}
     */
    config;

    /**
     * @type {string}
     */
    notes;

    /**
     * @type {string}
     */
    monsterIdentifier;

    /**
     * @type {array}
     */
    scales;

    /**
     * @type {string}
     */
    type;

    /**
     * @type {string}
     */
    sourceType;
    
    async getDocument() {
        return await fromUuid(this.uuid);
    }
    getConfigValue(key) {
        return this.config?.[key]?.default;
    }
}

export class RegisteredAutomations {
    #automationsSchema = new fields.SchemaField({
        source: new fields.StringField({required: true, nullable: false}),
        rules: new fields.StringField({required: true, nullable: false}),
        identifier: new fields.StringField({required: true, nullable: false}),
        version: new fields.StringField({required: true, nullable: false}),
        uuid: new fields.StringField({required: true, nullable: false}),
        config: new fields.ObjectField({required: false, nullable: false}),
        notes: new fields.StringField({required: false, nullable: false}),
        monsterIdentifier: new fields.StringField({required: false, nullable: false}),
        scales: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
        type: new fields.StringField({required: false, nullable: false}),
        sourceType: new fields.StringField({required: false, nullable: false})
    });
    #multiAutomationsSchema = new fields.ArrayField(this.#automationsSchema);

    /**
     * @type {Map<string, Automation>}
     */
    automations = new Map();

    /**
     * @type {Set<string>}
     */
    sources = new Set();

    /**
     * @type {Object}
     */
    sourceNames = {};

    /**
     * Get the registered Automation (or Automations), if any, by identifier & other criteria
     * @param {string} identifier                           The identifier of the automation
     * @param {object} [options={}]                         Additional options
     * @param {'all'|'2014'|'2024'} [options.rules='all']   The ruleset of the automation
     * @param {string} [options.source='all']               The source of the automation
     * @param {boolean} [options.multiple=false]            Whether to return all matching automations or only one
     * @param {string} [options.monsterIdentifier]          Match using a monster identifier as well
     * @param {string} [options.type]                       The item type to get automation(s) for
     * @param {string} [options.sourceType]                 A key representing the advancement source for the item, if any, e.g. 'class:cleric'
     * @param {string[]} [options.excludeSources]           Which sources to exclude from consideration, if any
     * @returns {Automation[]|Automation|undefined}
     */
    getAutomationByIdentifier(identifier, {rules = 'all', source = 'all', multiple = false, monsterIdentifier, type, sourceType, excludeSources = []} = {}) {
        const predicate = automation => {
            if (automation.identifier !== identifier) return false;
            if (rules !== 'all' && automation.rules !== 'all' && automation.rules !== rules) return false;
            if (source !== 'all' && automation.source !== source) return false;
            if (excludeSources.includes(automation.source)) return false;
            if (monsterIdentifier && monsterIdentifier !== automation.monsterIdentifier) return false;
            if (type && type !== automation.type) return false;
            if (automation.sourceType && automation.sourceType !== sourceType) return false;
            return true;
        };
        if (multiple) {
            const results = [];
            for (const automation of this.automations.values()) {
                if (predicate(automation)) results.push(automation);
            }
            return results;
        }
        for (const automation of this.automations.values()) {
            if (predicate(automation)) return automation;
        }
    }

    /**
     * Register a single automation
     * @param {AutomationData} data 
     */
    registerAutomation(data) {
        const validationError = this.#automationsSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'automation', validationError.asError());
            return false;
        }
        const automation = new Automation(data.source, data.rules, data.identifier, data.uuid, data.version, {
            config: data.config,
            notes: data.notes,
            monsterIdentifier: data.monsterIdentifier,
            scales: data.scales,
            type: data.type,
            sourceType: data.sourceType
        });
        this.automations.set(data.uuid, automation);
        this.sources.add(data.source);
        Logging.addEntry('DEBUG', 'Automation Registered: ' + data.identifier + ' from ' + data.source + ' with version ' + data.version);
        return true;
    }

    /**
     * Register multiple automations
     * @param {AutomationData[]} data 
     */
    registerAutomations(data) {
        const validationError = this.#multiAutomationsSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'automation', validationError.asError());
            return false;
        }
        return data.map(i => this.registerAutomation(i));
    }

    /**
     * Get the value of a config key for a given document
     * @param {foundry.abstract.Document} document 
     * @param {string} key 
     */
    getConfigValue(document, key) {
        /** @type {AutomationConfig['default']|undefined} */
        const value = document.flags.cat?.config?.[key];
        if (value != undefined) return value;
        /** @type {Automation|undefined} */
        const automation = this.getAutomationByIdentifier(documentUtils.getIdentifier(document), {
            rules: documentUtils.getRules(document),
            source: documentUtils.getSource(document),
            sourceType: itemUtils.getAdvancementSourceKey(document)
        });
        return automation?.config?.[key]?.default;
    }

    /**
     * @callback FetchAutomationInfo
     * @param {foundry.abstract.Document} document
     * @param {AutomationData} defaults Not mutable, return changes from your callback instead.
     * @returns {AutomationData}
     */

    /**
     * Register a compendium pack of documents with automations
     * @param {CompendiumCollection} pack                         The compendium pack of documents to register as automations
     * @param {object} [options={}]                               Additional options
     * @param {string} [options.source]                           The source id for the automations
     * @param {FetchAutomationInfo} [options.infoFetcherCallback] Provide additional automation info or override defaults. See {@link FetchAutomationInfo}.
     */
    async registerAutomationCompendium(pack, {source = pack.metadata.packageName, infoFetcherCallback} = {}) {
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'flags.cat.automation', 'type']});
        const documentType = pack.metadata.type;
        Logging.group('Automation Compendium Registered: ' + pack.metadata.label + ' (' + pack.metadata.packageName + ')');
        const results = index.map(document => {
            const identifier = documentUtils.getIdentifier(document, {documentType});
            const defaults = {
                rules: documentUtils.getRules(document, {documentType}),
                sourceType: itemUtils.getAdvancementSourceKey(document),
                version: documentUtils.getVersion(document) || '0',
                uuid: document.uuid,
                type: document.type,
                identifier,
                source
            };
            const data = genericUtils.mergeObject(defaults, infoFetcherCallback(document, genericUtils.duplicate(defaults)));
            return this.registerAutomation(data);
        });
        Logging.groupEnd();
        return results;
    }

    /**
     * Register multiple compendium packs of documents with automations, with those packs being provided by the given module ID
     * @param {string} id                                         The id of the module to register the compendium packs of
     * @param {object} [options={}]                               Additional options
     * @param {string[]} [options.ignoredPackIds=[]]              A list of compendium pack IDs to ignore and not register
     * @param {FetchAutomationInfo} [options.infoFetcherCallback] Provide additional automation info or override defaults. See {@link FetchAutomationInfo}.
     */
    async registerAutomationModule(id, {ignoredPackIds = [], infoFetcherCallback} = {}) {
        const module = game.modules.get(id);
        if (!module?.active) return false;
        Logging.group('Automation Module Registered: ' + module.title);
        const itemPacks = module.packs.filter(pack => pack.type === 'Item' && !ignoredPackIds.includes(pack.id));
        if (!itemPacks.size) return;
        const results = await Promise.all(itemPacks.map(async data => {
            const pack = game.packs.get(data.id);
            if (!pack) return false;
            return await this.registerAutomationCompendium(pack, {source: id, infoFetcherCallback});
        }));
        Logging.groupEnd();
        return results;
    }
    registerSourceName(id, name) {
        if (!id || !name) return;
        this.sourceNames[id] = name;
    }
    getSourceName(id) {
        return this.sourceNames[id] ?? id;
    }
    unregisterAutomationsBySource(source) {
        const initialSize = this.automations.size;
        for (const [uuid, automation] of this.automations.entries()) {
            if (automation.source === source) this.automations.delete(uuid);
        }
        if (this.automations.size !== initialSize) {
            this.sources.delete(source);
            Logging.addEntry('DEBUG', 'Unregistered all automations from source: ' + source);
        }
    }
    unregisterAutomation(source, identifier, rules) {
        const initialSize = this.automations.size;
        for (const [uuid, automation] of this.automations.entries()) {
            if (automation.source === source && automation.identifier === identifier && automation.rules === rules) {
                this.automations.delete(uuid);
            }
        }
        if (this.automations.size !== initialSize) {
            Logging.addEntry('DEBUG', 'Unregistered automation: ' + identifier + ' from ' + source + ' (' + rules + ')');
        }
    }
    unregisterUuid(uuid) {
        if (this.automations.delete(uuid)) {
            Logging.addEntry('DEBUG', 'Unregistered automation with uuid: ' + uuid);
        }
    }
}
export default {
    Automation,
    RegisteredAutomations
};