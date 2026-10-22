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
const ERROR_LIMIT = 3;
function packIds() {
    return automationUtils.getSourceDataSources('Macro') ?? [];
}
function isCustomMacro(macro) {
    return !!macro.pack && packIds().includes(macro.pack);
}
async function load() {
    constants.macros.overwriteMacros.clear();
    const warnings = game.messages.filter(m => m.flags.cat?.customMacroWarning);
    if (warnings.length) await ChatMessage.implementation.deleteDocuments(warnings.map(w => w.id));
    const packs = packIds().toReversed().map(packId => game.packs.get(packId)).filter(Boolean);
    const macroLists = await Promise.all(packs.map(pack => pack.getDocuments({type: 'script'})));
    const badPacks = [];
    const badMacros = [];
    for (const macros of macroLists) {
        let errors = 0;
        for (const macro of macros) {
            if (await registerMacro(macro)) continue;
            badMacros.push(macro);
            if (++errors < ERROR_LIMIT) continue;
            badPacks.push(macro.collection);
            break;
        }
    }
    if (!badPacks.length && !badMacros.length) return;
    await ChatMessage.implementation.create({
        flags: {cat: {customMacroWarning: true}},
        speaker: {alias: _loc('CAT.CustomMacros.WarningMessage')},
        whisper: ChatMessage.implementation.getWhisperRecipients('GM').map(user => user.id),
        content: await foundry.applications.handlebars.renderTemplate('modules/cat/templates/custom-macros/card.hbs', {
            macros: badMacros.map(m => ({uuid: m.uuid, name: m.name, pack: m.collection.metadata.label})),
            packs: badPacks.map(p => p.metadata.label),
            hasMacros: badMacros.length > 0,
            hasPacks: badPacks.length > 0
        })
    });
}
async function registerMacro(macro) {
    try {
        const {fn, argValues} = Events.CalledEvent.prototype.buildScriptFunction(macro.command, {});
        const data = await fn(...argValues);
        if (!data) throw new Error(_loc('CAT.CustomMacros.NoReturn', {name: macro.name}));
        constants.macros.registerFnMacros([data].flat(), true);
    } catch (error) {
        Logging.addRegistrationError({macro: macro.uuid}, 'macro', error);
        return false;
    }
    return true;
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
    if (isCustomMacro(macro)) registerMacro(macro);
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
function renderWarningCard(message, html) {
    if (!message.flags.cat?.customMacroWarning) return;
    html.querySelector('[data-action="open-settings"]')?.addEventListener('click', () => {
        const menu = game.settings.menus.get('cat.compendiums');
        if (menu) new menu.type().render(true, {tab: 'macroCompendiums'});
    });
    html.querySelectorAll('[data-action="edit-macro"]').forEach(btn => btn.addEventListener('click', async () => {
        const macro = await fromUuid(btn.dataset.macroUuid);
        if (macro) macro.sheet.render(true);
        else genericUtils.notify('CAT.CustomMacros.NotFound', {type: 'warn', format: {uuid: btn.dataset.macroUuid}});
    }));
}
export default {
    load,
    preCreateMacro,
    changed,
    renderMacroConfig,
    renderWarningCard
};
