function renderSourceConfig(app, element, item, options) {
    const select = element.querySelector("select[name='system.source.rules'], select[name='rules']");
    if (!select) return;
    const option = document.createElement('option');
    option.value = 'all';
    option.text = 'All';
    select.appendChild(option);
    if (app.document.system.source.rules === 'all') option.selected = true;
}
export default {
    renderSourceConfig
};