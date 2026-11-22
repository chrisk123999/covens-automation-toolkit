/**
 * Folder creation and folder contents across the world and Actor compendiums.
 * @module
 */
import {queryUtils} from './_module.mjs';
/**
 * Create a folder through the GM client from {@link queryUtils.gmUser}, even when the caller is the GM. Throws if the
 * query fails or times out.
 * @param {object} folderData                              Folder creation data.
 * @returns {Promise<foundry.documents.Folder|undefined>}  Undefined if the created folder is not found on this client.
 * @example
 * const folder = await folderUtils.createFolder({name: 'CAT Summons', type: 'Actor'});
 */
async function createFolder(folderData) {
    const id = await queryUtils.query('createFolder', queryUtils.gmUser(), {folderData});
    return game.folders.get(id);
}
/**
 * Get the world actors in any folder with this name, followed by the actors in same-named folders of every Actor
 * compendium. Compendium actors are loaded in full. Only the folder's own contents count, not subfolders.
 * @param {string} folderName  Folder name to match.
 * @returns {Promise<foundry.documents.Actor[]>}
 * @example
 * const summons = await folderUtils.getActorsInFolder('Find Familiar');
 */
async function getActorsInFolder(folderName) {
    const actors = game.actors.filter(actor => actor.folder?.name === folderName);
    const packActors = await Promise.all(game.packs.filter(pack => pack.documentName === 'Actor').map(async pack => {
        const folderIds = pack.folders.filter(packFolder => packFolder.name === folderName).map(packFolder => packFolder.id);
        if (!folderIds.length) return [];
        const index = await pack.getIndex();
        return Promise.all(index.filter(entry => folderIds.includes(entry.folder)).map(entry => fromUuid(entry.uuid)));
    }));
    return actors.concat(...packActors);
}
export default {
    createFolder,
    getActorsInFolder
};