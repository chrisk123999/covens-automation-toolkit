# 0.0.2 Release:
## Update Notes:
## API Update Notes:
- Added teleportToken, slideToken, and displaceToken to tokenUtils. Currently these count as token moves (and use up your turn movement), but this will be improved upon soon.
- Added aimTeleport, preTeleport, postTeleport, displace, and slide as movement event passes.
- Improved macro autocomplete handling for summons API.
- Added getDependencies to activity utils and item utils. This will return any items that an activity or item is set to consume.
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
- Class bonuses show up in the document properties intead of config.
- Automation configs now properly work.

## Bug Fixes:
- Actor medkit should actually function now.

# 0.0.1 Release:
## Update Notes:
- Initial Release