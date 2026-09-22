# 0.0.8 Release:
## API Update Notes:
- The automation registry can now differentiate between duplicate identifiers, such as 'channel-divinity' from cleric and paladin. See `itemUtils.getAdvancementSourceKey`.
- Added utils:
  - `activityUtils`: `correctSpellLink`, `getConsumptionModifiedActivityData`, `getSaveDCModifiedActivityData`
  - `actorUtils`: `addFavorites`, `removeFavorites`, `getCR`, `getBestSave`, `getBestSkill`, `getBestTool`, `getItemByIdentifiers`, `setReactionUsed`
  - `automationUtils.getSourceName`
  - `compendiumUtils`: `getDocumentUuidByIdentifier`, `getEnabledCompendiumIds`, `getSpell`, `getSpellUuid`, `selectActor`, `selectSpellFromLists`
  - `dialogUtils.selectSpellSlot` replaced with `dialogUtils.selectSpellSlots`
  - `effectUtils`: `getImageConfig`, `pushImageChanges`
  - `itemUtils.createItems`
  - `itemUtils.getSourceClass` replaced with `itemUtils.getAdvancementSourceItem`
  - `itemUtils.getSourceClassIdentifier` replaced with `itemUtils.getAdvancementSourceKey`
  - `regionUtils.getActivity`
  - `rollUtils`: `contestedRoll`, `requestRoll`, `resolveManualRolls`, `shouldFastForward`
  - `tokenUtils`: `canSee`, `getLightLevel`, `grapple`, `grappleShoveSizeCheck`
  - `workflowUtils`: `applyDamage`, `addMacroConditions`, `getMacroConditions`, `spendScaledCost`
- Added `constants.weaponTypes`
- The `targetSituational` macro pass is now available for checks, saves, and tool rolls.
- `dataUtils.buildEffectData` accepts `avatarImg`, `tokenImg` and `imgPriority`.
- `documentUtils.getBaseEffectData` accepts `system`, for `system.changes`.
- `documentUtils.getEffectData` carries `activityUuid`.
- `dialogUtils.selectDocumentDialog` accepts `checked`. `selectTargetDialog` and `selectAmount` accept `requireTotal`.
- `genericUtils.notify` forwards Foundry's `format` option.
- `rollUtils.rollDice` gains an opt-in `manual` flag.
- Added effect special durations: `turnStart`, `turnEnd`, `madeAttack`, `castSpell`, `damaged`
- Optional bonuses are collected once per spot rather than once per dialog phase. `phase` is now a `D20Bonus` constructor option and `RollBonus.withInputs` adds dialog subinputs.
- Region activities can set the core region visibility with `flags.cat.placed.region.coreVisibility`.
- Cast activities are relinked to the first match in the configured spell compendiums when an automation is applied or updated.
## Update Notes:
- Actor CatKit: added document properties.
  - Condition Resistance/Vulnerability: now applies on checks, skills, and tools.
  - Feature Resistance: `flags.cat.FR.identifier`
  - Feature Vulnerability: `flags.cat.FV.identifier`
  - Feature Immunity: `flags.cat.FI.identifier`
  - Feature Failure: `flags.cat.FF.identifier`
  - Use an activity identifier, e.g. turn resistance: `flags.cat.FR.turn-undead | custom | wis`.
  - All of the above are now shown in MidiQOL's roll attributions on chat cards.
- Item CatKit: added Spell Range Bonus document property.
- Effect CatKit: added disable conditions and a `zeroHP` special duration.
- Optional Bonus Dialog: added a damage type picker, critical hit rules, and phases for before and after knowing a D20 result.
- The mass apply feature now prompts a review of the documents to be updated.
- Automation version can now be changed in the CatKit on compendium documents. Reload the world to update the automation registry.
- Added a grapple system, including events for size check, apply and escape. Start a grapple with `tokenUtils.grapple`.
- Effects can override an actor's portrait and token image by priority, restored when the last one is removed.
- Effect CatKit: added a Turn group to the special duration picker.
- Tokens with a `devilsSight` or `truesight` sense range are no longer blinded by darkness.
- CatKit: select options are localized and a blank option sorts first.
- Activity CatKit: added Spell Identifier document property for cast activities.
- Item CatKit: the Configuration tab shows a notice when an automation has no options.
## API Bug Fixes:
- Fixed registry for custom automation compendiums. (Thanks Darsh)
- `workflowUtils.isSustainedRoll` no longer incorrectly flags standard spell or cantrip casts.
- `workflowUtils.modifyDamageAppliedFlat` caps reductions to remaining damage instead of remaining HP. (Ported from CPR 1.5.47).
- Condition resistance and vulnerability can work with conditions applied programmatically if the workflow is marked with `workflowUtils.addMacroConditions`.
- `itemUtils.unhideActivities` implements its `favorite` option, as does `rehideActivities`.
- `DamageBonus` falls back to the actor's roll data.
- Summon item updates preserve the source actor's items and accept inline item data.
- `crosshairUtils` compensates for token width against a caller supplied fudge distance.
- `tokenUtils.moveToken` no longer stops forced movement and teleports on creatures in the path.
## Bug Fixes:
- Fixed max counter for `selectAmount` dialog input.
- Effect special durations `damagedByAlly` and `damagedByEnemy` can now be used together.
- Fixed a crash with saving throws on MidiQOL overtimes. (Thanks Skyl3lazer)
- Fixed class scale duplication when an automation is applied.
- Alternate Attribute for damage roll modifiers will work without also using an alternate damage formula.

- Manual damage rolls resolve before the `damageRollComplete` pass.
- Outdated Sequencer and duplicate JB2A notifications render as warnings.
- The Compendiums menu lists packs from packages that are also automation sources.
- The Compendiums menu sorts a pack into the Spells tab when most of its contents are spells.
- The D&D Beyond Importer integration no longer throws when its compendium settings are not registered.
# 0.0.7 Release:
## API Update Notes:
- Added a combined optional bonus dialog. Choose from all bonuses available for a roll and request bonuses from allies.
- The multi-combobox now supports token ping and highlighting.
- Added utils:
  - `activityUtils`: `hasDefaultIcon`, `hasDefaultName`, `getDefaultDamageRolls`
  - `effectUtils.resetDuration`
  - `automationUtils.getCompendiumDocumentByName`
  - `dialogUtils.selectScaledDocument`
  - `rollUtils`: `replaceRollShowDiscarded`, `setTotalWithBonus`
  - `workflowUtils.updateTargets`
  - several confirm dialog helpers for different localized prompts
- New dialog inputs: formula display, slider, request.
- The smite event pass has been removed in favor of using the optional bonuses dialog.
## API Bug Fixes:
- `documentUtils.getSavedCastData` now correctly checks for ActiveEffect instead of Effect as the document name.
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