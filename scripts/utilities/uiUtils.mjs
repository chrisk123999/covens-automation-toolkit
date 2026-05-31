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
export default {
    fallbackIcon,
    fadeOut
};
