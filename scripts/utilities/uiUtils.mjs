/**
 * Window placement, dragging and detaching for CAT's application windows, plus html enrichment and popover positioning.
 * @module
 */
/**
 * The sidebar icon class for the document type a uuid points at, for use when a document has no image. Embedded uuids
 * use the type of their top-level document.
 * @param {string} value   A document uuid.
 * @returns {string|null}  A Font Awesome class string. Null when the uuid is missing or its type has no icon.
 * @example
 * uiUtils.fallbackIcon(item.uuid); // CONFIG.Actor.sidebarIcon for an actor's item
 */
function fallbackIcon(value) {
    if (!value) return null;
    const parsed = foundry.utils.parseUuid?.(value);
    const type = parsed?.primaryType ?? parsed?.documentType;
    return type ? CONFIG[type]?.sidebarIcon : null;
}
/**
 * Add the `is-closing` class to an element and resolve when its CSS transition ends. Does not remove the element.
 * @param {HTMLElement} element  Element to fade. Resolves at once without one.
 * @param {number} [timeout]     Milliseconds to wait before resolving anyway, if no transition fires. Defaults to 250.
 * @returns {Promise<void>}
 * @example
 * await uiUtils.fadeOut(this.element);
 */
async function fadeOut(element, timeout = 250) {
    if (!element) return;
    element.classList.add('is-closing');
    await new Promise(resolve => {
        const done = () => { element.removeEventListener('transitionend', done); resolve(); };
        element.addEventListener('transitionend', done, {once: true});
        setTimeout(done, timeout);
    });
}

/**
 * Read a window's remembered position from CAT's Window Positions setting, keyed by the application id. Windows with a
 * `{id}` placeholder in their id are never remembered.
 * @param {object} options  Application options, or the initial options being built.
 * @returns {{left: number, top: number, width: number, height: number}|undefined}
 *                          Undefined when nothing is stored.
 * @example
 * if (uiUtils.storedWindowPosition(this.options)) return;
 */
function storedWindowPosition(options) {
    const key = windowPositionKey(options);
    return key ? game.settings.get('cat', 'windowPositions')?.[key] : undefined;
}
/**
 * The key a window's position is stored under, or null when each instance is its own window.
 * @param {object} options  Application options.
 * @returns {string|null}
 */
function windowPositionKey(options) {
    const id = options?.id;
    return id && !id.includes('{id}') ? id : null;
}
/**
 * Copy a remembered position from {@link storedWindowPosition} onto a window's initial options. Width and height set to
 * `'auto'` stay auto.
 * @param {object} options  Initial application options, mutated in place.
 * @example
 * _initializeApplicationOptions(options) {
 *     const initialized = super._initializeApplicationOptions(options);
 *     uiUtils.applyStoredWindowPosition(initialized);
 *     return initialized;
 * }
 */
function applyStoredWindowPosition(options) {
    const stored = storedWindowPosition(options);
    if (!stored) return;
    const position = options.position;
    if (Number.isFinite(stored.left)) position.left = stored.left;
    if (Number.isFinite(stored.top)) position.top = stored.top;
    if (Number.isFinite(stored.width) && position.width !== 'auto') position.width = stored.width;
    if (Number.isFinite(stored.height) && position.height !== 'auto') position.height = stored.height;
}
/**
 * Save a window's position to the Window Positions setting, debounced by half a second so a drag writes once.
 * @param {foundry.applications.api.ApplicationV2} app  Application to remember.
 * @param {object} position                             Current application position.
 * @internal
 */
const rememberWindowPosition = foundry.utils.debounce((app, position) => {
    const key = windowPositionKey(app.options);
    if (!key) return;
    const {left, top, width, height} = position;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    const all = {...game.settings.get('cat', 'windowPositions')};
    all[key] = {left, top, width, height};
    game.settings.set('cat', 'windowPositions', all);
}, 500);
/**
 * Let a rendered application be dragged by any element inside it, such as a custom header. Wires the app element once,
 * so later renders do nothing. Does nothing when the app is not rendered or the handle is missing.
 * @param {foundry.applications.api.ApplicationV2} app  Application to make draggable.
 * @param {string} [handleSelector]                     CSS selector for the drag handle within the app. Defaults to the
 *                                                      app's direct `header` child.
 * @param {object} [options]                            Additional options.
 * @param {string} [options.ignore]                     CSS selector for descendants that do not start a drag. Defaults
 *                                                      to buttons, links, form fields and actions.
 * @param {boolean} [options.resizable]                 Add a corner grabber that resizes the window. Defaults to true.
 * @example
 * _onRender(context, options) {
 *     uiUtils.enableWindowDrag(this, '.window-title');
 * }
 */
function enableWindowDrag(app, handleSelector = ':scope > header', {ignore = 'button, a, input, select, textarea, [data-action], cat-multi-combobox, multi-select, .resize-handle', resizable = true} = {}) {
    const element = app.element;
    if (!element || element.dataset.dragWired === '1' || !element.querySelector(handleSelector)) return;
    element.dataset.dragWired = '1';
    if (resizable && !element.querySelector(':scope > .resize-handle')) {
        const grabber = document.createElement('div');
        grabber.className = 'resize-handle';
        grabber.setAttribute('aria-label', _loc('CAT.Generic.Resize'));
        element.append(grabber);
    }
    app._onResize ??= () => {};
    const drag = new foundry.applications.ux.Draggable.implementation(app, element, element, resizable ? {selector: ':scope > .resize-handle'} : false);
    element.classList.remove('draggable', 'resizable');
    const orig = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = event => {
        if (!element.querySelector(handleSelector)?.contains(event.target)) return;
        if (event.target.closest(ignore)) return;
        orig(event);
    };
}
/**
 * Detach an application into its own browser window sized to match it, or re-attach it when it is already detached.
 * Then re-renders the header so the detach button updates.
 * @param {foundry.applications.api.ApplicationV2} app  Application to detach or attach.
 * @returns {Promise<*>}                                The header render.
 * @example
 * await uiUtils.toggleDetached(app);
 */
async function toggleDetached(app) {
    if (app.window.windowId) await app.attachWindow();
    else {
        const rect = app.element.getBoundingClientRect();
        const chromeWidth = (window.outerWidth - window.innerWidth) || 16;
        const chromeHeight = (window.outerHeight - window.innerHeight) || 80;
        await app.detachWindow({position: {
            width: Math.round(rect.width) + chromeWidth,
            height: Math.round(rect.height) + chromeHeight
        }});
    }
    return app.render({parts: ['header']});
}
/**
 * The `toggleDetach` action handler every CAT window registers.
 * @this {foundry.applications.api.ApplicationV2}
 * @returns {Promise<*>}
 * @internal
 */
function onToggleDetach() {
    return toggleDetached(this);
}
/**
 * Whether a window is detached into its own browser window. A pending attach or detach in the render options wins over
 * the current state.
 * @param {foundry.applications.api.ApplicationV2} app  Application to check.
 * @param {object} [options]                            Render options.
 * @returns {boolean}
 * @example
 * const detached = uiUtils.isDetached(this, options);
 */
function isDetached(app, options) {
    if (options?.window?.attach) return false;
    if (options?.window?.detach) return true;
    return !!app.window.windowId;
}
/**
 * Render context for the detach header button, with a label and icon matching {@link isDetached}.
 * @param {foundry.applications.api.ApplicationV2} app   Application to check.
 * @param {object} [options]                             Render options.
 * @returns {{detachLabel: string, detachIcon: string}}  An unlocalized label key and a Font Awesome icon class.
 * @example
 * Object.assign(context, uiUtils.detachContext(this, options));
 */
function detachContext(app, options) {
    const detached = isDetached(app, options);
    return {
        detachLabel: detached ? 'APPLICATION.ACTIONS.Attach' : 'APPLICATION.ACTIONS.Detach',
        detachIcon: detached ? 'fa-arrow-down-to-square' : 'fa-arrow-up-right-from-square'
    };
}
/**
 * Raise an application above the other windows and make it `ui.activeWindow`.
 * @param {foundry.applications.api.ApplicationV2} app  Application to raise. Ignored if it is not rendered.
 * @example
 * uiUtils.bringToFront(actor.sheet);
 */
function bringToFront(app) {
    if (!app.element) return;
    app.position.zIndex = ++foundry.applications.api.ApplicationV2._maxZ;
    app.element.style.zIndex = String(app.position.zIndex);
    ui.activeWindow = app;
}
/**
 * Center an application in the browser window it is shown in.
 * @param {foundry.applications.api.ApplicationV2} app  Application to center. Ignored if it is not rendered.
 * @param {object} [options]                            Additional options.
 * @param {number} [options.width]                      Fallback width, used before the element has been laid out.
 * @param {number} [options.height]                     Fallback height, used before the element has been laid out.
 * @example
 * uiUtils.centerWindow(app, {width: 400, height: 300});
 */
function centerWindow(app, {width = 0, height = 0} = {}) {
    if (!app.element) return;
    const win = app.element.ownerDocument.defaultView ?? window;
    const w = app.element.offsetWidth || width;
    const h = app.element.offsetHeight || height;
    app.setPosition({left: (win.innerWidth - w) / 2, top: (win.innerHeight - h) / 2});
}

/**
 * Enrich html with Foundry's `TextEditor.enrichHTML`, resolving links, inline rolls and system enrichers.
 * @param {string} html        Html to enrich, such as an item description.
 * @param {object} [rollData]  Roll data for `@` references in formulas.
 * @returns {Promise<string>}  Enriched html.
 * @example
 * const description = await uiUtils.enrichHTML(item.system.description.value, item.getRollData());
 */
async function enrichHTML(html, rollData) {
    return await foundry.applications.ux.TextEditor.enrichHTML(html, {rollData});
}
/**
 * Whether the current user may see the DC of a save imposed by this actor, as decided by Midi-QOL's
 * `shouldDisplaySaveDC`.
 * @param {foundry.documents.Actor} [actor]  Actor imposing the save.
 * @returns {boolean}
 * @example
 * const label = uiUtils.showDC(token.actor) ? 'DC ' + dc : '';
 */
function showDC(actor) {
    return MidiQOL.shouldDisplaySaveDC(actor);
}
/**
 * Keep a popover directly under its anchor and the same width, checking every animation frame until stopped. Sets the
 * popover's `left`, `top` and `width` styles in pixels.
 * @param {HTMLElement} anchor   Element to sit under.
 * @param {HTMLElement} popover  Element to position.
 * @param {Function} onDetached  Called once when the anchor leaves the document, which also stops following.
 * @returns {Function}           Call to stop following.
 * @example
 * const stopFollow = uiUtils.followAnchor(input, list, () => list.remove());
 */
function followAnchor(anchor, popover, onDetached) {
    const view = anchor.ownerDocument.defaultView;
    let frame;
    let last;
    const step = () => {
        if (!anchor.isConnected) return onDetached();
        const {left, bottom, width} = anchor.getBoundingClientRect();
        const key = left + ',' + bottom + ',' + width;
        if (key !== last) {
            last = key;
            Object.assign(popover.style, {left: left + 'px', top: bottom + 'px', width: width + 'px'});
        }
        frame = view.requestAnimationFrame(step);
    };
    step();
    return () => view.cancelAnimationFrame(frame);
}
/**
 * Minimize every rendered window that is not already minimized, skipping unpositioned ones such as the sidebar.
 * @returns {Promise<Function>}  Call to restore the windows this minimized.
 * @example
 * const restoreWindows = await uiUtils.minimizeWindows();
 * // Let the player pick a spot on the canvas
 * await restoreWindows();
 */
async function minimizeWindows() {
    const windows = [...foundry.applications.instances.values(), ...Object.values(ui.windows)]
        .filter(app => app.rendered && !(app.minimized ?? app._minimized) && app.options?.window?.positioned !== false);
    await Promise.all(windows.map(app => app.minimize()));
    return () => Promise.all(windows.map(app => app.maximize()));
}
export default {
    followAnchor,
    minimizeWindows,
    fallbackIcon,
    fadeOut,
    enableWindowDrag,
    toggleDetached,
    onToggleDetach,
    isDetached,
    detachContext,
    storedWindowPosition,
    applyStoredWindowPosition,
    rememberWindowPosition,
    bringToFront,
    centerWindow,
    enrichHTML,
    showDC
};
