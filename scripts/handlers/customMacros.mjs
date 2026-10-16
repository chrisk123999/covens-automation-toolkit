import {constants, Events, Logging} from '../lib/_module.mjs';
import {automationUtils, genericUtils} from '../utilities/_module.mjs';
const template = identifier => `async function use({workflow}) {
}
return [
    {
        source: 'chris-premades',
        identifier: '${identifier}',
        rules: 'all',
        roll: [{pass: 'itemRollFinished', macro: use, priority: 50}]
    }
];
`;
const example = `async function marked({workflow}) {
    console.log(workflow.targets.first()?.name);
}
return [
    {
        source: 'chris-premades',
        identifier: 'hunters-mark',
        rules: '2014',
        roll: [{pass: 'itemRollFinished', macro: marked, priority: 50}]
    },
    {
        source: 'chris-premades',
        identifier: 'hunters-mark',
        rules: '2024',
        roll: [{pass: 'itemRollFinished', macro: marked, priority: 50}]
    }
];`;
function packIds() {
    return automationUtils.getSourceDataSources('Macro') ?? [];
}
function isCustomMacro(macro) {
    return !!macro.pack && packIds().includes(macro.pack);
}
async function load() {
    constants.macros.overwriteMacros.clear();
    const packs = packIds().toReversed().map(packId => game.packs.get(packId)).filter(Boolean);
    const macroLists = await Promise.all(packs.map(pack => pack.getDocuments({type: 'script'})));
    for (const macros of macroLists) {
        for (const macro of macros) {
            try {
                const {fn, argValues} = Events.CalledEvent.prototype.buildScriptFunction(macro.command, {});
                const data = await fn(...argValues);
                if (!data) throw new Error(_loc('CAT.CustomMacros.NoReturn', {name: macro.name}));
                constants.macros.registerFnMacros([data].flat(), true);
            } catch (error) {
                Logging.addRegistrationError({macro: macro.uuid}, 'macro', error);
            }
        }
    }
}
function preCreateMacro(macro, data, options, userId) {
    if (userId !== game.user.id || !isCustomMacro(macro)) return;
    if (macro.type !== 'script' && macro.command) {
        genericUtils.notify('CAT.CustomMacros.ScriptOnly', {type: 'warn'});
        return false;
    }
    macro.updateSource({type: 'script', command: macro.command || template(macro.name.slugify())});
}
function changed(macro) {
    if (isCustomMacro(macro)) load();
}
async function renderMacroConfig(app, element) {
    if (!isCustomMacro(app.document)) return;
    element.classList.add('cat-custom-macro');
    element.querySelector('button[data-action="execute"]')?.remove();
    element.querySelector('[name="type"]')?.closest('.form-group')?.remove();
    const hint = await foundry.applications.handlebars.renderTemplate('modules/cat/templates/custom-macros/hint.hbs', {example, wiki: constants.WIKI_URL, discord: constants.DISCORD_URL});
    element.querySelector('code-mirror')?.insertAdjacentHTML('beforebegin', hint);
    element.querySelector('.cat-custom-macro-hint')?.addEventListener('toggle', () => app.setPosition({height: 'auto'}));
    app.setPosition({height: 'auto'});
}
export default {
    load,
    preCreateMacro,
    changed,
    renderMacroConfig
};
