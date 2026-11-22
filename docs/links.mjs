const foundryApi = 'https://foundryvtt.com/api/v14/classes/';
const dnd5eSource = 'https://github.com/foundryvtt/dnd5e/blob/master/module/';
const pixiApi = 'https://pixijs.download/v7.x/docs/';
const mdn = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/';
const foundryAliases = {
    Actor: 'foundry.documents.Actor',
    ActiveEffect: 'foundry.documents.ActiveEffect',
    ChatMessage: 'foundry.documents.ChatMessage',
    ClientDocument: 'foundry.abstract.Document',
    CompendiumCollection: 'foundry.documents.collections.CompendiumCollection',
    Folder: 'foundry.documents.Folder',
    Item: 'foundry.documents.Item',
    Macro: 'foundry.documents.Macro',
    PointVisionSource: 'foundry.canvas.sources.PointVisionSource',
    RegionBehavior: 'foundry.documents.RegionBehavior',
    Roll: 'foundry.dice.Roll',
    Scene: 'foundry.documents.Scene',
    Token: 'foundry.canvas.placeables.Token',
    TokenDocument: 'foundry.documents.TokenDocument',
    User: 'foundry.documents.User'
};
const dnd5ePaths = {
    'Activity': 'documents/activity/mixin.mjs',
    'dnd5e.documents.activity.Activity': 'documents/activity/mixin.mjs',
    'Actor5e': 'documents/actor/actor.mjs',
    'Item5e': 'documents/item.mjs',
    'Token5e': 'canvas/token.mjs',
    'dnd5e.dataModels.activity.BaseActivityData': 'data/activity/base-activity.mjs',
    'dnd5e.dataModels.fields.FormulaField': 'data/fields/formula-field.mjs',
    'dnd5e.dice.D20Roll': 'dice/d20-roll.mjs',
    'dnd5e.dice.DamageRoll': 'dice/damage-roll.mjs',
    'CONFIG.Dice.DamageRoll': 'dice/damage-roll.mjs'
};
const builtins = new Set(['Promise', 'Set', 'Map', 'Function', 'RegExp', 'Array', 'Iterable']);
/** Links external types to the Foundry API, dnd5e source, PixiJS and MDN. */
export function load(app) {
    app.converter.addUnknownSymbolResolver(ref => {
        const path = ref.symbolReference?.path?.map(part => part.path) ?? [];
        const name = path.join('.');
        if (!name) return;
        if (name.startsWith('foundry.')) return foundryApi + name + '.html';
        if (foundryAliases[name]) return foundryApi + foundryAliases[name] + '.html';
        if (dnd5ePaths[name]) return dnd5eSource + dnd5ePaths[name];
        if (name.startsWith('PIXI.')) return pixiApi + name + '.html';
        if (builtins.has(name)) return mdn + name;
    });
}
