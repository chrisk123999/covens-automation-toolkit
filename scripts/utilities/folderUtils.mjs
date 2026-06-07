import {queryUtils} from './_module.mjs';
async function createFolder(folderData) {
    const id = await queryUtils.query('createFolder', queryUtils.gmUser(), {folderData});
    return game.folders.get(id);
}
export default {
    createFolder
};