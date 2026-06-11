import {summonEvents} from '../events/_module.mjs';
import {actorUtils, folderUtils, genericUtils, documentUtils, crosshairUtils, animationUtils} from '../utilities/_module.mjs';
import {constants} from './_module.mjs';
export class SummonsManager {
    #summons = new Map();
    static #manager;
    static create() {
        if (this.#manager) return this.#manager;
        const newManager = new SummonsManager();
        newManager.#init().catch(err => console.error(err));
        this.#manager = newManager;
        return this.#manager;
    }
    get summons() {
        return [...this.#summons.values()];
    }
    async #init() {
        const existingSummons = game.actors.filter(actor => actor.flags.cat?.summon);
        const resolvedSummons = (await Promise.all(existingSummons.map(async actor => {
            const summonData = actor.flags.cat.summon;
            const owner = await fromUuid(summonData.owner);
            const sourceActor = await fromUuid(summonData.sourceActor);
            const created = summonData.created;
            const duration = summonData.duration;
            const animation = summonData.animation;
            const sourceDocument = summonData.sourceDocument ? await fromUuid(summonData.sourceDocument) : undefined;;
            const parent = summonData.parent ? await fromUuid(summonData.parent) : undefined;
            const sounds = summonData.sounds;
            if (!owner || !sourceActor || created === undefined) return;
            return new Summon(owner, sourceActor, created, {actor, duration, animation, parent, sourceDocument, sounds});
        }))).filter(Boolean);
        resolvedSummons.forEach(summon => this.#summons.set(summon.actor.id, summon));
    }
    async #getRootFolder() {
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
    async #getOwnerFolder(actor) {
        const rootFolder = await this.#getRootFolder();
        if (rootFolder.depth >= CONST.FOLDER_MAX_DEPTH) return rootFolder;
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
    async #prepareSidebarActor(summon, created = game.time.worldTime, {avatarImg, tokenImg, name, updates, animation, disposition, sourceDocument, sounds} = {}) {
        const actorData = summon.sourceActor.toObject();
        delete actorData._id;
        delete actorData.sort;
        updates ??= {};
        sounds ??= {};
        if (avatarImg) actorData.img = avatarImg;
        if (tokenImg) genericUtils.setProperty(actorData, 'prototypeToken.texture.src', tokenImg);
        if (name) {
            actorData.name = name;
            genericUtils.setProperty(actorData, 'prototypeToken.name', name);
        }
        disposition ??= actorUtils.getFirstToken(summon.owner)?.disposition ?? summon.owner.prototypeToken.disposition;
        genericUtils.setProperty(actorData, 'prototypeToken.disposition', disposition);
        await summonEvents.preCreate(summon, updates);
        genericUtils.mergeObject(actorData, updates);
        genericUtils.setProperty(actorData, 'prototypeToken.actorLink', true);
        actorData.ownership = summon.owner.toObject().ownership;
        actorData.folder = (await this.#getOwnerFolder(summon.owner)).id;
        genericUtils.setProperty(actorData, 'flags.cat.summon', {
            owner: summon.owner.uuid,
            sourceActor: summon.sourceActor.uuid,
            created,
            duration: summon.duration,
            animation,
            parent: summon.parent?.uuid,
            sourceDocument: sourceDocument?.uuid,
            sounds
        });
        return await actorUtils.createActor(actorData);
    }
    async createSummon(ownerActor, sourceActor, created = game.time.worldTime, options = {}) {
        const summon = new Summon(ownerActor, sourceActor, created, options);
        summon.actor = await this.#prepareSidebarActor(summon, created, options);
        this.#summons.set(summon.actor.id, summon);
        if (options.parent) await documentUtils.makeDependent(options.parent, [summon.actor]);
        await summonEvents.create(summon);
        return summon;
    }
    async deleteSummon(summon) {
        if (!summon.actor) return;
        await summonEvents.preDelete(summon);
        const actorId = summon.actor.id;
        await Promise.all(game.scenes.map(async scene => {
            const tokenIds = scene.tokens.filter(token => token.actorId === actorId).map(token => token.id);
            if (!tokenIds.length) return;
            if (scene === canvas?.scene) {
                const tokens = actorUtils.getTokens(summon.actor);
                return Promise.all(tokens.map(token => this.removeSummon(summon, {token})));
            } else {
                return documentUtils.deleteEmbeddedDocuments(scene, 'Token', tokenIds, {options: {cat: {summonRemove: true}}});
            }
        }));
        await documentUtils.deleteDocument(summon.actor, {options: {cat: {summonDelete: true}}});
        const ownerFolder = game.folders.find(folder => folder.flags?.cat?.summonOwner === summon.owner.uuid && folder.type === 'Actor');
        if (ownerFolder && !ownerFolder.contents.length) await documentUtils.deleteDocument(ownerFolder, {forceGM: true});
        await summonEvents.deleted(summon);
        this.#summons.delete(actorId);
    }
    async checkDurations(worldTime) {
        const expiredSummons = [];
        this.#summons.forEach(summon => {
            if (!summon.duration) return;
            if (summon.getTimeRemaining(worldTime) > 0) return;
            expiredSummons.push(summon);
        });
        if (!expiredSummons.length) return;
        await Promise.all(expiredSummons.map(summon => this.deleteSummon(summon)));
    }
    async placeSummon(summon, range, {token} = {}) {
        token ??= actorUtils.getFirstToken(summon.owner);
        if (!token) return;
        const summonImg = summon.actor.prototypeToken.texture.src;
        const summonWidth = summon.actor.prototypeToken.width;
        const summonHeight = summon.actor.prototypeToken.height;
        const crosshairConfig = {
            icon: summonImg,
            size: (summonWidth * token.scene.dimensions.distance) / 2
        };
        const result = await crosshairUtils.aimCrosshair({
            token,
            maxRange: range,
            centerpoint: token.center,
            crosshairsConfig: crosshairConfig
        });
        if (!result || result.cancelled) return;
        result.x -= (summonWidth * canvas.grid.size) / 2;
        result.y -= (summonHeight * canvas.grid.size) / 2;
        return await this.spawnSummon(summon, token.scene, result, {elevation: token.elevation});
    }
    async spawnSummon(summon, scene, location, {elevation} = {}) {
        const preToken = await summon.actor.getTokenDocument({
            x: location.x,
            y: location.y,
            elevation: elevation ?? actorUtils.getFirstToken(summon.owner)?.elevation 
        });
        const animation = summon.animation ? animationUtils.getAnimation(summon.animation.source, summon.animation.identifier) : undefined;
        if (animation?.macros?.prePlace) await animation.macros.prePlace(summon, location, preToken);
        const token = (await documentUtils.createEmbeddedDocuments(scene, 'Token', [preToken.toObject()], {cat: {summonCreate: true}}))?.[0];
        if (animation?.macros?.postPlace) await animation.macros.postPlace(summon, location, token);
        return token;
    }
    async removeSummon(summon, {token} = {}) {
        token ??= summon.token;
        if (!token) return;
        await summonEvents.remove(summon);
        const animation = summon.animation ? animationUtils.getAnimation(summon.animation.source, summon.animation.identifier) : undefined;
        if (animation?.macros?.preRemove) await animation.macros.preRemove(summon, token);
        const location = {x: token.x, y: token.y, elevation: token.elevation};
        await documentUtils.deleteDocument(token, {options: {cat: {summonRemove: true}}});
        if (animation?.macros?.postRemove) await animation.macros.postRemove(summon, location, token);
    }
    getSummons(actor) {
        return this.summons.filter(summon => summon.owner.uuid === actor.uuid);
    }
    getSummonData(actor) {
        return this.#summons.get(actor.id);
    }
}
export class Summon {
    constructor(owner, sourceActor, created, {actor, duration, animation, parent, sourceDocument, sounds} = {}) {
        this.sourceActor = sourceActor;
        this.owner = owner;
        this.actor = actor;
        this.created = created;
        this.duration = duration;
        this.animation = animation;
        this.parent = parent;
        this.sourceDocument = sourceDocument;
        this.sounds = sounds ?? {};
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
    async place(range, {token} = {}) {
        return constants.summons.placeSummon(this, range, {token});
    }
}