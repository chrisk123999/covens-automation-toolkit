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
 * Let an application be dragged by an element that is not its header, ignoring interactive controls inside it.
 * @param {foundry.applications.api.ApplicationV2} app Application to make draggable.
 * @param {string} handleSelector CSS selector for the drag handle within the app.
 * @param {object} [options] Additional options.
 * @param {string} [options.ignore] CSS selector for descendants that should not start a drag.
 */
function enableWindowDrag(app, handleSelector, {ignore = 'button, a, input, select, textarea, [data-action]'} = {}) {
    const handle = app.element?.querySelector(handleSelector);
    if (!handle || handle.dataset.dragWired === '1') return;
    handle.dataset.dragWired = '1';
    const drag = new foundry.applications.ux.Draggable.implementation(app, app.element, handle, false);
    const orig = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = event => {
        if (event.target.closest(ignore)) return;
        orig(event);
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
    bringToFront,
    centerWindow,
    enrichHTML,
    showDC
};
