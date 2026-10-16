import constants from '../lib/constants.mjs';
import Troubleshooter, {SECTIONS} from '../lib/troubleshooter.mjs';
import {dialogUtils, documentUtils, genericUtils} from '../utilities/_module.mjs';
import CatApp from './cat-app.mjs';
import WorldMedkit from './medkit/world.mjs';

const SECTION_PART = {template: 'modules/cat/templates/troubleshooter/section.hbs', scrollable: ['']};
const STATUS = {
    pass: {medkitStatus: constants.MEDKIT_STATUSES.UP_TO_DATE, icon: 'fa-solid fa-circle-check'},
    warn: {medkitStatus: constants.MEDKIT_STATUSES.AVAILABLE, icon: 'fa-solid fa-triangle-exclamation'},
    fail: {medkitStatus: constants.MEDKIT_STATUSES.OUTDATED, icon: 'fa-solid fa-circle-xmark'}
};
const INFO_SECTIONS = ['modules', 'foundry', 'permissions'];
const OPTIONS = ['hideTroubleshooterWarnings', 'exportStripDialog'];

export default class TroubleshooterApp extends CatApp {
    #rows = [];
    #sections = {};
    #logHook;

    static INITIAL_SIZE = {width: 700, height: 500};

    static DEFAULT_OPTIONS = {
        id: 'cat-troubleshooter',
        classes: ['cat', 'cat-medkit', 'cat-troubleshooter'],
        window: {frame: false, positioned: true, title: 'CAT.Troubleshooter.Title'},
        position: {width: 700, height: 'auto'},
        actions: {
            fixCheck: TroubleshooterApp.#fixCheck,
            fixAll: TroubleshooterApp.#fixAll,
            saveReport: TroubleshooterApp.#saveReport,
            openDiscord: TroubleshooterApp.#openDiscord,
            openMassApply: TroubleshooterApp.#openMassApply,
            exportSettings: TroubleshooterApp.#exportSettings,
            importSettings: TroubleshooterApp.#importSettings
        }
    };

    static PARTS = {
        header: CatApp.HEADER_PART,
        nav: {template: 'modules/cat/templates/medkit/shared/nav.hbs'},
        required: SECTION_PART,
        info: SECTION_PART,
        logs: SECTION_PART,
        options: {template: 'modules/cat/templates/troubleshooter/options.hbs', scrollable: ['']},
        footer: CatApp.FOOTER_PART
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'required', icon: 'fa-solid fa-list-check'},
                {id: 'info', icon: 'fa-solid fa-circle-info'},
                {id: 'logs', icon: 'fa-solid fa-scroll'},
                {id: 'options', icon: 'fa-solid fa-sliders'}
            ],
            labelPrefix: 'CAT.Troubleshooter.Sections',
            initial: 'required'
        },
        info: {
            tabs: INFO_SECTIONS.map(id => ({id})),
            labelPrefix: 'CAT.Troubleshooter.Sections',
            initial: 'modules'
        }
    };

    render(options) {
        const existing = foundry.applications.instances.get(this.id);
        if (existing && existing !== this) return existing.render(options);
        return super.render(options);
    }

    get detachable() {
        return true;
    }

    get headerButtons() {
        return [{action: 'openDiscord', icon: 'fa-brands fa-discord', tooltip: 'CAT.Troubleshooter.Discord'}];
    }

    get footerButtons() {
        return [
            {type: 'button', action: 'fixAll', label: 'CAT.Troubleshooter.Footer.FixAll', icon: 'fa-solid fa-wrench', disabled: !this.#rows.some(row => row.fixable)},
            {type: 'button', action: 'saveReport', label: 'CAT.Troubleshooter.Footer.Save', icon: 'fa-solid fa-floppy-disk'},
            {type: 'button', action: 'exportSettings', label: 'CAT.Troubleshooter.Export.Settings', icon: 'fa-solid fa-file-export'},
            {type: 'button', action: 'importSettings', label: 'CAT.Troubleshooter.Export.ImportSettings', icon: 'fa-solid fa-file-import'}
        ];
    }

    async _prepareContext(options) {
        const sections = options.parts.some(part => part !== 'logs') ? SECTIONS : ['logs'];
        const rows = await constants.troubleshooter.run({sections});
        this.#rows = [...this.#rows.filter(row => !sections.includes(row.section)), ...rows];
        Object.assign(this.#sections, Object.fromEntries(sections.map(id => [id, this.#prepareSection(id)])));
        const context = await super._prepareContext(options);
        context.tabs = this._prepareTabs('sheet');
        return context;
    }

    #worstStatus(sections) {
        const rows = this.#rows.filter(row => sections.includes(row.section));
        const worst = ['fail', 'warn'].find(status => rows.some(row => row.status === status));
        return worst && STATUS[worst].medkitStatus;
    }

    #prepareSection(id) {
        const rows = this.#rows.filter(row => row.section === id).map(row => ({
            ...row,
            ...STATUS[row.status],
            statusLabel: `CAT.Troubleshooter.Status.${row.status}`,
            button: row.fixable ? {action: 'fixCheck', label: row.fixLabel} : row.action && {action: row.action, label: row.actionLabel}
        }));
        return {
            groups: Object.entries(Object.groupBy(rows, row => row.group ?? '')).map(([label, rows]) => ({label, rows: rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label))})),
            counts: id === 'required' ? ['pass', 'warn', 'fail'].map(status => ({
                status: STATUS[status].medkitStatus,
                label: `CAT.Troubleshooter.Status.${status}`,
                count: rows.filter(row => row.status === status).length
            })) : null
        };
    }

    _prepareTabs(group) {
        const tabs = super._prepareTabs(group);
        for (const [id, tab] of Object.entries(tabs)) tab.status = this.#worstStatus(id === 'info' ? INFO_SECTIONS : [id]);
        return tabs;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        if (!options.isFirstRender) return;
        this.#logHook = Hooks.on('catLogEntry', () => this.render({parts: ['logs']}));
        this.element.addEventListener('change', event => {
            const key = event.target.dataset.setting;
            if (key) game.settings.set('cat', key, event.target.checked);
        });
    }

    _onClose(options) {
        super._onClose(options);
        Hooks.off('catLogEntry', this.#logHook);
    }

    async _preparePartContext(partId, context) {
        const partContext = await super._preparePartContext(partId, context);
        const tab = partContext.tabs[partId];
        switch (partId) {
            case 'required':
            case 'logs':
                return {...partContext, tab, panels: [{label: tab.label, section: this.#sections[partId]}]};
            case 'info': {
                const subtabs = this._prepareTabs('info');
                return {...partContext, tab, subtabs, panels: INFO_SECTIONS.map(id => ({tab: subtabs[id], label: subtabs[id].label, section: this.#sections[id]}))};
            }
            case 'options':
                return {...partContext, tab, options: OPTIONS.map(key => {
                    const setting = game.settings.settings.get(`cat.${key}`);
                    return {key, name: setting.name, hint: setting.hint, value: game.settings.get('cat', key), disabled: setting.scope === 'world' && !game.user.isGM};
                })};
        }
        return partContext;
    }

    get #reportText() {
        return [_loc('CAT.Troubleshooter.Title'), ...SECTIONS.flatMap(id => this.#sections[id].groups.map(group => ({...group, id}))).map(group => [
            `== ${[_loc(`CAT.Troubleshooter.Sections.${group.id}`), group.label].filter(Boolean).join(' - ')} ==`,
            ...group.rows.filter(row => !row.reportHidden).map(row => `[${row.status.toUpperCase()}] ${row.label}${row.tags?.length ? ` [${row.tags.map(tag => tag.label).join(', ')}]` : ''}${row.detail ? ': ' + row.detail : ''}`)
        ].join('\n'))].join('\n\n');
    }

    /** @this {TroubleshooterApp} */
    static async #fixCheck(event, target) {
        if (await constants.troubleshooter.fix(this.#rows.filter(row => row.id === target.dataset.checkId))) this.render();
    }

    /** @this {TroubleshooterApp} */
    static async #fixAll() {
        if (await constants.troubleshooter.fix(this.#rows)) this.render();
    }

    /** @this {TroubleshooterApp} */
    static async #saveReport() {
        let attached;
        const hook = Hooks.on('renderDialogApp', (dialog, element) => {
            const zone = element.querySelector('.cat-troubleshooter-drop');
            if (!zone) return;
            element.addEventListener('dragover', event => event.preventDefault());
            element.addEventListener('drop', async event => {
                event.preventDefault();
                const uuid = foundry.applications.ux.TextEditor.implementation.getDragEventData(event)?.uuid;
                const document = uuid && await fromUuid(uuid);
                if (!['Actor', 'Item'].includes(document?.documentName)) return;
                attached = document;
                zone.textContent = document.name;
                zone.classList.add('attached');
            });
        });
        const content = `<div class="cat-troubleshooter-drop">${_loc('CAT.Troubleshooter.Save.Drop')}</div>`;
        const selection = await dialogUtils.confirm('CAT.Troubleshooter.Save.Title', content, {buttons: 'okCancel'});
        Hooks.off('renderDialogApp', hook);
        if (!selection) return;
        foundry.utils.saveDataToFile(this.#reportText, 'text/plain', `cat-troubleshooter-${genericUtils.dateStamp()}.txt`);
        if (attached) documentUtils.exportDocument(attached, {automation: true});
        genericUtils.notify('CAT.Troubleshooter.Save.Saved');
    }

    /** @this {TroubleshooterApp} */
    static async #openDiscord() {
        await game.clipboard.copyPlainText(this.#reportText);
        genericUtils.notify('CAT.Troubleshooter.Copied');
        this.element.ownerDocument.defaultView.open(constants.DISCORD_URL, '_blank');
    }

    /** @this {TroubleshooterApp} */
    static #openMassApply() {
        new WorldMedkit().render({force: true});
    }

    /** @this {TroubleshooterApp} */
    static #exportSettings() {
        const settings = Object.fromEntries(Troubleshooter.catSettings().map(setting => [setting.key, game.settings.get('cat', setting.key)]));
        foundry.utils.saveDataToFile(JSON.stringify(settings, null, 2), 'application/json', `cat-settings-${genericUtils.dateStamp()}.json`);
        genericUtils.notify('CAT.Troubleshooter.Export.Exported');
    }

    /** @this {TroubleshooterApp} */
    static #importSettings() {
        const input = this.element.ownerDocument.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', async () => {
            const data = JSON.parse(await foundry.utils.readTextFromFile(input.files[0]));
            const entries = Object.entries(data).filter(([key]) => game.settings.settings.has('cat.' + key));
            if (!await dialogUtils.confirm('CAT.Troubleshooter.Export.ImportTitle', 'CAT.Troubleshooter.Export.ImportContent')) return;
            for (const [key, value] of entries) await game.settings.set('cat', key, value);
            genericUtils.notify('CAT.Troubleshooter.Export.Imported', {format: {count: entries.length}});
            await foundry.applications.settings.SettingsConfig.reloadConfirm({world: true});
        });
        input.click();
    }
}
