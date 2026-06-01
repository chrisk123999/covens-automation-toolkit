function fallbackIcon(value) {
    if (!value) return null;
    const parsed = foundry.utils.parseUuid?.(value);
    const type = parsed?.primaryType ?? parsed?.documentType;
    return type ? CONFIG[type]?.sidebarIcon : null;
}
async function fadeOut(element, timeout = 250) {
    if (!element) return;
    element.classList.add('is-closing');
    await new Promise(resolve => {
        const done = () => { element.removeEventListener('transitionend', done); resolve(); };
        element.addEventListener('transitionend', done, {once: true});
        setTimeout(done, timeout);
    });
}
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
function bringToFront(app) {
    if (!app.element) return;
    app.position.zIndex = ++foundry.applications.api.ApplicationV2._maxZ;
    app.element.style.zIndex = String(app.position.zIndex);
    ui.activeWindow = app;
}
function centerWindow(app, {width = 0, height = 0} = {}) {
    if (!app.element) return;
    const win = app.element.ownerDocument.defaultView ?? window;
    const w = app.element.offsetWidth || width;
    const h = app.element.offsetHeight || height;
    app.setPosition({left: (win.innerWidth - w) / 2, top: (win.innerHeight - h) / 2});
}
export default {
    fallbackIcon,
    fadeOut,
    enableWindowDrag,
    bringToFront,
    centerWindow
};
