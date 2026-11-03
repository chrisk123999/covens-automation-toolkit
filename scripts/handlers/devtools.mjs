const markerId = 'cat-devtools-marker';
const devtoolSettings = ['displayDebugLogs', 'displayDebugEventData'];
function refresh() {
    document.getElementById(markerId)?.remove();
    if (!game.user?.isGM || !devtoolSettings.some(key => game.settings.get('cat', key))) return;
    const marker = document.createElement('button');
    marker.id = markerId;
    marker.type = 'button';
    marker.innerHTML = `<i class="fas fa-tools"></i> ${_loc('CAT.Devtools.Marker')}`;
    marker.dataset.tooltip = 'CAT.Devtools.MarkerHint';
    marker.addEventListener('click', () => new (game.settings.menus.get('cat.devtools').type)().render(true));
    document.getElementById('hotbar').before(marker);
}
export default {
    refresh
};
