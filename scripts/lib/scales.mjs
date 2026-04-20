import {Logging} from '../lib/_module.mjs';
const fields = foundry.data.fields;
class Scale {
    constructor(source, rules, identifier, data) {
        this.source = source;
        this.rules = rules;
        this.identifier = identifier;
        this.data = data;
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
        // eslint-disable-next-line no-undef
        data: new dnd5e.dataModels.advancement.scaleValue.ScaleValueConfigurationData({required: true, nullable: false})
    });
    #multiScalesSchema = new fields.ArrayField(this.#scaleSchema);
    scales = [];
    sources = new Set();
    getScaleByIdentifier(identifier, {rules = 'all', source = 'all', multiple = false} = {}) {
        const predicate = scale => scale.identifier === identifier && (rules === 'all' || scale.rules === rules) && (source === 'all' || scale.source === source);
        return multiple ? this.scales.filter(predicate) : this.scales.find(predicate);
    }
    registerScale(data) {
        const validationError = this.#scaleSchema.validate(data);
        if (validationError) {
            Logging.addAutomationError(data, validationError);
            return false;
        }
        this.scales.push(new Scale(data.source, data.rules, data.identifier, data.data));
        this.sources.add(data.source);
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