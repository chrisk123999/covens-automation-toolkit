import uiUtils from '../utilities/uiUtils.mjs';
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

export default class CatApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        actions: {toggleDetach: uiUtils.onToggleDetach}
    };

    static REMEMBER_POSITION = true;

    static INITIAL_SIZE = {width: 400, height: 300};

    static HEADER_PART = {template: 'modules/cat/templates/shared/header.hbs'};
    static FOOTER_PART = {template: 'modules/cat/templates/shared/footer.hbs'};

    get closeAction() {
        return 'close';
    }

    get detachable() {
        return false;
    }

    get footerButtons() {
        return [];
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        return {
            ...context,
            title: this.title,
            buttons: this.footerButtons,
            detachable: this.detachable,
            closeAction: this.closeAction,
            ...uiUtils.detachContext(this, options)
        };
    }

    _initializeApplicationOptions(options) {
        const initialized = super._initializeApplicationOptions(options);
        if (this.constructor.REMEMBER_POSITION) uiUtils.applyStoredWindowPosition(initialized);
        return initialized;
    }

    _onPosition(position) {
        super._onPosition(position);
        if (this.constructor.REMEMBER_POSITION) uiUtils.rememberWindowPosition(this, position);
    }

    async _preClose(options) {
        options.animate = false;
        await uiUtils.fadeOut(this.element);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        uiUtils.enableWindowDrag(this);
        if (options.isFirstRender) {
            this.bringToFront();
            uiUtils.centerWindow(this, this.constructor.INITIAL_SIZE);
        }
    }
}
