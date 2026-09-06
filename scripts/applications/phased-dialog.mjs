import DialogApp from './dialog.mjs';

export default class PhasedDialogApp extends DialogApp {
    #phases;
    #index;
    #resolvePhase;

    constructor(title, {phases = []} = {}) {
        super([title, undefined, [], 'ok']);
        this.#phases = phases;
        this.#index = -1;
        this.addEventListener('close', () => this.#settle(null), {once: true});
    }

    #settle(result) {
        const resolve = this.#resolvePhase;
        this.#resolvePhase = undefined;
        resolve?.(result);
    }

    async showPhase(phaseId, {content, inputs} = {}) {
        this.#index = this.#phases.findIndex(phase => phase.id === phaseId);
        this._setContents({content, inputs, buttons: 'ok'});
        const settled = new Promise(resolve => this.#resolvePhase = resolve);
        const windowId = this.rendered ? undefined : ui.activeWindow?.window?.windowId;
        await this.render(windowId ? {force: true, window: {windowId}} : {force: true});
        return await settled;
    }

    async mergeResults() {
        const results = await this._awaitResults();
        results.buttons = true;
        this._armResults();
        this.#settle(results);
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.phases = this.#phases.map((phase, i) => ({
            ...phase,
            active: i === this.#index,
            done: i < this.#index
        }));
        return context;
    }
}
