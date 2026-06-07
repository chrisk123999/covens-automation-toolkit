import {summonEvents} from '../events/_module.mjs';
import {actorUtils, folderUtils, genericUtils, documentUtils, crosshairUtils} from '../utilities/_module.mjs';
export class SummonsManager {
    constructor() {
        this.summons = new Map();
    }
    static create() {
        const manager = new SummonsManager();
        manager.#init();
        return manager;
    }
    async #init() {
        const existingSummons = game.actors.filter(actor => actor.flags.cat?.summon);
        const resolvedSummons = (await Promise.all(existingSummons.map(async actor => {
            const summonData = actor.flags.cat.summon;
            const owner = await fromUuid(summonData.owner);
            const sourceActor = await fromUuid(summonData.sourceActor);
            const created = summonData.created;
            const duration = summonData.duration;
            if (!owner || !sourceActor || !created) return;
            return new Summon(owner, sourceActor, created, {actor, duration});
        }))).filter(Boolean);
        resolvedSummons.forEach(summon => this.summons.set(summon.actor.id, summon));
    }
    async getRootFolder() {
        let folder = game.folders.find(f => f.flags.cat?.summonFolder && f.type === 'Actor');
        if (!folder) {
            folder = await folderUtils.createFolder({
                name: _loc('CAT.Summons.SummonFolder'),
                type: 'Actor',
                'flags.cat.summonFolder': true
            });
        }
        return folder;
    }
    async getOwnerFolder(actor) {
        const rootFolder = await this.getRootFolder();
        let folder = game.folders.find(f => f.flags.cat?.summonOwner === actor.uuid && f.type === 'Actor');
        if (!folder) {
            folder = await folderUtils.createFolder({
                name: actor.name,
                type: 'Actor',
                folder: rootFolder.id,
                'flags.cat.summonOwner': actor.uuid
            });
        }
        return folder;
    }
    async prepareSidebarActor(summon, created = game.time.worldTime, {avatar, token, name, updates} = {}) {
        const actorData = summon.sourceActor.toObject();
        delete actorData._id;
        delete actorData.sort;
        updates ??= {};
        if (avatar) actorData.img = avatar;
        if (token) genericUtils.setProperty(actorData, 'prototypeToken.texture.src', token);
        if (name) {
            actorData.name = name;
            genericUtils.setProperty(actorData, 'prototypeToken.name', name);
        }
        await summonEvents.preCreate(summon, updates);
        genericUtils.mergeObject(actorData, updates);
        genericUtils.setProperty(actorData, 'prototypeToken.actorLink', true);
        actorData.ownership = summon.owner.toObject().ownership;
        actorData.folder = (await this.getOwnerFolder(summon.owner)).id;
        genericUtils.setProperty(actorData, 'flags.cat.summon', {
            owner: summon.owner.uuid,
            sourceActor: summon.sourceActor.uuid,
            created,
            duration: summon.duration
        });
        return await actorUtils.createActor(actorData);
    }
    async createSummon(ownerActor, sourceActor, created = game.time.worldTime, options = {}) {
        const summon = new Summon(ownerActor, sourceActor, options);
        summon.actor = await this.prepareSidebarActor(summon, created, options);
        this.summons.set(summon.actor.id, summon);
        await summonEvents.create(summon);
        return summon;
    }
    async deleteSummon(summon) {
        if (!summon.actor) return;
        await summonEvents.preDelete(summon);
        const actorId = summon.actor.id;
        await Promise.all(game.scenes.map(scene => {
            const tokenIds = scene.tokens.filter(token => token.actorId === actorId).map(token => token.id);
            if (!tokenIds.length) return;
            return documentUtils.deleteEmbeddedDocuments(scene, 'Token', tokenIds);
        }).filter(Boolean));
        await documentUtils.deleteDocument(summon.actor);
        this.summons.delete(actorId);
    }
    async checkDurations(worldTime) {
        const expiredSummons = [];
        this.summons.forEach(summon => {
            if (!summon.duration) return;
            if (summon.getTimeRemaining(worldTime) > 0) return;
            expiredSummons.push(summon);
        });
        if (!expiredSummons.length) return;
        await Promise.all(expiredSummons.map(summon => this.deleteSummon(summon)));
    }
    async placeSummon(summon, range) {
        const sourceToken = actorUtils.getFirstToken(summon.owner);
        if (!sourceToken) return;
        const summonImg = summon.actor.prototypeToken.texture.src;
        const summonWidth = summon.actor.prototypeToken.width;
        const crosshairConfig = {
            icon: summonImg,
            size: (summonWidth * sourceToken.scene.dimensions.distance) / 2
        };
        const result = await crosshairUtils.aimCrosshair({
            token: sourceToken,
            maxRange: range,
            centerpoint: sourceToken.center,
            crosshairsConfig: crosshairConfig
        });
        if (!result || result.cancelled) return;
        const token = await summon.actor.getTokenDocument({
            x: result.x,
            y: result.y
        });
        return (await documentUtils.createEmbeddedDocuments(sourceToken.scene, 'Token', [token.toObject()]))?.[0];
    }
    async removeSummon(summon) {
        if (!summon.token) return;
        await summonEvents.remove(summon);
        await documentUtils.deleteDocument(summon.token);
    }
}
export class Summon {
    constructor(owner, sourceActor, created, {actor, duration} = {}) {
        this.sourceActor = sourceActor;
        this.owner = owner;
        this.actor = actor;
        this.created = created;
        this.duration = duration;
    }
    get token() {
        return actorUtils.getFirstToken(this.actor);
    }
    get folder() {
        return this.actor?.folder;
    }
    getTimeRemaining(worldTime) {
        if (!this.duration) return Infinity;
        return this.created + this.duration - worldTime;
    }
}