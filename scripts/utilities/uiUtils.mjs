/**
 * The sidebar icon for whatever document type a uuid points at, for use when a document has no image.
 * @param {string} value A document uuid.
 * @returns {string|null} Null when the uuid is missing or its type has no icon.
 */
function fallbackIcon(value) {
    if (!value) return null;
    const parsed = foundry.utils.parseUuid?.(value);
    const type = parsed?.primaryType ?? parsed?.documentType;
    return type ? CONFIG[type]?.sidebarIcon : null;
}
/**
 * Play an element's closing transition and resolve once it finishes.
 * @param {HTMLElement} element Element to fade. Nothing happens without one.
 * @param {number} [timeout] Milliseconds to wait before resolving anyway, if no transition fires.
 * @returns {Promise<void>}
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
 * Restore a window's remembered position.
 * @param {object} options Application options, or the initial options being built.
 * @returns {object|undefined} Stored {left, top, width, height}, if any.
 */
function storedWindowPosition(options) {
    const key = windowPositionKey(options);
    return key ? game.settings.get('cat', 'windowPositions')?.[key] : undefined;
}
/**
 * The key a window's position is stored under, or null when each instance is its own window.
 * @param {object} options Application options.
 * @returns {string|null}
 */
function windowPositionKey(options) {
    const id = options?.id;
    return id && !id.includes('{id}') ? id : null;
}
/**
 * Restore a remembered position onto a window's initial options, leaving auto-sized axes auto.
 * @param {object} options Initial application options, mutated in place.
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
 * Remember where a window was left, debounced so a drag writes once.
 * @param {foundry.applications.api.ApplicationV2} app Application to act on.
 * @param {object} position Current application position.
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
 * Let an application be dragged by an element that is not its header, bound to the app element so re-renders do not re-wire it.
 * @param {foundry.applications.api.ApplicationV2} app Application to make draggable.
 * @param {string} [handleSelector] CSS selector for the drag handle within the app.
 * @param {object} [options] Additional options.
 * @param {string} [options.ignore] CSS selector for descendants that should not start a drag.
 * @param {boolean} [options.resizable] Add a corner grabber that resizes the window.
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
 * Detach an application into its own popout, or re-attach it when it is already detached.
 * @param {foundry.applications.api.ApplicationV2} app Application to act on.
 * @returns {Promise<*>}
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
 */
function onToggleDetach() {
    return toggleDetached(this);
}
/**
 * Whether a window is detached, reading the pending state from the render options first.
 * @param {foundry.applications.api.ApplicationV2} app Application to act on.
 * @param {object} [options] Render options.
 * @returns {boolean}
 */
function isDetached(app, options) {
    if (options?.window?.attach) return false;
    if (options?.window?.detach) return true;
    return !!app.window.windowId;
}
/**
 * Header context for the detach button, so its label and glyph match the window's state.
 * @param {foundry.applications.api.ApplicationV2} app Application to act on.
 * @param {object} [options] Render options.
 * @returns {{detachLabel: string, detachIcon: string}}
 */
function detachContext(app, options) {
    const detached = isDetached(app, options);
    return {
        detachLabel: detached ? 'APPLICATION.ACTIONS.Attach' : 'APPLICATION.ACTIONS.Detach',
        detachIcon: detached ? 'fa-arrow-down-to-square' : 'fa-arrow-up-right-from-square'
    };
}
/**
 * Raise an application above the other windows and mark it active.
 * @param {foundry.applications.api.ApplicationV2} app Application to raise. Ignored if it is not rendered.
 */
function bringToFront(app) {
    if (!app.element) return;
    app.position.zIndex = ++foundry.applications.api.ApplicationV2._maxZ;
    app.element.style.zIndex = String(app.position.zIndex);
    ui.activeWindow = app;
}
/**
 * Centre an application in the viewport.
 * @param {foundry.applications.api.ApplicationV2} app Application to centre. Ignored if it is not rendered.
 * @param {object} [options] Additional options.
 * @param {number} [options.width] Fallback width, used before the element has been laid out.
 * @param {number} [options.height] Fallback height, used before the element has been laid out.
 */
function centerWindow(app, {width = 0, height = 0} = {}) {
    if (!app.element) return;
    const win = app.element.ownerDocument.defaultView ?? window;
    const w = app.element.offsetWidth || width;
    const h = app.element.offsetHeight || height;
    app.setPosition({left: (win.innerWidth - w) / 2, top: (win.innerHeight - h) / 2});
}

/**
 * Resolve the enrichers in a block of html so it can be displayed.
 * @param {string} html A description containing enrichers, inline rolls, and so on.
 * @param {object} [rollData] Data used to replace enrichers within a description.
 * @returns {Promise<string>} Enriched html content.
 */
async function enrichHTML(html, rollData) {
    return await foundry.applications.ux.TextEditor.enrichHTML(html, {rollData});
}
/**
 * Evaluate dnd5e's challenge visibility setting.
 * @param {foundry.documents.Actor} [actor] The actor imposing the roll.
 * @returns {boolean}
 */
function showDC(actor) {
    return MidiQOL.shouldDisplaySaveDC(actor);
}
export default {
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
