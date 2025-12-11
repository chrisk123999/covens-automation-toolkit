import {Logging} from '../lib.mjs';
import {documentUtils} from '../utils.mjs';
class Automation {
    constructor(source, rules, identifier, uuid, version, {config} = {}) {
        this.source = source;
        this.rules = rules;
        this.identifier = identifier;
        this.version = version;
        this.uuid = uuid;
        this.config = config;
    }
    async getDocument() {
        return await fromUuid(this.uuid);
    }
    getConfigValue(key) {
        return this.config.find(i => i.key === key)?.value;
    }
}
class RegisteredAutomations {
    #automationsSchema;
    #multiautomationsSchema;
    constructor() {
        this.automations = [];
        this.sources = new Set();
        const fields = foundry.data.fields;
        this.#automationsSchema = new fields.SchemaField({
            source: new fields.StringField({required: true, nullable: false}),
            rules: new fields.StringField({required: true, nullable: false}),
            identifier: new fields.StringField({required: true, nullable: false}),
            version: new fields.StringField({required: true, nullable: false}),
            uuid: new fields.StringField({required: true, nullable: false}),
            config: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false})
        });
        this.#multiautomationsSchema = new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}));
    }
    getAutomationByIdentifier(identifier, {rules = 'all', source = 'all', type = 'all', multiple = false} = {}) {
        const predicate = automation => automation.identifier === identifier && (rules === 'all' || automation.rules === rules) && (source === 'all' || automation.source === source) && (type === 'all' || automation.type === type);
        return multiple ? this.automations.filter(predicate) : this.automations.find(predicate);
    }
    getAutomationByName(name, {rules = 'all', source = 'all', type = 'all', multiple = false} = {}) {
        const predicate = automation => automation.name === name && (rules === 'all' || automation.rules === rules) && (source === 'all' || automation.source === source) && (type === 'all' || automation.type === type);
        return multiple ? this.automations.filter(predicate) : this.automations.find(predicate);
    }
    registerAutomation(data) {
        const validationError = this.#automationsSchema.validate(data);
        if (validationError) {
            Logging.addAutomationError(data, validationError.asError());
            return false;
        }
        this.automations.push(new Automation(data.source, data.rules, data.identifier, data.uuid, data.version, {
            config: data.config
        }));
        this.sources.add(data.source);
    }
    registerAutomations(data) {
        const validationError = this.#multiautomationsSchema.validate(data);
        if (validationError) {
            Logging.addAutomationError(data, validationError.asError());
            return false;
        }
        return data.map(i => this.registerAutomation(i));
    }
    getConfigValue(document, key) {
        const value = document.flags.cat?.config?.find(i => i.key === key)?.value;
        if (value) return value;
        const automation = this.getAutomationByIdentifier(documentUtils.getIdentifier(document), {
            rules: documentUtils.getRules(document),
            source: documentUtils.getSource(document)
        });
        return automation?.getConfigValue(key);
    }
    async registerAutomationCompendium(pack, {configs = {}, versions = {}, rules = {}, source} = {}) {
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'flags.cat.automation.version']});
        if (!source) source = pack.metadata.packageName;
        return index.map(document => {
            const identifier = documentUtils.getIdentifier(document);
            const data = {
                source,
                rules: rules[identifier] ?? documentUtils.getRules(document),
                identifier,
                version: versions[identifier] ?? documentUtils.getVersion(document),
                uuid: document.uuid,
                config: configs[identifier]
            };
            return this.registerAutomation(data);
        });
    }
    async registerAutomationModule(id, {ignoredPackIds = [], configs = {}, versions = {}, rules} = {}) {
        const module = game.modules.get(id);
        if (!module?.active) return false;
        const itemPacks = module.packs.filter(pack => pack.type === 'Item' && !ignoredPackIds.includes(pack.id));
        if (!itemPacks.size) return;
        return await Promise.all(itemPacks.map(async data => {
            const pack = game.packs.get(data.id);
            if (!pack) return false;
            return await this.registerAutomationCompendium(pack, {configs, versions, rules, source: id});
        }));
    }
}
export const Automations = {
    Automation,
    RegisteredAutomations
};