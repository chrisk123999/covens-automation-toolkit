import {CompendiumMedkit} from '../applications/_module.mjs';
import {compendiumUtils, genericUtils} from '../utilities/_module.mjs';
import contextmenu from './contextmenu.mjs';
const SAMPLE_ITEM = 'Fire Shield';
const SAMPLE_PACK = 'dnd5e.spells';
const MEDKIT_ICON = 'i.fa-shield-cat';
async function sampleItem() {
    for (const pack of game.packs.filter(pack => pack.metadata.packageName === 'dnd5e' && pack.documentName === 'Item')) {
        const item = await compendiumUtils.getDocumentByName(pack.collection, SAMPLE_ITEM);
        if (item) return item;
    }
}
function openApps(predicate) {
    return Array.from(foundry.applications.instances.values()).filter(predicate);
}
function medkitApp() {
    return openApps(app => app.element?.classList.contains('cat-medkit'))[0];
}
async function waitFor(selector, timeout = 10000) {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        const position = rect?.width ? [rect.x, rect.y, rect.width, rect.height].join() : undefined;
        if (position && position === last) return;
        last = position;
        await genericUtils.sleep(100);
    }
}
async function closeDemo() {
    document.querySelector('#context-menu')?.remove();
    const apps = openApps(app => app.element?.classList.contains('cat-medkit') || app.id?.startsWith('cat-settings-menu') || app.tourDemo);
    await Promise.all(apps.map(app => app.close({animate: false})));
    if (game.settings.sheet.rendered) await game.settings.sheet.close({animate: false});
}
function place(app, left) {
    app?.setPosition({left: Math.round(window.innerWidth * left), top: 80});
}
async function itemSheet(tour) {
    await closeDemo();
    const item = tour.sampleItem;
    await item.sheet.render({force: true});
    item.sheet.tourDemo = true;
    item.sheet.element.classList.add('cat-tour-sheet');
    place(item.sheet, 0.2);
}
async function itemMedkit(tour, tab = 'automation') {
    let medkit = medkitApp();
    if (medkit?.document !== tour.sampleItem) {
        await closeDemo();
        contextmenu.openMedkit(tour.sampleItem);
        await waitFor('.cat-medkit');
        ui.notifications.clear();
        medkit = medkitApp();
        place(medkit, 0.2);
    }
    medkit?.element.querySelector(`nav.tabs a[data-tab="${tab}"]`)?.click();
}
async function actorMedkit(tour) {
    await closeDemo();
    contextmenu.openMedkit(tour.sampleActor);
    await waitFor('.cat-medkit');
    place(medkitApp(), 0.2);
}
async function compendiumMedkit() {
    await closeDemo();
    const medkit = new CompendiumMedkit({document: game.packs.get(SAMPLE_PACK)});
    medkit.tourDemo = true;
    await medkit.render({force: true});
    place(medkit, 0.2);
}
async function settings() {
    if (!game.settings.sheet.rendered) await closeDemo();
    await game.settings.sheet.render({force: true});
    game.settings.sheet.changeTab('cat', 'categories');
    place(game.settings.sheet, 0.15);
}
async function settingsMenu(key, tab) {
    let menu = openApps(app => app.id === 'cat-settings-menu-' + key)[0];
    if (!menu) {
        await closeDemo();
        menu = new (game.settings.menus.get('cat.' + key).type)();
        await menu.render({force: true});
        place(menu, 0.2);
    }
    if (tab) menu.element.querySelector(`nav a[data-tab="${tab}"]`)?.click();
}
function ownedCharacter() {
    return game.actors.find(actor => actor.type === 'character' && actor.isOwner);
}
function automationMenu() {
    return settingsMenu('automation');
}
const medkitSteps = [
    {id: 'intro', setup: closeDemo},
    {id: 'sheetControl', selector: `.cat-tour-sheet .header-control:has(${MEDKIT_ICON}), .cat-tour-sheet .header-control[data-action="toggleControls"]`, setup: itemSheet},
    {id: 'status', selector: '.cat-medkit header > i.fa-shield-cat', setup: itemMedkit},
    {id: 'apply', selector: '.cat-medkit .hero', setup: itemMedkit},
    {id: 'rules', selector: '.cat-medkit fieldset[data-section="rules-toggle"]', setup: itemMedkit},
    {id: 'identifier', selector: '.cat-medkit fieldset[data-section="automation"] > .form-group:first-of-type', setup: itemMedkit},
    {id: 'source', selector: '.cat-medkit .form-group:has([name="selectedSource"])', setup: itemMedkit},
    {id: 'ignore', selector: '.cat-medkit .form-group:has([name="flags.cat.ignoreItem"])', setup: itemMedkit},
    {id: 'tabs', selector: '.cat-medkit nav.tabs', setup: itemMedkit},
    {id: 'troubleshooter', selector: '.cat-medkit [data-action="openTroubleshooter"]', setup: itemMedkit},
    {id: 'actor', selector: '.cat-medkit [data-action="massApply"]', setup: actorMedkit},
    {id: 'compendium', selector: '.cat-medkit [data-action="massApply"]', setup: compendiumMedkit},
    {id: 'outro', setup: closeDemo}
];
const sourcesSteps = [
    {id: 'intro', setup: closeDemo},
    {id: 'open', selector: '[data-key="cat.automation"]', setup: settings},
    {id: 'order', selector: '#cat-settings-menu-automation ul[data-list="enabled"]', setup: automationMenu},
    {id: 'content', selector: '#cat-settings-menu-automation ul[data-list="enabled"]', setup: automationMenu},
    {id: 'kinds', selector: '#cat-settings-menu-automation li[data-kind] .pill', direction: 'LEFT', setup: automationMenu},
    {id: 'rank', selector: '#cat-settings-menu-automation ul[data-list="enabled"] li', setup: automationMenu},
    {id: 'disable', selector: '#cat-settings-menu-automation [data-priority-action="disable"]', setup: automationMenu},
    {id: 'inactive', selector: '#cat-settings-menu-automation details', setup: async () => {
        await automationMenu();
        document.querySelector('#cat-settings-menu-automation details')?.setAttribute('open', '');
    }},
    {id: 'confirm', selector: '#cat-settings-menu-automation footer button[name="true"]', direction: 'DOWN', setup: automationMenu},
    {id: 'compendiums', selector: '[data-key="cat.compendiums"]', setup: settings},
    {id: 'compendiumLists', selector: '#cat-settings-menu-compendiums', setup: () => settingsMenu('compendiums', 'spellCompendiums')},
    {id: 'reapply', setup: closeDemo}
];
const settingsKeys = ['help', 'general', 'automation', 'backups', 'compendiums', 'integration', 'interface', 'manualRolls', 'mechanics', 'permissions', 'devtools'];
const settingsSteps = [
    {id: 'intro', setup: settings},
    ...settingsKeys.map(key => ({id: key, selector: `[data-key="cat.${key}"]`, setup: settings})),
    {id: 'outro', setup: closeDemo}
];
class CatTour extends foundry.nue.Tour {
    constructor(config, stepSetups) {
        super(config);
        this.stepSetups = stepSetups;
    }
    async _preStep() {
        await super._preStep();
        this.sampleItem ??= await sampleItem();
        this.sampleActor ??= ownedCharacter();
        const step = this.currentStep;
        await this.stepSetups[step.id]?.(this);
        if (step.selector) await waitFor(step.selector);
    }
    async complete() {
        await closeDemo();
        return super.complete();
    }
    exit() {
        closeDemo();
        return super.exit();
    }
}
function register(id, steps, suggestedNextTours) {
    const tourSteps = steps.map(step => ({
        id: step.id,
        title: `CAT.Tours.${id}.${step.id}.Title`,
        content: `CAT.Tours.${id}.${step.id}.Content`,
        selector: step.selector,
        tooltipDirection: step.selector && (step.direction ?? 'RIGHT')
    }));
    game.tours.register('cat', id, new CatTour({
        title: `CAT.Tours.${id}.Title`,
        description: `CAT.Tours.${id}.Description`,
        canBeResumed: false,
        display: true,
        suggestedNextTours,
        steps: tourSteps
    }, Object.fromEntries(steps.map(step => [step.id, step.setup]))));
}
function registerTours() {
    if (!game.user.isGM) return;
    const actorStep = !!ownedCharacter();
    register('medkit', medkitSteps.filter(step => step.id !== 'actor' || actorStep), ['cat.sources', 'cat.settings']);
    register('sources', sourcesSteps, ['cat.medkit', 'cat.settings']);
    register('settings', settingsSteps, ['cat.sources', 'cat.medkit']);
}
export default {
    registerTours
};
