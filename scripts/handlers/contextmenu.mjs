import * as applications from '../applications/_module.mjs';
import {automationUtils, documentUtils} from '../utilities/_module.mjs';
import {constants} from '../lib/_module.mjs';
const medkitPackTypes = ['ActiveEffect', 'Actor', 'Item'];
let medkitForType;
let decorationId = 0;
function getMedkitStatus(document) {
    if (!document) return;
    switch (automationUtils.getAutomationStatus(document)) {
        case constants.automationStatus.UNAVAILABLE:
            return (documentUtils.getSource(document) ?? 'none') !== 'none' ? constants.MEDKIT_STATUSES.UNKNOWN : undefined;
        case constants.automationStatus.AVAILABLE: return constants.MEDKIT_STATUSES.AVAILABLE;
        case constants.automationStatus.OUTDATED: return constants.MEDKIT_STATUSES.OUTDATED;
        case constants.automationStatus.UP_TO_DATE: return constants.MEDKIT_STATUSES.UP_TO_DATE;
        case constants.automationStatus.CONFIGURABLE:
        case constants.automationStatus.GENERIC: return constants.MEDKIT_STATUSES.CONFIGURABLE;
    }
}
function medkitIcon(status) {
    if (!status) return 'fa-solid fa-shield-cat';
    return `<i class="fa-solid fa-shield-cat" data-medkit-status="${status}"></i>`;
}
function openMedkit(document) {
    medkitForType ??= {
        Item: applications.ItemMedkit,
        Token: applications.TokenMedkit,
        Scene: applications.SceneMedkit,
        Level: applications.LevelMedkit,
        Region: applications.RegionMedkit,
        Actor: applications.ActorMedkit,
        ActiveEffect: applications.EffectMedkit,
        Activity: applications.ActivityMedkit
    };
    const App = medkitForType[document?.documentName];
    if (App) new App({document}).render({force: true});
}
function resolveEntry(app, target) {
    const {entryId, sceneId, levelId} = target.closest('[data-entry-id], [data-scene-id]')?.dataset ?? {};
    if (sceneId) {
        const scene = game.scenes.get(sceneId);
        return (levelId ? scene?.levels.get(levelId) : scene) ?? null;
    }
    if (!entryId) return null;
    const collection = app.collection;
    return (collection?.getDocument ? collection.getDocument(entryId) : collection?.get(entryId)) ?? null;
}
function decorateEntry(entry, target, resolved) {
    if (typeof resolved?.then !== 'function') {
        entry.icon = medkitIcon(getMedkitStatus(resolved));
        return;
    }
    entry.icon = medkitIcon();
    const id = ++decorationId;
    resolved.then(document => {
        const status = getMedkitStatus(document);
        if (!status || id !== decorationId) return;
        requestAnimationFrame(() => {
            if (id !== decorationId) return;
            const icon = target.ownerDocument.querySelector('nav#context-menu i.fa-shield-cat');
            if (icon) icon.dataset.medkitStatus = status;
        });
    });
}
function appendEntryOption(app, entries) {
    const entry = {
        label: _loc('CAT.MEDKIT.HeaderLabel'),
        icon: medkitIcon(),
        visible: target => {
            decorateEntry(entry, target, resolveEntry(app, target));
            return true;
        },
        onClick: async (event, target) => openMedkit(await resolveEntry(app, target))
    };
    entries.push(entry);
}
function resolvePack(target) {
    const pack = game.packs.get(target.closest('[data-pack]')?.dataset.pack);
    return medkitPackTypes.includes(pack?.metadata.type) ? pack : undefined;
}
function appendPackOption(app, entries) {
    entries.push({
        label: _loc('CAT.MEDKIT.HeaderLabel'),
        icon: medkitIcon(),
        visible: target => !!resolvePack(target),
        onClick: (event, target) => {
            const pack = resolvePack(target);
            if (pack) new applications.CompendiumMedkit({document: pack}).render({force: true});
        }
    });
}
function appendDocumentOption(document, entries) {
    entries.push({
        label: _loc('CAT.MEDKIT.HeaderLabel'),
        icon: medkitIcon(getMedkitStatus(document)),
        onClick: () => openMedkit(document)
    });
}
function appendActivityOption(activity, target, entries) {
    appendDocumentOption(activity, entries);
}
function appendHeaderControl(app, controls) {
    if (app.classList.contains('tidy5e-sheet')) return;
    const pack = app instanceof foundry.applications.sidebar.apps.Compendium ? app.collection : null;
    if (pack && !medkitPackTypes.includes(pack.metadata.type)) return;
    controls.push({
        label: _loc('CAT.MEDKIT.HeaderLabel'),
        icon: medkitIcon(getMedkitStatus(app.document)),
        onClick: () => {
            if (pack) new applications.CompendiumMedkit({document: pack}).render({force: true});
            else openMedkit(app.document);
        }
    });
}
export default {
    appendActivityOption,
    appendDocumentOption,
    appendEntryOption,
    appendHeaderControl,
    appendPackOption,
    getMedkitStatus,
    openMedkit
};
