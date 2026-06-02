import {Logging} from '../lib/_module.mjs';
import {automationUtils} from '../utilities/_module.mjs';
const fields = foundry.data.fields;
class FunctionField extends fields.DataField {
    _validateType(value) {
        if (typeof value !== 'function') throw new Error('The provided macro must be a function.');
        return value;
    }
}
export class RegisteredAnimations {
    #animationSchema;
    #multiAnimationScheme;
    constructor() {
        this.animations = [];
        this.#animationSchema = new fields.SchemaField({
            source: new fields.StringField({required: true, nullable: false}),
            identifier: new fields.StringField({required: true, nullable: false}),
            name: new fields.StringField({required: true, nullable: false}),
            macro: new FunctionField({required: true, nullable: false}),
            inputs: new fields.ArrayField(new fields.StringField({required: true, nullable: false}), {required: true, nullable: false}),
            requirements: new fields.ArrayField(new fields.StringField({required: false, nullable: false}), {required: false}),
            type: new fields.StringField({required: false, nullable: false}),
            config: new fields.ObjectField({required: false, nullable: false}),
            category: new fields.StringField({required: false, nullable: false})
        });
        this.#multiAnimationScheme = new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}));
    }
    registerAnimation(data) {
        const validationError = this.#animationSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, validationError.asError());
            return false;
        }
        this.animations.push(new Animation(data.source, data.identifier, data.name, data.macro, data.inputs, {requirements: data.requirements, type: data.type, config: data.config, category: data.category}));
    }
    registerAnimations(data = []) {
        const validationError = this.#multiAnimationScheme.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, validationError.asError());
            return false;
        }
        return data.map(i => this.registerAnimation(i));
    }
    getAnimation(source, identifier) {
        return this.animations.find(animation => animation.source === source && animation.identifier === identifier);
    }
    getGenericAnimationConfig(document, source, identifier, settingKey, key) {
        const animationData = automationUtils.getGenericConfigValue(document, source, identifier, settingKey);
        if (!animationData) return;
        const value = document.flags.cat?.animationGenericConfig?.[source]?.[identifier]?.[animationData.source]?.[animationData.identifier]?.[key];
        if (value != undefined) return value;
        return this.getAnimationConfig(document, animationData.source, animationData.identifier, key, {skipDocument: true});
    }
    getAnimationConfig(document, source, identifier, key, {skipDocument = false} = {}) {
        const value = !skipDocument ? document.flags?.cat?.animationConfig?.[source]?.[identifier]?.[key] : undefined;
        if (value != undefined) return value;
        const animation = this.getAnimation(source, identifier);
        return animation?.config?.[key]?.default;
    }
}
class Animation {
    constructor(source, identifier, name, macro, inputs, {requirements, type, config, category} = {}) {
        this.source = source;
        this.identifier = identifier;
        this.name = name;
        this.macro = macro;
        this.inputs = inputs;
        this.requirements = requirements;
        this.type = type;
        this.config = config;
        this.category = category ?? 'default';
    }
}
export default {
    RegisteredAnimations,
    Animation
};