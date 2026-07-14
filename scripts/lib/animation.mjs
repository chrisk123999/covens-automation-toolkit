import {Logging} from '../lib/_module.mjs';
import {automationUtils, genericUtils} from '../utilities/_module.mjs';
const fields = foundry.data.fields;
export class RegisteredAnimations {
    #animationSchema;
    #multiAnimationSchema;
    constructor() {
        this.animations = new Map();
        this.#animationSchema = new fields.SchemaField({
            source: new fields.StringField({required: true, nullable: false}),
            identifier: new fields.StringField({required: true, nullable: false}),
            name: new fields.StringField({required: true, nullable: false}),
            macros: new fields.ObjectField({required: true, nullable: false}),
            inputs: new fields.ArrayField(new fields.StringField({required: true, nullable: false}), {required: true, nullable: false}),
            requirements: new fields.ArrayField(new fields.StringField({required: false, nullable: false}), {required: false}),
            config: new fields.ObjectField({required: false, nullable: false}),
            category: new fields.StringField({required: false, nullable: false}),
            credits: new fields.ArrayField(new fields.SchemaField({
                name: new fields.StringField({required: true, nullable: false}),
                discord: new fields.StringField({required: false, nullable: false}),
                patreon: new fields.StringField({required: false, nullable: false})
            }), {required: false, nullable: false})
        });
        this.#multiAnimationSchema = new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}));
    }
    #makeKey(source, identifier) {
        return source + '|' + identifier;
    }
    registerAnimation(data) {
        const validationError = this.#animationSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'animation', validationError.asError());
            return false;
        }
        this.animations.set(this.#makeKey(data.source, data.identifier), new Animation(data.source, data.identifier, data.name, data.macros, data.inputs, {requirements: data.requirements, config: data.config, category: data.category, credits: data.credits}));
        return true;
    }
    registerAnimations(data = []) {
        const validationError = this.#multiAnimationSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'animation', validationError.asError());
            return false;
        }
        return data.map(i => this.registerAnimation(i));
    }
    getAnimation(source, identifier) {
        return this.animations.get(this.#makeKey(source, identifier));
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
    getEffectAnimationConfig(effect, type, key) {
        const animationData = effect.flags.cat?.animation?.[type];
        if (!animationData) return;
        const value = animationData.config?.[key];
        if (value != undefined) return value;
        return this.getAnimationConfig(effect, animationData.source, animationData.identifier, key, {skipDocument: true});
    }
    getEffectAnimationConfigs(effect, type) {
        const animationData = effect.flags.cat?.animation?.[type];
        if (!animationData) return {};
        const configs = genericUtils.deepClone(animationData.config ?? {});
        const animation = this.getAnimation(animationData.source, animationData.identifier);
        if (animation?.config) Object.keys(animation.config).forEach(key => configs[key] = this.getEffectAnimationConfig(effect, type, key));
        return configs;
    }
}
class Animation {
    constructor(source, identifier, name, macros, inputs, {requirements, config, category, credits} = {}) {
        this.source = source;
        this.identifier = identifier;
        this.name = name;
        this.macros = macros;
        this.inputs = inputs;
        this.requirements = requirements;
        this.config = config;
        this.category = category ?? 'default';
        this.credits = credits;
    }
}
export default {
    RegisteredAnimations,
    Animation
};