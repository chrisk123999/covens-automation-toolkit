import CompendiumMedkit from './compendium.mjs';

export default class WorldMedkit extends CompendiumMedkit {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-world'
    };

    constructor(options = {}) {
        super({document: {name: _loc('CAT.Troubleshooter.World')}, ...options});
    }

    static _worldItems() {
        return [...game.items, ...game.actors.contents.flatMap(actor => actor.items.contents)];
    }

    _getMassApplyItems() {
        return WorldMedkit._worldItems();
    }

    async _canMassApply() {
        return true;
    }
}
