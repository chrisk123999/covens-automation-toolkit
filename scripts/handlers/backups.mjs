import {genericUtils, queryUtils} from '../utilities/_module.mjs';
function getPack({warn = true} = {}) {
    const pack = game.packs.get(game.settings.get('cat', 'backupCompendium'));
    if (!pack && warn) genericUtils.notify('CAT.Backups.MissingPack', {type: 'warn'});
    return pack;
}
async function whisper(title, names) {
    await ChatMessage.create({
        speaker: {alias: _loc('CAT.Backups.Title')},
        whisper: ChatMessage.getWhisperRecipients('GM').map(user => user.id),
        content: `<p><strong>${_loc(title)}</strong></p><ul>${names.map(name => `<li>${name}</li>`).join('')}</ul>`
    });
}
async function backupActors(actors, pack, {progress = false} = {}) {
    const time = Date.now();
    const name = new Date(time).toDateInputString();
    const folder = pack.folders.getName(name) ?? await Folder.create({name, type: 'Actor'}, {pack: pack.collection});
    const bar = progress ? genericUtils.notify('CAT.Backups.Started', {progress: true}) : null;
    let done = 0;
    for (const actor of actors) {
        const actorData = actor.toObject();
        delete actorData._id;
        actorData.folder = folder.id;
        genericUtils.setProperty(actorData, 'flags.cat.backup', {time, actorId: actor.id});
        await Actor.create(actorData, {pack: pack.collection});
        done++;
        bar?.update({pct: done / actors.length, message: _loc('CAT.Backups.Progress', {done, total: actors.length, name: actor.name})});
    }
    if (bar) {
        bar.update({pct: 1});
        genericUtils.notify('CAT.Backups.Done', {type: 'success', format: {total: actors.length}});
    }
}
async function prune(pack, now) {
    const retention = game.settings.get('cat', 'backupRetention');
    if (!retention) return;
    const index = await pack.getIndex({fields: ['flags.cat.backup']});
    const expired = index.filter(entry => entry.flags?.cat?.backup?.time + retention <= now);
    if (expired.length) {
        await Actor.deleteDocuments(expired.map(entry => entry._id), {pack: pack.collection});
        await whisper('CAT.Backups.Deleted', expired.map(entry => entry.name));
    }
    const empty = pack.folders.filter(folder => !folder.contents.length);
    if (empty.length) await Folder.deleteDocuments(empty.map(folder => folder.id), {pack: pack.collection});
}
async function startup() {
    if (!game.settings.get('cat', 'automaticBackups') || !queryUtils.isTheGM()) return;
    const pack = getPack();
    if (!pack) return;
    const now = Date.now();
    if (game.settings.get('cat', 'backupTime') + game.settings.get('cat', 'backupFrequency') <= now) {
        const actors = game.actors.filter(actor => actor.type === 'character' && actor.hasPlayerOwner);
        if (actors.length) {
            await backupActors(actors, pack, {progress: true});
            await game.settings.set('cat', 'backupTime', now);
            await whisper('CAT.Backups.Created', actors.map(actor => actor.name));
        }
    }
    await prune(pack, now);
}
async function backupActor(actor) {
    const pack = getPack();
    if (!pack) return false;
    await backupActors([actor], pack);
    genericUtils.notify('CAT.Backups.BackedUp', {type: 'success', format: {name: actor.name}});
    return true;
}
async function getBackups(actor) {
    const pack = getPack({warn: false});
    if (!pack) return null;
    const index = await pack.getIndex({fields: ['flags.cat.backup']});
    return index.filter(entry => entry.flags?.cat?.backup?.actorId === actor.id)
        .map(entry => ({id: entry._id, time: entry.flags.cat.backup.time}))
        .sort((a, b) => b.time - a.time);
}
async function restore(actor, backupId) {
    const pack = getPack();
    const backup = await pack?.getDocument(backupId);
    if (!backup) return;
    await backupActors([actor], pack);
    const data = game.actors.fromCompendium(backup);
    for (const key of Actor.metadata.preserveOnImport) delete data[key];
    delete data.flags.cat.backup;
    await actor.update(data, {diff: false, recursive: false, noHook: true});
    genericUtils.notify('CAT.Backups.Restored', {type: 'success', format: {name: actor.name, date: new Date(backup.flags.cat.backup.time).toLocaleString()}});
}
export default {
    startup,
    backupActor,
    getBackups,
    restore
};
