import {automationUtils} from '../utilities/_module.mjs';
const packIds = new Set();
async function updateHash(item) {
    const compendiumId = item.compendium?.metadata?.id;
    if (!compendiumId) return;
    if (!packIds.has(compendiumId)) return;
    const hash = automationUtils.getDocumentHash(item);
    const oldHash = automationUtils.getStoredHash(item);
    if (hash === oldHash) return;
    await automationUtils.setDocumentHash(item, hash);
}
function addHashedCompendium(compendium) {
    packIds.add(compendium.metadata.id);
}
function removeHashedCompendium(compendium) {
    packIds.delete(compendium.metadata.id);
}
async function hashCompendium(compendium) {
    await compendium.getDocuments();
    await Promise.all(compendium.contents.map(async item => {
        const hash = automationUtils.getDocumentHash(item);
        const oldHash = automationUtils.getStoredHash(item);
        if (hash === oldHash) return;
        await automationUtils.setDocumentHash(item, hash);
    }));
}
export default {
    updateHash,
    addHashedCompendium,
    removeHashedCompendium,
    hashCompendium
};