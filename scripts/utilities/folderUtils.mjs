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
export default {
    createFolder
};