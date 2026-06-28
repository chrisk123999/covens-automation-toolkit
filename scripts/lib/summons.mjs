import {summonEvents} from '../events/_module.mjs';
import {actorUtils, folderUtils, genericUtils, documentUtils, crosshairUtils, animationUtils, itemUtils} from '../utilities/_module.mjs';
import {constants} from './_module.mjs';
export class SummonsManager {
    #summons = new Map();
    #deletingFolders = new Map();
    #creatingRootFolder = null;
    #creatingOwnerFolders = new Map();
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
            const initiative = summonData.initiative;
            if (!owner || !sourceActor || created === undefined) return;
            return new Summon(owner, sourceActor, created, {actor, duration, animation, parent, sourceDocument, sounds, initiative});
        }))).filter(Boolean);
        resolvedSummons.forEach(summon => this.#summons.set(summon.actor.id, summon));
    }
    async #getRootFolder() {
        let folder = game.folders.find(f => f.flags.cat?.summonFolder && f.type === 'Actor');
        if (folder) return folder;
        if (this.#creatingRootFolder) return this.#creatingRootFolder;
        const createPromise = folderUtils.createFolder({
            name: _loc('CAT.Summons.SummonFolder'),
            type: 'Actor',
            'flags.cat.summonFolder': true
        });
        this.#creatingRootFolder = createPromise;
        try {
            return await createPromise;
        } finally {
            this.#creatingRootFolder = null;
        }
    }
    async #getOwnerFolder(actor) {
        const rootFolder = await this.#getRootFolder();
        if (rootFolder.depth >= CONST.FOLDER_MAX_DEPTH) return rootFolder;
        let folder = game.folders.find(f => f.flags.cat?.summonOwner === actor.uuid && f.type === 'Actor');
        if (folder) return folder;
        if (this.#creatingOwnerFolders.has(actor.uuid)) return this.#creatingOwnerFolders.get(actor.uuid);
        const createPromise = folderUtils.createFolder({
            name: actor.name,
            type: 'Actor',
            folder: rootFolder.id,
            'flags.cat.summonOwner': actor.uuid
        });
        this.#creatingOwnerFolders.set(actor.uuid, createPromise);
        try {
            return await createPromise;
        } finally {
            this.#creatingOwnerFolders.delete(actor.uuid);
        }
    }
    async #prepareSidebarActor(summon, created = game.time.worldTime, {avatarImg, tokenImg, name, updates, animation, disposition, sourceDocument, sounds, items = [], initiative} = {}) {
        const actorData = (await summon.getSourceActor()).toObject();
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
        disposition ??= summon.ownerToken?.disposition ?? summon.owner.prototypeToken.disposition;
        genericUtils.setProperty(actorData, 'prototypeToken.disposition', disposition);
        if (items.length) {
            updates.items ??= [];
            await Promise.all(items.map(async itemInfo => this.#processItem(summon, updates, itemInfo)));
        }
        await summonEvents.preCreate(summon, updates);
        genericUtils.mergeObject(actorData, updates);
        genericUtils.setProperty(actorData, 'prototypeToken.actorLink', true);
        actorData.ownership = summon.owner.toObject().ownership;
        actorData.folder = (await this.#getOwnerFolder(summon.owner)).id;
        genericUtils.setProperty(actorData, 'flags.cat.summon', {
            owner: summon.owner.uuid,
            sourceActor: (await summon.getSourceActor()).uuid,
            created,
            duration: summon.duration,
            animation,
            parent: summon.parent?.uuid,
            sourceDocument: sourceDocument?.uuid,
            sounds,
            initiative
        });
        return await actorUtils.createActor(actorData);
    }
    async #processItem(summon, updates, itemInfo) {
        const {uuid, matchDC, matchAttack, description, equipped, attuned, method, prepared, usesMax, usesRecovery, usesRechargeFormula} = itemInfo;
        const sourceItem = await fromUuid(uuid);
        if (!sourceItem) return;
        const itemData = sourceItem.toObject();
        delete itemData._id;
        if (description) itemData.system.description.value = description;
        if (Object.hasOwn(itemData.system, 'equipped') && equipped !== false) genericUtils.setProperty(itemData, 'system.equipped', true);
        if (attuned && itemData.system.attunement) genericUtils.setProperty(itemData, 'system.attuned', true);
        if (itemData.type === 'spell') {
            if (method) genericUtils.setProperty(itemData, 'system.method', method);
            genericUtils.setProperty(itemData, 'system.prepared', Number(prepared ?? 0));
        }
        if (usesMax) {
            genericUtils.setProperty(itemData, 'system.uses.max', String(usesMax));
            genericUtils.setProperty(itemData, 'system.uses.spent', 0);
            if (usesRecovery) genericUtils.setProperty(itemData, 'system.uses.recovery', [{period: usesRecovery, type: 'recoverAll', formula: usesRecovery === 'recharge' ? (usesRechargeFormula || '6') : ''}]);
        }
        const sourceClass = itemUtils.getSourceClass(summon.sourceDocument);
        if (!sourceClass) {
            updates.items.push(itemData);
            return;
        }
        const save = sourceClass.system.spellcasting.save;
        const attack = sourceClass.system.spellcasting.attack;
        Object.values(itemData.system.activities).forEach(activityData => {
            if (matchDC && activityData.type === 'save') genericUtils.setProperty(activityData, 'save.dc', {
                calculation: '',
                formula: String(save),
                value: true
            });
            if (matchAttack && activityData.type === 'attack') {
                genericUtils.setProperty(activityData, 'attack.flat', true);
                genericUtils.setProperty(activityData, 'attack.bonus', String(attack));
            }
        });
        updates.items.push(itemData);
    }
    async ownerInitiative(actor) {
        const summons = this.getSummons(actor).filter(summon => ['follows', 'standard'].includes(summon.initiative) && summon.token);
        if (!summons.length) return;
        const ownerToken = actorUtils.getFirstToken(actor);
        if (!ownerToken?.combatant) return;
        const combat = ownerToken.combatant?.combat;
        if (!combat) return;
        const combatantsToCreate = [];
        const combatantsToUpdate = [];
        let followsCount = 1;
        const baseInitiative = ownerToken.combatant.initiative || 0;
        for (const summon of summons) {
            let calculatedInitiative;
            if (summon.initiative === 'follows') {
                calculatedInitiative = baseInitiative + (followsCount * 0.001);
                followsCount++;
            } else if (summon.initiative === 'standard') {
                const roll = await summon.actor.getInitiativeRoll().evaluate();
                await roll.toMessage({
                    speaker: ChatMessage.implementation.getSpeaker({token: summon.token})
                });
                calculatedInitiative = roll.total;
            }
            const existingCombatant = combat.combatants.find(c => c.tokenId === summon.token?.id);
            if (existingCombatant) {
                combatantsToUpdate.push({
                    _id: existingCombatant.id,
                    initiative: calculatedInitiative
                });
            } else {
                combatantsToCreate.push({
                    tokenId: summon.token.id,
                    sceneId: summon.token.scene.id,
                    actorId: summon.actor.id,
                    initiative: calculatedInitiative
                });
            }
        }
        if (combatantsToCreate.length) await documentUtils.createEmbeddedDocuments(combat, 'Combatant', combatantsToCreate);
        if (combatantsToUpdate.length) await documentUtils.updateEmbeddedDocuments(combat, 'Combatant', combatantsToUpdate);
        if (followsCount > 1) await documentUtils.update(ownerToken.combatant, {initiative: baseInitiative + (followsCount * 0.001)});
    }
    async #summonInitiative(summon, token) {
        if (!['follows', 'standard'].includes(summon.initiative)) return;
        const ownerToken = summon.ownerToken;
        const combat = ownerToken?.combatant?.combat;
        if (!combat?.started) return;
        const combatantData = {
            tokenId: token.id,
            sceneId: token.scene.id,
            actorId: summon.actor.id
        };
        if (summon.initiative === 'follows') {
            const ownerCombatant = ownerToken.combatant;
            if (ownerCombatant?.initiative !== null) {
                combatantData.initiative = ownerCombatant.initiative;
                await documentUtils.update(ownerCombatant, {initiative: ownerCombatant.initiative + 0.001});
            }
        } else if (summon.initiative === 'standard') {
            const roll = await summon.actor.getInitiativeRoll().evaluate();
            await roll.toMessage({
                speaker: ChatMessage.implementation.getSpeaker({token: token})
            });
            combatantData.initiative = roll.total;
        }
        await documentUtils.createEmbeddedDocuments(combat, 'Combatant', [combatantData]);
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
        if (ownerFolder && !ownerFolder.contents.length) {
            if (this.#deletingFolders.has(ownerFolder.id)) {
                await this.#deletingFolders.get(ownerFolder.id);
            } else {
                const deletePromise = documentUtils.deleteDocument(ownerFolder, {forceGM: true});
                this.#deletingFolders.set(ownerFolder.id, deletePromise);
                try {
                    await deletePromise;
                } finally {
                    this.#deletingFolders.delete(ownerFolder.id);
                }
            }
        }
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
        token ??= summon.ownerToken;
        if (!token) return;
        if (summon.token) return;
        const summonImg = summon.actor.prototypeToken.texture.src;
        const summonWidth = summon.actor.prototypeToken.width;
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
        return await this.spawnSummon(summon, token.scene, result, {elevation: token.elevation});
    }
    async spawnSummon(summon, scene, location, {elevation} = {}) {
        const preToken = await summon.actor.getTokenDocument({
            x: location.x,
            y: location.y,
            elevation: elevation ?? summon.ownerToken?.elevation 
        });
        const animation = summon.animation ? animationUtils.getAnimation({source: summon.animation.source, identifier: summon.animation.identifier}) : undefined;
        if (animation?.macros?.prePlace) await animation.macros.prePlace(summon, location, preToken);
        const token = (await documentUtils.createEmbeddedDocuments(scene, 'Token', [preToken.toObject()], {cat: {summonCreate: true}}))?.[0];
        await this.#summonInitiative(summon, token);
        if (animation?.macros?.postPlace) await animation.macros.postPlace(summon, location, token);
        return token;
    }
    async removeSummon(summon, {token} = {}) {
        token ??= summon.token;
        if (!token) return;
        await summonEvents.remove(summon);
        const animation = summon.animation ? animationUtils.getAnimation({source: summon.animation.source, identifier: summon.animation.identifier}) : undefined;
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
    getSummonsBySource(document) {
        return this.summons.filter(summon => summon.sourceDocument?.uuid === document.uuid);
    }
    async placeSummons(summons, range, {token} = {}) {
        if (!summons.length) return;
        const spawnedTokens = [];
        for (const summon of summons) {
            const resultToken = await this.placeSummon(summon, range, {token});
            if (!resultToken) break; 
            spawnedTokens.push(resultToken);
        }
        return spawnedTokens;
    }
}
export class Summon {
    constructor(owner, sourceActor, created, {actor, duration, animation, parent, sourceDocument, sounds, initiative} = {}) {
        this.sourceActorUuid = sourceActor.uuid;
        this.ownerUuid = owner.uuid;
        this.actor = actor;
        this.created = created;
        this.duration = duration;
        if (duration) this.duration += 6;
        this.animation = animation;
        this.parentUuid = parent?.uuid;
        this.sourceDocumentUuid = sourceDocument?.uuid;
        this.sounds = sounds ?? {};
        this.initiative = initiative;
    }
    get token() {
        return actorUtils.getFirstToken(this.actor);
    }
    get folder() {
        return this.actor?.folder;
    }
    get sourceDocument() {
        return fromUuidSync(this.sourceDocumentUuid);
    }
    get owner() {
        return fromUuidSync(this.ownerUuid);
    }
    get parent() {
        if (!this.parentUuid) return undefined;
        return fromUuidSync(this.parentUuid);
    }
    get ownerToken() {
        return actorUtils.getFirstToken(this.owner);
    }
    async getSourceActor() {
        return await fromUuid(this.sourceActorUuid);
    }
    getTimeRemaining(worldTime) {
        if (!this.duration) return Infinity;
        return this.created + this.duration - worldTime;
    }
    async place(range, {token} = {}) {
        return constants.summons.placeSummon(this, range, {token});
    }
    async recall() {
        return constants.summons.removeSummon(this);
    }
}