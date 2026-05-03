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
    scales = [];
    sources = new Set();
    getScaleByIdentifier(identifier, {rules = 'all', source = 'all', multiple = false, classIdentifier} = {}) {
        const predicate = scale => scale.identifier === identifier && (rules === 'all' || scale.rules === rules) && (source === 'all' || scale.source === source) && (!classIdentifier || scale.sourceClass === classIdentifier);
        return multiple ? this.scales.filter(predicate) : this.scales.find(predicate);
    }
    registerScale(data) {
        const validationError = this.#scaleSchema.validate(data);
        if (validationError) {
            Logging.addAutomationError(data, validationError);
            return false;
        }
        this.scales.push(new Scale(data.source, data.rules, data.identifier, data.data, {classIdentifier: data.classIdentifier}));
        this.sources.add(data.source);
        Logging.addEntry('DEBUG', 'Scale Registered: ' + data.identifier + ' from ' + data.source);
    }
    registerScales(data) {
        const validationError = this.#multiScalesSchema.validate(data);
        if (validationError) {
            Logging.addAutomationError(data, validationError);
            return false;
        }
        return data.map(i => this.registerScale(i));
    }
}
export default {
    Scale,
    RegisteredScales
};