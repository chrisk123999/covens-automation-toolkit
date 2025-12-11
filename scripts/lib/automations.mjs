/** @import {CompendiumCollection} from '@client/documents/collections/_module.mjs' */
import {Logging} from '../lib.mjs';
import {documentUtils} from '../utils.mjs';
const fields = foundry.data.fields;

/**
 * @typedef {Object} AutomationData
 * @property {string} source
 * @property {'2014'|'2024'} rules
 * @property {string} version
 * @property {string} uuid
 * @property {AutomationConfig[]} config
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
    constructor(source, rules, identifier, uuid, version, {config} = {}) {
        this.source = source;
        this.rules = rules;
        this.identifier = identifier;
        this.version = version;
        this.uuid = uuid;
        this.config = config;
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
    
    async getDocument() {
        return await fromUuid(this.uuid);
    }
    getConfigValue(key) {
        return this.config.find(i => i.key === key)?.default;
    }
}
class RegisteredAutomations {
    #automationsSchema = new fields.SchemaField({
        source: new fields.StringField({required: true, nullable: false}),
        rules: new fields.StringField({required: true, nullable: false}),
        identifier: new fields.StringField({required: true, nullable: false}),
        version: new fields.StringField({required: true, nullable: false}),
        uuid: new fields.StringField({required: true, nullable: false}),
        config: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false})
    });
    #multiAutomationsSchema = new fields.ArrayField(this.#automationsSchema);

    /**
     * @type {Automation[]}
     */
    automations = [];

    /**
     * @type {Set<string>}
     */
    sources = new Set();

    /**
     * Get the registered Automation (or Automations), if any, by identifier & other criteria
     * @param {string} identifier                           The identifier of the automation
     * @param {object} [options={}]                         Additional options
     * @param {'all'|'2014'|'2024'} [options.rules='all']   The ruleset of the automation
     * @param {string} [options.source='all']               The source of the automation
     * @param {boolean} [options.multiple=false]            Whether to return all matching automations or only one
     * @returns {Automation[]|Automation|undefined}
     */
    getAutomationByIdentifier(identifier, {rules = 'all', source = 'all', type = 'all', multiple = false} = {}) {
        const predicate = automation => automation.identifier === identifier && (rules === 'all' || automation.rules === rules) && (source === 'all' || automation.source === source) && (type === 'all' || automation.type === type);
        return multiple ? this.automations.filter(predicate) : this.automations.find(predicate);
    }

    /**
     * Get the registered Automation (or Automations), if any, by name & other criteria
     * @param {string} name                                 The name of the automation
     * @param {object} [options={}]                         Additional options
     * @param {'all'|'2014'|'2024'} [options.rules='all']   The ruleset of the automation
     * @param {string} [options.source='all']               The source of the automation
     * @param {boolean} [options.multiple=false]            Whether to return all matching automations or only one
     * @returns {Automation[]|Automation|undefined}
     */
    getAutomationByName(name, {rules = 'all', source = 'all', type = 'all', multiple = false} = {}) {
        const predicate = automation => automation.name === name && (rules === 'all' || automation.rules === rules) && (source === 'all' || automation.source === source) && (type === 'all' || automation.type === type);
        return multiple ? this.automations.filter(predicate) : this.automations.find(predicate);
    }

    /**
     * Register a single automation
     * @param {AutomationData} data 
     */
    registerAutomation(data) {
        const validationError = this.#automationsSchema.validate(data);
        if (validationError) {
            Logging.addAutomationError(data, validationError);
            return false;
        }
        this.automations.push(new Automation(data.source, data.rules, data.identifier, data.uuid, data.version, {
            config: data.config
        }));
        this.sources.add(data.source);
    }

    /**
     * Register multiple automations
     * @param {AutomationData[]} data 
     */
    registerAutomations(data) {
        const validationError = this.#multiAutomationsSchema.validate(data);
        if (validationError) {
            Logging.addAutomationError(data, validationError);
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
        if (value) return value;
        /** @type {Automation|undefined} */
        const automation = this.getAutomationByIdentifier(documentUtils.getIdentifier(document), {
            rules: documentUtils.getRules(document),
            source: documentUtils.getSource(document)
        });
        return automation?.getConfigValue(key);
    }

    /**
     * Register a compendium pack of documents with automations
     * @param {CompendiumCollection} pack                                   The compendium pack of documents to register as automations
     * @param {object} [options={}]                                         Additional options
     * @param {Record<string, AutomationConfig[]>} [options.configs2014={}] An object with identifiers as keys and configs as values
     * @param {Record<string, AutomationConfig[]>} [options.configs2024={}] An object with identifiers as keys and configs as values
     * @param {Record<string, AutomationConfig[]>} [options.configsAll={}]  An object with identifiers as keys and configs as values
     * @param {Record<string, string>} [options.versions={}]                An object with identifiers as keys and versions as values
     * @param {Record<string, string>} [options.rules={}]                   An object with identifiers as keys and rulesets as values
     * @param {string} [options.source]                                     The source of the automations
     */
    async registerAutomationCompendium(pack, {configs2014 = {}, configs2024 = {}, configsAll = {}, versions = {}, rules = {}, source} = {}) {
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'flags.cat.automation.version']});
        if (!source) source = pack.metadata.packageName;
        return index.map(document => {
            const identifier = documentUtils.getIdentifier(document);
            const rule = rules[identifier] ?? documentUtils.getRules(document);
            let config;
            switch (rule) {
                case '2014': config = configs2014[identifier]; break;
                case '2024': config = configs2024[identifier]; break;
                default: config = configsAll[identifier]; break;
            }
            const data = {
                source,
                rules: rule,
                identifier,
                version: versions[identifier] ?? documentUtils.getVersion(document),
                uuid: document.uuid,
                config
            };
            return this.registerAutomation(data);
        });
    }

    /**
     * Register multiple compendium packs of documents with automations, with those packs being provided by the given module ID
     * @param {string} id                                                   The id of the module to register the compendium packs of
     * @param {object} [options={}]                                         Additional options
     * @param {string[]} [options.ignoredPackIds=[]]                        A list of compendium pack IDs to ignore and not register
     * @param {Record<string, AutomationConfig[]>} [options.configs2014={}] An object with identifiers as keys and configs as values
     * @param {Record<string, AutomationConfig[]>} [options.configs2024={}] An object with identifiers as keys and configs as values
     * @param {Record<string, AutomationConfig[]>} [options.configsAll={}]  An object with identifiers as keys and configs as values
     * @param {Record<string, string>} [options.versions={}]                An object with identifiers as keys and versions as values
     * @param {Record<string, string>} [options.rules={}]                   An object with identifiers as keys and rulesets as values
     */
    async registerAutomationModule(id, {ignoredPackIds = [], configs2014 = {}, configs2024 = {}, configsAll = {}, versions = {}, rules = {}} = {}) {
        const module = game.modules.get(id);
        if (!module?.active) return false;
        const itemPacks = module.packs.filter(pack => pack.type === 'Item' && !ignoredPackIds.includes(pack.id));
        if (!itemPacks.size) return;
        return await Promise.all(itemPacks.map(async data => {
            const pack = game.packs.get(data.id);
            if (!pack) return false;
            return await this.registerAutomationCompendium(pack, {configs2014, configs2024, configsAll, versions, rules, source: id});
        }));
    }
}
export const Automations = {
    Automation,
    RegisteredAutomations
};