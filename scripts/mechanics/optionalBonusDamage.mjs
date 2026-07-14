import {constants, Events} from '../lib/_module.mjs';
export async function optionalBonusDamage(workflow) {
    const optionalBonusDamage = (await new Events.WorkflowEvent(constants.workflowPasses.optionalBonusDamage, workflow).run({multiResult: true, canOverlap: true})).filter(i => i.document);
    const contextualBonusDamage = (await new Events.WorkflowEvent(constants.workflowPasses.contextualBonusDamage, workflow).run({multiResult: true})).filter(i => i.document);
    if (!optionalBonusDamage.length) return;
    /*
    optionalBonusDamage = {
        document,
        predicate,
        use (function),
        rolls,
        targets: 'one' || 'multiple'
    }

    contextualBonusDamage = {
        document,
        predicate,
        use (function),
        rolls,
        targets: 'one' || 'multiple'
    }

    Some sort of combined dialog which uses the above information. When a document is checked in the dialog it runs every predicate against the workflow and combined new rolls to see if it's valid. If found to be invalid it is unchecked before the new render.
    If targets one it should have a target selection per document. In this case the predicate would want to make sure it's only including rolls that apply to that target.
    Note that if the workflow only has one target, the target selection isn't needed.

    An example is the species feature "Celestial Revelation", which adds radiant damage on hit. The player then also has the "Radiant Soul" feature from Celestial Warlock, which adds extra damage to attacks with radiant or fire damage.
    Sneak attack and cunning strike may also be possible via this dialog.
    
    contextualBonusDamage is for stuff that adds bonus damage but doesn't need to be explicitly checked. For example hex. This will still have a predicate. This should show up in the same dialog to help the player see what damage bonuses they get as they check stuff on and off.
    Target selection may still be needed for these.

    */
}