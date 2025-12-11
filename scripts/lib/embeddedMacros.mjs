import {Logging} from '../lib.mjs';
export class EmbeddedMacros {
    constructor(document) {
        this.document = document;
        this.embeddedMacros = document?.flags?.cat?.embeddedMacros ?? [];
    }
    getMacros(event, pass) {
        return this.embeddedMacros.filter(macro => macro.event === event && macro.pass === pass);
    }
    async #update() {
        await this.document.setFlag('cat', 'embeddedMacros', this.embeddedMacros);
    }
    async setMacros(data) {
        this.embeddedMacros = data;
        await this.#update();
    }
    getMacro(name) {
        return this.embeddedMacros.find(macro => macro.name === name);
    }
    async addMacro(data) {
        let macro = this.getMacro(data.name);
        if (macro) {
            Logging.addUserError('Embedded macro ' + data.name + ' already exists on document!');
            return;
        }
        this.embeddedMacros.push(data);
        await this.#update();
    }
    async removeMacro(name) {
        this.embeddedMacros = this.embeddedMacros.filter(macro => macro.name != name);
        await this.#update();
    }
    get hasEmbeddedMacros() {
        return this.embeddedMacros.length > 0;
    }
}