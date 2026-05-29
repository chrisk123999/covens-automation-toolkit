/** @import Item5e from "../../dnd5e/module/documents/item.mjs" */

import {documentUtils} from './_module.mjs';

/**
 * Returns the DC of the first Save activity on an item, otherwise the save DC of the appropriate ability on the item, otherwise 10
 * @param {Item5e} item 
 * @returns {number}
 */
function getSaveDC(item) {
    if (item.hasSave) return item.system.activities.getByType('save')[0].save.dc.value;
    return item.actor?.system?.abilities?.[item.abilityMod]?.dc ?? item?.actor?.system?.attributes?.spell?.dc ?? 10;
}
function getSavedCastData(item) {
    return {
        castLevel: item.flags.cat?.castData?.castLevel ?? -1,
        baseLevel: item.flags.cat?.castData?.baseLevel ?? -1,
        saveDC: getSaveDC(item)
    };
}
function getActivityByIdentifier(item, identifier) {
    return item.system.activities.find(activity => activity.identifier === identifier);
}
async function syntheticItem(itemData, actor) {
    let item = new CONFIG.Item.documentClass(itemData, {parent: actor});
    item.prepareData();
    item.prepareFinalAttributes();
    item.applyActiveEffects();
    return item;
}
export default {
    getSaveDC,
    getSavedCastData,
    getActivityByIdentifier,
    syntheticItem
};