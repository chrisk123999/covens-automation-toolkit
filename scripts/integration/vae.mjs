import {actorUtils, documentUtils, itemUtils} from '../utilities/_module.mjs';
function createEffectButton(effect, buttons) {
    const buttonData = effect.flags.cat?.vae?.buttons;
    if (!buttonData) return;
    buttonData.forEach(i => {
        switch(i.type) {
            case 'use':
                buttons.push({
                    label: i.name,
                    callback: () => {
                        if (!effect.parent) return;
                        const parent = effect.parent;
                        if (!parent) return;
                        let actor;
                        if (parent.documentName === 'Actor') {
                            actor = parent;
                        } else if (parent.documentName === 'Item') {
                            actor = parent.actor;
                        }
                        if (!actor) return;
                        const item = actorUtils.getItemByIdentifier(actor, i.itemIdentifier);
                        if (!item) return;
                        if (i.activityIdentifier) {
                            const activity = itemUtils.getActivityByIdentifier(item, i.activityIdentifier);
                            if (!activity) return;
                            activity.use();
                        } else {
                            item.use();
                        }
                    }
                });
                break;
            case 'dismiss':
                buttons.push({
                    label: i.name,
                    callback: () => {
                        documentUtils.deleteDocument(effect);
                    }
                });
        }
    });
}
export default {
    createEffectButton
};