function register() {
    CONFIG.Token.movement.actions.catForce = {
        label: 'CAT.Movement.Forced',
        icon: 'fa-solid fa-explosion',
        measure: false,
        canSelect: false,
        terrainAction: null,
        costMultiplier: 0
    };
}
export default {
    register
};