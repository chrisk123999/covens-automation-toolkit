import {Logging} from '../lib/_module.mjs';
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
            requirements:new fields.ArrayField(new fields.StringField({required: false, nullable: false}), {required: false}),
            type: new fields.StringField({required: false, nullable: false})
        });
        this.#multiAnimationScheme = new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}));
    }
    registerAnimation(data) {
        const validationError = this.#animationSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, validationError.asError());
            return false;
        }
        this.animations.push(new Animation(data.source, data.identifier, data.name, data.macro, {requirements: data.requirements, type: data.type}));
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
}
class Animation {
    constructor(source, identifier, name, macro, {requirements, type} = {}) {
        this.source = source;
        this.identifier = identifier;
        this.name = name;
        this.macro = macro;
        this.requirements = requirements;
        this.type = type;
    }
}
export default {
    RegisteredAnimations,
    Animation
};