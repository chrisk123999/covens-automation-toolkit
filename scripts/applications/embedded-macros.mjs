const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

// Read-only list view of a document's embedded macros. Stub until full editor lands.
export default class EmbeddedMacrosApp extends HandlebarsApplicationMixin(ApplicationV2) {
    #document;

    constructor({document, ...options}) {
        super({...options});
        this.#document = document;
    }

    static DEFAULT_OPTIONS = {
        id: 'cat-embedded-macros',
        classes: ['cat', 'cat-embedded-macros'],
        window: {
            frame: false,
            positioned: true
        },
        position: {
            width: 520,
            height: 'auto'
        },
        actions: {
            close: EmbeddedMacrosApp.#close
        }
    };

    static PARTS = {
        body: {
            template: 'modules/cat/templates/embedded-macros.hbs',
            scrollable: ['']
        }
    };

    get title() {
        return _loc('CAT.MEDKIT.EmbeddedMacros.Title', {name: this.#document.name});
    }

    get document() {
        return this.#document;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const entries = this.#document.flags.cat?.embeddedMacros ?? [];
        context.title = this.title;
        context.rows = entries.map(e => ({
            name: e.name,
            event: e.event,
            pass: e.pass,
            source: e.source ?? '-'
        }));
        return context;
    }

    /** @this {EmbeddedMacrosApp} */
    static async #close() {
        this.close();
    }

    #enableDragging() {
        const handle = this.element?.querySelector('.cat-embedded-macros-header');
        if (!handle || handle.dataset.dragWired === '1') return;
        handle.dataset.dragWired = '1';
        const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, handle, false);
        const orig = drag._onDragMouseDown.bind(drag);
        drag._onDragMouseDown = (event) => {
            if (event.target.closest('button, a, input, select, [data-action]')) return;
            orig(event);
        };
    }

    bringToFront() {
        if (!this.element) return;
        this.position.zIndex = ++ApplicationV2._maxZ;
        this.element.style.zIndex = String(this.position.zIndex);
        ui.activeWindow = this;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.#enableDragging();
        if (options.isFirstRender) {
            this.bringToFront();
            const win = this.element.ownerDocument.defaultView ?? window;
            const w = this.element.offsetWidth || 520;
            const h = this.element.offsetHeight || 400;
            this.setPosition({left: (win.innerWidth - w) / 2, top: (win.innerHeight - h) / 2});
        }
    }
}
