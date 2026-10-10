import {summonUtils} from '../utilities/_module.mjs';
function renderCombatTracker(app, html, data) {
    const combatantRows = html.querySelectorAll('.combatant');
    combatantRows.forEach(combatantRow => {
        const combatantId = combatantRow.dataset.combatantId;
        const combatant = app.viewed.combatants.get(combatantId);
        if (!combatant?.actor) return;
        const summonData = summonUtils.getSummonData(combatant.actor);
        const isFollowerSummon = summonData?.initiative === 'follows';
        if (!isFollowerSummon) return;
        const ownerActor = summonData.owner;
        if (ownerActor) {
            const ownerCombatant = app.viewed.getCombatantsByActor(ownerActor)[0];
            if (ownerCombatant && ownerCombatant.initiative !== null) return; 
        }
        const rollButton = combatantRow.querySelector(".combatant-control[data-action='rollInitiative']");
        if (rollButton) rollButton.remove(); 
    });
}
export default {
    renderCombatTracker
};