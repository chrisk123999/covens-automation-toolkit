/** @import {CompendiumCollection} from '@client/documents/collections/_module.mjs' */
import {Logging} from '../lib/_module.mjs';
import {documentUtils} from '../utilities/_module.mjs';
const fields = foundry.data.fields;

/**
 * @typedef {Object} AutomationData
 * @property {string} source
 * @property {'2014'|'2024'} rules
 * @property {string} version
 * @property {string} uuid
 * @property {AutomationConfig[]} config
 * @property {string} [notes]
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
    constructor(source, rules, identifier, uuid, version, {config, notes, monsterIdentifier} = {}) {
        this.source = source;
        this.rules = rules;
        this.identifier = identifier;
        this.version = version;
        this.uuid = uuid;
        this.config = config;
        this.notes = notes;
        this.monsterIdentifier = monsterIdentifier;
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
    
    async getDocument() {
        return await fromUuid(this.uuid);
    }
    getConfigValue(key) {
        return this.config.find(i => i.key === key)?.default;
    }
}
export class RegisteredAutomations {
    #automationsSchema = new fields.SchemaField({
        source: new fields.StringField({required: true, nullable: false}),
        rules: new fields.StringField({required: true, nullable: false}),
        identifier: new fields.StringField({required: true, nullable: false}),
        version: new fields.StringField({required: true, nullable: false}),
        uuid: new fields.StringField({required: true, nullable: false}),
        config: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
        notes: new fields.StringField({required: false, nullable: false}),
        monsterIdentifier: new fields.StringField({required: false, nullable: false})
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
     * @param {string} monsterIdentifier                    Match using a monster identifier as well
     * @returns {Automation[]|Automation|undefined}
     */
    getAutomationByIdentifier(identifier, {rules = 'all', source = 'all', multiple = false, monsterIdentifier} = {}) {
        const predicate = automation => automation.identifier === identifier && (rules === 'all' || automation.rules === rules) && (source === 'all' || automation.source === source) && (!monsterIdentifier || monsterIdentifier === automation.monsterIdentifier);
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
            config: data.config,
            notes: data.notes,
            monsterIdentifier: data.monsterIdentifier
        }));
        this.sources.add(data.source);
        Logging.addEntry('DEBUG', 'Automation Registered: ' + data.identifier + ' from ' + data.source + ' with version ' + data.version);
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
        return automation?.config?.[key]?.default;
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
    async registerAutomationCompendium(pack, {configs2014 = {}, configs2024 = {}, configsAll = {}, versions = {}, rules = {}, source, notes2014 = {}, notes2024 = {}, notesAll = {}} = {}) {
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'flags.cat.automation.version']});
        if (!source) source = pack.metadata.packageName;
        const documentType = pack.metadata.type;
        Logging.addEntry('DEBUG', 'Automation Compendium Registered: ' + pack.metadata.label + ' from ' + pack.metadata.packageName);
        return index.map(document => {
            const identifier = documentUtils.getIdentifier(document, {documentType});
            const rule = rules[identifier] ?? documentUtils.getRules(document, {documentType});
            let config;
            let notes;
            switch (rule) {
                case '2014':
                    config = configs2014[identifier];
                    notes = notes2014[identifier];
                    break;
                case '2024':
                    config = configs2024[identifier];
                    notes = notes2024[identifier];
                    break;
                default:
                    config = configsAll[identifier];
                    notes = notesAll[identifier];
                    break;
            }
            const data = {
                source,
                rules: rule,
                identifier,
                version: versions[identifier] ?? documentUtils.getVersion(document) ?? '0',
                uuid: document.uuid,
                config,
                notes
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
    async registerAutomationModule(id, {ignoredPackIds = [], configs2014 = {}, configs2024 = {}, configsAll = {}, versions = {}, rules = {}, notes2014 = {}, notes2024 = {}, notesAll = {}} = {}) {
        const module = game.modules.get(id);
        if (!module?.active) return false;
        Logging.addEntry('DEBUG', 'Automation Module Registered: ' + module.title);
        const itemPacks = module.packs.filter(pack => pack.type === 'Item' && !ignoredPackIds.includes(pack.id));
        if (!itemPacks.size) return;
        return await Promise.all(itemPacks.map(async data => {
            const pack = game.packs.get(data.id);
            if (!pack) return false;
            return await this.registerAutomationCompendium(pack, {configs2014, configs2024, configsAll, versions, rules, source: id, notes2014, notes2024, notesAll});
        }));
    }

    registerSourceName(id, name) {
        if (!id || !name) return;
        this.sourceNames[id] = name;
    }

    getSourceName(id) {
        return this.sourceNames[id] ?? id;
    }
}
export default {
    Automation,
    RegisteredAutomations
};