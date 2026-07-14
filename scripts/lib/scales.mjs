import {Logging} from '../lib/_module.mjs';
const fields = foundry.data.fields;
class Scale {
    constructor(source, rules, identifier, data, {classIdentifier} = {}) {
        this.source = source;
        this.rules = rules;
        this.identifier = identifier;
        this.data = data;
        this.classIdentifier = classIdentifier;
    }
    source;
    rules;
    identifier;
    data;
}
export class RegisteredScales {
    #scaleSchema = new fields.SchemaField({
        source: new fields.StringField({required: true, nullable: false}),
        rules: new fields.StringField({required: true, nullable: false}),
        identifier: new fields.StringField({required: true, nullable: false}),
        classIdentifier: new fields.StringField({required: false, nullable: false}),
        data: new fields.ObjectField({required: true, nullable: false})
        //data: new fields.SchemaField(dnd5e.dataModels.advancement.scaleValue.ScaleValueConfigurationData.defineSchema(), {required: true, nullable: false})
    });
    #multiScalesSchema = new fields.ArrayField(this.#scaleSchema);
    scales = new Map();
    sources = new Set();
    getScaleByIdentifier(identifier, {rules = 'all', source = 'all', multiple = false, classIdentifier} = {}) {
        const predicate = scale => (rules === 'all' || scale.rules === rules) && (source === 'all' || scale.source === source) && (!classIdentifier || scale.classIdentifier === classIdentifier);
        const list = this.scales.get(identifier) ?? [];
        return multiple ? list.filter(predicate) : list.find(predicate);
    }
    registerScale(data) {
        const validationError = this.#scaleSchema.validate(data);
        if (validationError) {
            Logging.addAutomationError(data, validationError.asError());
            return false;
        }
        const scale = new Scale(data.source, data.rules, data.identifier, data.data, {classIdentifier: data.classIdentifier});
        const list = this.scales.get(data.identifier);
        if (list) list.push(scale);
        else this.scales.set(data.identifier, [scale]);
        this.sources.add(data.source);
        Logging.addEntry('DEBUG', 'Scale Registered: ' + data.identifier + ' from ' + data.source);
    }
    registerScales(data) {
        const validationError = this.#multiScalesSchema.validate(data);
        if (validationError) {
            Logging.addAutomationError(data, validationError.asError());
            return false;
        }
        return data.map(i => this.registerScale(i));
    }
    unregisterScalesBySource(sourceId) {
        let i = 0;
        for (const [identifier, list] of this.scales.entries()) {
            const filtered = list.filter(a => a.source !== sourceId);
            if (filtered.length === list.length) continue;
            i += list.length - filtered.length;
            if (!filtered.length) this.scales.delete(identifier);
            else this.scales.set(identifier, filtered);
        }
        if (i === 0) return;
        this.sources.delete(sourceId);
        Logging.addEntry('DEBUG', 'All ' + i + ' scales unregistered from source: ' + sourceId);
    }
}
export default {
    Scale,
    RegisteredScales
};