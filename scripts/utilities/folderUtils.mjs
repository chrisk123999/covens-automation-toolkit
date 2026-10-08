import {queryUtils} from './_module.mjs';
/**
 * Create a folder through a GM, since players cannot create them.
 * @param {object} folderData Folder creation data.
 * @returns {Promise<foundry.documents.Folder|undefined>} Undefined if the GM did not create it.
 */
async function createFolder(folderData) {
    const id = await queryUtils.query('createFolder', queryUtils.gmUser(), {folderData});
    return game.folders.get(id);
}
/**
 * World actors in a folder with this name, followed by actors in same-named folders of every Actor compendium.
 * @param {string} folderName Folder name to match.
 * @returns {Promise<foundry.documents.Actor[]>}
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