/** @import {CompendiumCollection} from '@client/documents/collections/_module.mjs' */
import {Logging} from './_module.mjs';
import {automationUtils, documentUtils} from '../utilities/_module.mjs';
const fields = foundry.data.fields;
export class Source {
    constructor(source, rules, identifier, uuid) {
        this.source = source;
        this.rules = rules;
        this.identifier = identifier;
        this.uuid = uuid;
    }
    
    /**
     * @type {string}
     */
    source;

    /**
     * @type {string}
     */
    rules;

    /**
     * @type {string}
     */
    identifier;

    /**
     * @type {string}
     */
    uuid;

    async getDocument() {
        return await fromUuid(this.uuid);
    }
}

export class SourceManager {
    constructor (type) {
        this.type = type;
    }
    #sourceSchema = new fields.SchemaField({
        source: new fields.StringField({required: true, nullable: false}),
        rules: new fields.StringField({required: true, nullable: false}),
        identifier: new fields.StringField({required: true, nullable: false}),
        uuid: new fields.StringField({required: true, nullable: false})
    });
    #multiSourceSchema = new fields.ArrayField(this.#sourceSchema);
    sourceData = [];
    sources = new Set();
    sourceNames = {};
    async getSourceByIdentifier(identifier) {
        const sources = automationUtils.getSourceDataSources(this.type);
        let match;
        sources.find(source => match = this.sourceData.find(data => data.identifier === identifier && data.source === source));
        return await match?.getDocument();
    }

    registerSource(data) {
        const validationError = this.#sourceSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'source', validationError);
            return false;
        }
        this.sourceData.push(new Source(data.source, data.rules, data.identifier, data.uuid));
        this.sources.add(data.source);
        Logging.addEntry('DEBUG', this.type +  ' Registered: ' + data.identifier + ' from ' + data.source + ' with version ' + data.version);
    }

    registerSources(data) {
        const validationError = this.#multiSourceSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'source', validationError);
            return false;
        }
        return data.map(i => this.registerAutomation(i));
    }

    async registerSourceCompendium(pack) {
        const index = await pack.getIndex({fields: ['system.identifier', 'system.source.rules', 'flags.cat.automation.identifier']});
        const source = pack.metadata.packageName;
        const documentType = pack.metadata.type;
        Logging.group('Source Compendium Registered: ' + pack.metadata.label + ' (' + pack.metadata.packageName + ')');
        const results = index.map(document => {
            const identifier = documentUtils.getIdentifier(document, {documentType});
            const rules = documentUtils.getRules(document, {documentType});
            const data = {
                source,
                rules,
                identifier,
                uuid: document.uuid
            };
            return this.registerSource(data);
        });
        Logging.groupEnd();
        return results;
    }

    async registerSourceModule(id, {ignoredPackIds = []} = {}) {
        const module = game.modules.get(id);
        if (!module?.active) return false;
        Logging.group('Source Module Registered: ' + module.title + ' for ' + this.type);
        const itemPacks = module.packs.filter(pack => pack.type === this.type && !ignoredPackIds.includes(pack.id));
        if (!itemPacks.size) return;
        const results = await Promise.all(itemPacks.map(async data => {
            const pack = game.packs.get(data.id);
            if (!pack) return false;
            return await this.registerSourceCompendium(pack);
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
    
    unregisterSourceBySource(source) {
        const initialLength = this.sourceData.length;
        this.sourceData = this.sourceData.filter(i => i.source !== source);
        if (this.sourceData.length !== initialLength) {
            this.sources.delete(source);
            Logging.addEntry('DEBUG', 'Unregistered all' + this.type + 'sources from source: ' + source);
        }
    }
}