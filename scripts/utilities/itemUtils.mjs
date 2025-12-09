/** @import Item5e from "../../dnd5e/module/documents/item.mjs" */


/**
 * Returns the DC of the first Save activity on an item, otherwise the save DC of the appropriate ability on the item, otherwise 10
 * @param {Item5e} item 
 * @returns {number}
 */
function getSaveDC(item) {
    if (item.hasSave) return item.system.activities.getByType('save')[0].save.dc.value;
    return item.actor?.system?.abilities?.[item.abilityMod]?.dc ?? 10;
}
export const itemUtils = {
    getSaveDC
};