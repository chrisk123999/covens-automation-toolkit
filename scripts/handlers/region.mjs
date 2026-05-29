import {activityUtils} from '../utilities/_module.mjs';
function placed(region) {
    const originUuid = region.flags.dnd5e?.origin;
    if (!originUuid) return;
    const activity = fromUuidSync(originUuid, {strict: false});
    if (!activity) return;
    const sourceUpdates = {
        flags: {
            cat: {
                castData: {
                    castLevel: region.flags.dnd5e.spellLevel,
                    baseLevel: activity.item.system.level,
                    saveDC: activityUtils.getSaveDC(activity)
                }
            }
        }
    };
    const regionMacros = activity.flags.cat?.placed?.region?.macros;
    if (regionMacros) sourceUpdates.flags.cat.macros = regionMacros;
    const embeddedMacros = activity.flags.cat?.placed?.region?.embeddedMacros;
    if (embeddedMacros) sourceUpdates.flags.cat.embeddedMacros = embeddedMacros;
    const visibility = activity.flags.cat?.placed?.region?.visibility;
    if (visibility) sourceUpdates.flags.cat.visibility = visibility;
    const effects = activity.flags.cat?.placed?.region?.effects;
    if (effects) sourceUpdates.flags.cat.effects = effects;
    region.updateSource(sourceUpdates);
}

export default {
    placed
};