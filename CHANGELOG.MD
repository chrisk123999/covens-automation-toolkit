# 0.0.7 Release:
## API Update Notes:
- Added utils: `effectUtils.resetDuration`, `rollUtils.replaceRollShowDiscarded`, `rollUtils.setTotalWithBonus` and several confirm dialog helpers for different localized prompts.
## Bug Fixes:
- Alternate Attribute for class spellcasting bonuses now displays attacks on the character sheet correctly.

# 0.0.6 Release:
## API Update Notes:
- Added utils: `compendiumUtils.getDocumentByName`, `workflowUtils.applyWorkflowDamage`, `workflowUtils.bonusAttack`, `workflowUtils.modifyDamageAppliedFlat`.
- Added disable conditions for active effects, stored in an array at `effect.flags.cat.disableCondition`. Statuses or equipped armor can disable effects. Not yet available in the Effect CatKit.
## Bug Fixes:
- Target passes in workflow events are now triggered properly.
- The manual roll resolver auto-rolls blank inputs rather than taking the minimum.
- The short and long rest buttons on group actors no longer crash if items are present on the sheet.
- Aura events correctly track the source and targets for the aura.
- Aura events correctly evaluate blocking statuses and respond to changes.

# 0.0.5 Release:
## Update Notes:
 - Added equipment special durations to the Effect CatKit.
 - More alternate attribute system additions added, such as AC handling.
 - The effect CatKit can now assign animations to effects theat will play then they're created or deleted.
 - Many util functions have been ported from CPR.
## Bug Fixes:
 - Fixed query registration.
 - Fixed up to date checks on automations.
 - Fixed cast data not being correctly used for roll events.
 - Fixed region effects being correctly handled.
 - Quick Conditions no longer breaks other menus.
## API Update Notes:
 - Added VAE support to the create effects helper.
 - Added unhide activity support to the create effects helper.
 - Added a dataUtil for preparing effectData.
 - Automations can now require their source to be a specific type.
 - Added a smite pass to the roll event to more easily handle automations that act like the smite spell.
## API Bug Fixes:
 - Item and called event macros can now properly be registered.
 - Skill, check, save, and tool events properly pass their hook data.
 - Bonuses to skill, check, save, and tool macros no longer get thrown out.
 - Fixed doCreate effect event to catch all effect creation methods.

# 0.0.4 Release:
## Update Notes:
- Added more fields to document alternate attributes.
- Dialogs without inputs are now centered.
- Added none option to animation selection for item configs.
- Jsdocs added to many helpers.
- Integrated sources such as the DMG, 5E System, and PHB will no longer be used in the actor mass updater.
- Updated macro autocomplete integration.
## API Update Notes:
- Added catForce as a movement type, this movement type is for forced movement via macros.
- Movement events now have information about if the movement was a teleport and it's action type.
- Added selectEffect as a config option.
- automationUtils.getAutomationByIdentifier now has an excludeSources option.
- automationUtils.getAnimationConfig added.
- automationUtils.getResolvedAnimation added. This helper is useful for using using registered animations via the API.
- documentUtils.getEffectData added. Returns the effectData from on an item with the duration and origin properly set. Useful for macros.
- Updated effectUtils.createEffects to be able to add macros to created effects without having to directly modify flags.
- When using the bulk automation registration, the all rules will used as a fallback.
- Added dataUtils.setRules and dataUtils.setIdentifier. These helpers are useful for when you want to add an identifier or rules to the data of a document in a macro.
## API Bug Fixes:
- Macros on inactive effects will no longer fire.
## Bug Fixes:
- Removed unnecessary roll patch.
- Fixed CatKit automation lookup.
- CatKit shows correct colors for no automation found now.
- Called embedded macros let you type in the called macro pass now.
- Sync embedded macros should now work properly.
- Added more special durations to the effect CatKit.

# 0.0.3 Release:
## API Update Notes:
- Added teleportToken, slideToken, and displaceToken to tokenUtils. Currently these count as token moves (and use up your turn movement), but this will be improved upon soon.
- Added aimTeleport, preTeleport, postTeleport, displace, and slide as movement event passes.
- Improved macro autocomplete handling for summons API.
- Added getDependencies to activityUtils and itemUtils. This will return any items that an activity or item is set to consume.
- Added setWorkflowProperty and getWorkflowProperty. Small helpers to pass data between workflow passes.
- Added getCriticalFormula to rollUtils. Returns the critical formula for the passed in formula.
- Added bonusDamage to workflowUtils. Addes bonus damage to a workflow.
- Added addMacroWarning for logging. Macros can make use of this to log warnings that will eventually be available in a troubleshooter application.
- Adjusted registerAutomationCompendium API function to handle versioning for legacy, modern, and all.
- itemUtils.getSourceClassIdentifier and itemUtils.getSourceClass now has an option to return the subclass instead of just the base class to an item.
- animationUtils.getAnimation now takes an object as the input, allowing you to directly pass in automationUtils.getConfigValue for an animation.
## API Bug Fixes:
- Fixes for documentUtils.getSavedCastData.
- Small fixes for Roll events.
- Fixes for tokenUtils.findNearby.
- Removed movedNear from the movement event, the move pass already handles movement near a token as well.
- Updating an item works correctly in compendiums now.
- Automations with scales now properly get applied to the source class when an item is updated.
- Fixed itemUtils.getEquipmentState.
## Bug Fixes:
- Class bonuses show up in the document properties instead of config.
- Automation configs now properly work.

## Bug Fixes:
- Actor medkit should actually function now.

# 0.0.2 Release
## Update Notes:
- Initial Release

# 0.0.1 Release:
## Update Notes:
- Testing Release