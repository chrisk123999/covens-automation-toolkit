# 0.1.6 Release:
## Update Notes:
- New setting: Weapon Mastery. CAT applies the mastery property chosen for a weapon attack, for player characters by default.
- New setting: Advanced Weapon Proficiency. Advanced weapon types only offer their masteries to characters with an Advanced Weapon Proficiency feature. (Grim Hollow)
- When CAT or a module that requires it needs a newer version of a dependency, warn the GM.
- The Troubleshooter lists required module versions at the top of Required Settings, and its startup card flags outdated ones.
## Bug Fixes:
- `workflowUtils.completeActivityUse` and `completeItemUse` follow midi's fast-forward settings again unless `fast` is set.
## API Update Notes:
- Weapon attacks fire the `weaponMastery` called event before their mastery applies. Macros get `workflow`, `masteries`, `hit` and `missed`, and can add or remove keys in `masteries`. CAT applies the built-in keys and any custom masteries.
- Custom macros can define weapon masteries. A custom macro that returns `{mastery, label, reference, macro}` adds the mastery to the system's list, and CAT runs `macro` with `workflow`, `hit` and `missed` when an attack uses it.
- `cat.api.registerMastery` adds a mastery. A mastery's `genericConfig` gives it per-weapon config.
- `applications.SettingsMenuBase` takes a `namespace` and `langPrefix` for another module's settings menu, and `subMenus`: menu keys shown as buttons that open a nested settings menu.
- `genericUtils.notify` takes `permanent`, which keeps the notification until it is dismissed.
- Movement events pass the token's `origin`.
- `MenuApp` has `number` and `multiSelect` input types. Settings menus show `Number` settings as number inputs and `Array` settings with `choices` as multi-selects. `choices` can be a function.
- Added `workflowUtils.expandAttackCriticalRange`, `workflowUtils.addTargetAC`, `workflowUtils.removeAttackDisadvantage`, `workflowUtils.rerollDamageDice`, `actorUtils.setBonusActionUsed`, `actorUtils.confirmBonusAction`, `actorUtils.isMasteryEnabled`, `itemUtils.canUseMastery` and `itemUtils.getMasteryLabel`.
# 0.1.5 Release:
## Update Notes:
- Animation Priority is renamed CAT Animations and has a new Off choice.
- An effect's Disable Animation checkbox also stops its CAT apply and remove animations.
- Automation Sources has a Use Recommended button and a Mass Apply checkbox per source, off by default for content sources such as the PHB and DDB Importer.
- Mass apply never replaces class items from a content source.
- After mass applying a compendium, CAT offers to search it first.
## Bug Fixes:
- Configure Compendiums hides automation module compendiums even when opened during startup, and saving keeps entries it does not show.
- Tool checks post their chat message and apply roll options set by automations, such as advantage.
## API Update Notes:
- Added `itemUtils.getBaseWeaponLabel`. It returns the system's label for a base weapon key.
- `animationUtils.getModuleAnimations` is replaced by `animationUtils.getModuleAnimationNotices`, which returns the notice text.
- `constants.massApplyExcludeSources` is replaced by `constants.contentSources`.
- Added `effectUtils.createItemEffect`. It creates an item's effect on an actor with config values stored on the effect, readable after the item is consumed.
- Summons have a `sourceItem` getter: the item that created the summon, or the item of the activity that did.
- Added hit die roll passes, descriptor key `hitDie`: `situational`, `bonus` and `post`. `situational` can set `options.maximize`, `minimum`, `parts` and `multiplier`.
# 0.1.4 Release:
## Update Notes:
- CAT posts a welcome card to the GM once per world, with a link to the Coven's Discord and the guided tours. Modules can post their own with `cat.api.postWelcome`.
- Added guided tours: Applying Automations, Automation Sources and CAT Settings. They are also listed in Tour Management.
- Placed region activities have a Target Filter, an Effect Targets disposition and a Region Created trigger.
- Creatures moved into a region by the same movement roll its activity together.
- New setting: Auras Only in Combat. Auras apply their effects and triggers only on scenes with a started combat.
- Aura effects for every affected actor are written in one batch.
- The troubleshooter warns the GM at startup when Monk's Wall Enhancement has one-way doors enabled or Argon - Combat HUD has Target Picker enabled. It can turn either setting off.
- Teleported followers whose spot is behind a wall or out of sight pick their own spot. The rest move together.
- Automations can list other identifiers they also match.
- New special duration: Tool Rolled: Any tool. It removes the effect after any tool check.
- Summons have a Follow-Up Consume option.
- User-facing text says "compendiums" instead of "packs".
## Bug Fixes:
- Condition resistance and vulnerability use the ability of a check activity or tool instead of the skill or tool default.
- The CatKit no longer updates an item that was removed from its actor, or a cached spell whose source spell changed.
- Applying an automation to a class keeps its level and spent Hit Dice instead of resetting them.
- Optional roll bonuses no longer fail on items with no activities.
- Optional damage bonuses use the damage type of the first damage roll.
- Aura effects update when a combat with no linked scene starts or ends.
## API Update Notes:
- Added `tokenUtils.floorBelow`. It returns the `{elevation, level}` a token lands on when it drops straight down.
- Added the called event `heroicInspirationSpent`. It runs when an actor's Heroic Inspiration goes from on to off.
- Added the combat pass `preInitiative`. It runs for an actor before its initiative roll is built. Combat macros also receive `combat`.
- The `preGrapple` grapple pass data has `advantage`. Setting it rolls the grappler's contested Athletics check with Advantage.
- `tokenUtils.grapple` takes `conditions`, extra conditions applied with the grapple.
- `tokenUtils.teleportToken` takes `followerRange`.
- Added `itemUtils.getWorldItemsByFlag` and `itemUtils.deleteWorldItemsByFlag`.
- Registered automations take `aliases`, read from `flags.cat.automation.aliases` in automation compendiums.
- Placed region data takes `filter`, an aura filter macro, and `effectDisposition`.
- Regions with `flags.cat.spellWard` set to a spell level are spell wards. Region and aura effects from spells of that level or lower, cast from outside the ward, skip creatures inside it. Check them with `regionUtils.isSpellWard` and `regionUtils.isSpellWarded`.

# 0.1.3 Release:
## Update Notes:
- Requires midi-qol 14.6.1 and DAE 14.6.1.
- Added automatic character backups.
  - An Actor CatKit's new Backups tab can manually back up or restore an actor.
- Script macros in the Macros compendiums can now replace registered macros directly.
- Compendium pickers show each compendium's source and sidebar folder path.
- Hidden activities show the CatKit icon on item and actor sheets, including Tidy5e, for GMs.
- Added setting: Hide Hidden Activities on Actor Sheets. Off by default. Item sheets always show them.
- New special durations: Damaged by Source or Ally and Damaged by Source's Ally.
- Added `combatTurn` disable condtion in the Effect CatKit. Enables the effect only during the actor's turn.
- Damage type pickers group types into Physical, Elemental and Other.
- Damage type prompts can offer "Don't ask again this combat" or "this cast".
## Animations:
- Added setting: Animation Priority. Choose what plays when an item has a CAT animation and Automated Animations or Boss Loot FX also animates it: CAT (default), the other module, or both.
  - CAT blocks Automated Animations and Boss Loot FX Premium's automatic animations for the item.
  - The other module skips the CAT animation when Automated Animations or a Boss Loot FX macro animates the item.
- CatKit animation options and the troubleshooter warn when Automated Animations or Boss Loot FX also animates the item.
## Summons:
- New generic macro: `summon`. It creates, places, recalls and moves summons from an item or activity.
  - Summons can be picked from the monster compendiums by creature type, subtype, name, CR or CR tier, or chosen against a budget.
  - Each summon entry can override its count, disposition, size, items, actor data and follow-up activity.
  - Summons can turn hostile when their spell ends, replace earlier summons and stay within a maximum distance of the summoner.
## Areas and Regions:
- New path drawing tool for wall spells: straight or free lines, closed shapes, rings and panels, with a side picker and a live preview of the creatures each part covers.
- Placed areas can attach to the caster's token and follow it.
- Area activities can make their effects depend on the area. The effects end when the creature leaves or the area ends.
- New area trigger: Moved, with an optional per-distance count.
- Auras have an Enter on Create option. Turn it off so creatures already in range when the aura appears do not count as entering.
- Regions can give ranged weapon attacks that pass through them disadvantage or make them miss.
- Regions can reduce damage of chosen types that passes through them.
- New region passes: `moved`, `panelBroken` and `damageThrough`. `moved` runs once each time a region moves or changes shape, including attached regions following their token.
## Bug Fixes:
- An activity's macros no longer replace its item's macros of the same pass.
- A linked actor with several tokens on a scene runs its scene, nearby, level and every-turn macros once.
- Aura enter, exit and once-per-turn triggers count a linked actor once, whichever of its tokens moves.
- Dismissing a summon removes the areas and effects that depended on its effects.
- Once-per-turn area activities no longer hit the cast's own targets again in the same turn.
- Summon features that match the caster's DC or attack bonus use the spellcasting values when the spell does not come from a class.
- Third party optional bonuses no longer add costs to local bonuses during validation.
## API Update Notes:
- `dialogUtils.selectDamageType` accepts `remember` and `rememberKey`. Added `dialogUtils.clearRemembered`.
- Added `constants.damageTypeGroups` and `constants.getDamageTypeGroup`.
- Added `effectUtils.endConcentration`.
- Added `actorUtils.spendHitDice`.
- Added `compendiumUtils.getPackOrigin` and `compendiumUtils.getPackLabel`.
- Added `crosshairUtils.drawPath`.
- Added `regionUtils.createPathRegions`, `reshapePathRegion`, `deletePathWalls`, `addWallPanels`, `breakWallPanel`, `tokensOnPath`, `pathBand`, `pathSegments`, `containsPoint`, `trimPath`, `subtractShapes`, `getPlacedRegions` and `addRegionTimer`. `spreadAroundCorners` accepts a circle to spread from.
- Added `summonUtils.makeDependentOnParent`.
- Added `tokenUtils.getGrappled`. `teleportToken` accepts followers, and `swapTokens` can play an animation.
- `workflowUtils.syntheticItemRoll`, `syntheticItemDataRoll`, `syntheticActivityRoll` and `syntheticActivityDataRoll` accept `fast`. With `fast: false`, a roll sent to another client waits for that player instead of timing out.
- `documentUtils.setFlag` and `automationUtils.setGenericConfigValue` work on activities.
- Added `actorUtils.addExhaustion`, `effectUtils.getSceneEffects`, `rollUtils.maximizeRoll`, `workflowUtils.getDamageDealt` and `compendiumUtils.getFilteredActors`.

# 0.1.2 Release:
## Update Notes:
- Added setting: Placed Area Visibility. Areas placed by activities are drawn on the Regions layer only by default.
- Removed special durations that midi-qol already provides.
- Added setting: Recharge Player Abilities. Rolls recharge for non-NPC abilities at the start of their turn, which the system only does for NPCs.
- Teleports aimed with a crosshair only allow spaces the token can see, including across levels.
- On scenes with levels, teleports, displacements and summon placement offer any other level with a floor in reach.
- Fix Description Enrichers moved from the Automation Sources menu to the General menu.
- Mass apply splits its confirmation into Characters, NPCs and Other.
- Mass apply on a locked compendium copies it into a new or existing unlocked compendium.
- Added the Troubleshooter, opened from the Help settings menu or the stethoscope button on CatKit and mass apply windows.
- The Discord button copies the report and opens the CPR Discord.
- The GM is whispered a chat card at startup when required settings are wrong or a defunct or incompatible module is active.
- Export Data on a sidebar entry asks whether to strip descriptions.
- Display Debug Logs and Display Event Data are off by default.
- The warning for having both JB2A modules active moved from a notification to the Troubleshooter.
## Bug Fixes:
- Players can recall and dismiss their summons without the Delete Tokens permission.
- Auras only count tokens on the active scene, the scene the GM is viewing, and scenes with a started combat. Linked tokens left on other scenes no longer grant or receive auras.
- Special durations triggered by attacks, saves and damage expire at that step of the roll.
- Forced movement no longer spends a token's movement.
- Saving settings keeps automation sources registered unless they are disabled, matching startup.
- CatKit dropdowns stay attached to their field when the window moves.
- The Quick Conditions window's close, Cancel and Ok buttons work.
- Manual rolls skip midi's automatic successes and failures.
- Manual rolls in Roll Total mode subtract the modifier for dice inside functions, so hit dice no longer add CON twice.
- Crosshair range boundaries match the scene's diagonal rule.
- Clicking a crosshair on an invalid space is refused and aiming continues.
- Aiming a crosshair minimizes open windows and restores them afterwards.
- Animations warn once per session when Sequencer is missing or outdated, instead of failing silently or erroring.
- `tokenUtils.getDistance` uses midi's `getDistance`, so distances follow midi's Distance Measurement setting and match its range checks.
## API Update Notes:
- Added `workflowUtils.addAttackRollPart`, `animationUtils.meetsRequirement` and `animationUtils.getCredits`.
- Effect animation `create` and `delete` macros receive `{activity, sourceToken}` as a fourth argument.
- Animations can require `jb2a_patreon`. The `JB2A_DnD5e` requirement is met by either JB2A module.
- `tokenUtils.teleportToken` and `tokenUtils.displaceToken` accept `elevation` and `level`.
- Added `tokenUtils.aimDestination`, `tokenUtils.canSeePoint` and `tokenUtils.reachableSurfaces`. `tokenUtils.teleportToken` takes `requireSight`, on by default.
- Added `crosshairUtils.horizontalReach`. 3D range is measured with core's grid rules, height included. `crosshairUtils.aimCrosshair` takes `getElevation` and `ringElevation`, passes the destination to validity functions, and returns its `elevation`.
- Event pass constants have JSDoc describing their prefixes, arguments and return values.
- Added `cat.api.registerTroubleshooterCheck` and `cat.api.registerTroubleshooterChecks`. A check is `{id, section, group, run, fix}`. `run` returns rows of `{status, label, detail}`.
- `Logging.addMacroWarning` writes a WARNING entry to the Troubleshooter's Logs tab, and player warnings are also sent to the GM's log. It takes `{notify, format}`.
- Renamed `Logging.addMacroError` to `Logging.logMacroException`. CAT calls it when a macro throws. Macros log with `addMacroWarning` and a `notify` level instead.
- Added the `catLogEntry` hook, called for every warning and error entry.
- Added `documentUtils.exportDocument`, `documentUtils.stripDescriptions` and `genericUtils.dateStamp`.
- `crosshairUtils.aimCrosshair` takes a TokenDocument only.
- `DialogApp.dialog` accepts `config.anchor` `{x, y}` to open at a point.
- CatApp windows can declare `headerButtons`.

# 0.1.1 Release:
## Update Notes:
- Requires dnd5e 6.0 or later, midi-qol 14.6.0 or later, and DAE 14.6.0 or later.
- Uses dnd5e 6 and core v14 features in place of CAT's own: armor class, senses, status effects, light levels, region movement paths and level-aware line of sight. Devil's Sight grants token sight.
- Combat events run from core's turn handling on the active GM. Rewinds and skipped turns no longer fire turn events, except turns skipped for defeated combatants.
## Bug Fixes:
- Region effects apply when a region is placed, created or moved, and pass-through triggers follow the token's actual path.
- Summons follow their owner's initiative reliably and copy the caster's spell attack correctly.
- Effects disabled by armor stay disabled through status changes.
- Rolls requested from other players and synthetic rolls return complete, correct results.
- Manual rolls with advantage or disadvantage use the die you enter.
- Manual rolls detect summon and NPC initiative from the roll's `roll.type` instead of its flavor text.
- Applying an automation picks from every source by priority and keeps the item's class.
- Distances on metric scenes are reported in feet.
## API Update Notes:
- The `ACFormula` and `ACAbility` alternate attributes add their formulas to dnd5e's native armor class formulas. CAT no longer calculates armor class itself.
- Combat events come from `Combat` turn wrappers, and their macros receive core's turn context.
- Workflows aborted during preItemRoll or preambleComplete refund their consumption. Set the `keepConsumption` workflow property to keep it.
- `workflowUtils.applyWorkflowDamage` takes `itemCardUuid`. `rollUtils.requestRoll` returns a `D20Roll` when another user rolls. `activityUtils.getDuration` returns seconds.
- Added `effectUtils.durationToSeconds`, `automationUtils.sortByPriority`, `dataUtils.setOrigin`, `regionUtils.spreadAroundCorners`, `regionUtils.getArea`, `regionUtils.isBetweenTokens` and `workflowUtils.getConfigActivity`.
- CAT wraps `DAE.doActivityEffects` so effects on synthetic items still apply under DAE 14.6.

# 0.0.9 Release:
## Update Notes:
- This is the last version compatible with dnd5e 5.x.
- Fixed a startup error when indexing compendiums: `Cannot create property 'rules' on number`.
- A tab's icon is colored when that tab holds content.
- Added a CatKit entry to context menus everywhere a CatKit can be opened: the Item, Actor and Scene directories, the scene navigation bar, compendium entries, compendium packs, and item, activity and effect rows on sheets.
- Added a light theme.
- Added Related Automations to the CatKit. It lists the automated documents nested under the one you are editing, each opening its own CatKit.
- Added special duration: Dealt damage. The effect is removed once its actor deals damage to another creature.
- Added setting: Fix Description Enrichers. When an automation update keeps an item's existing description, bare `[[/damage]]` and `[[/save]]` enrichers are rewritten from the item.
- Configuration options that repeat a label are grouped under a subheading derived from their shared key prefix.
- Every CAT window can be resized from a corner grabber, and remembers its position and size.
- Manual rolls use CAT's damage artwork, matching the icons the bonus and damage dialogs already used.
- Manual rolls: damage dice of the same type and denomination are shown as a single box, and that box accepts either a total or the individual dice (`5,6`).
- Manual rolls: each damage group names what granted it, and its damage type, in a tooltip. The damage type no longer takes up room in the group's label.
- Mass apply shows counts for up to date, available and out of date, each listing the items it counted on hover. Up to date items are listed, unchecked, when another source could be applied to them.
- Mass apply works on compendiums. A locked pack refuses, and a pack belonging to a module or the system asks first, since updating that package overwrites whatever was applied.
- Opening a CatKit on a document in a locked compendium warns that changes will not save.
- Reworked the dark theme.
- Reworked the document property editor.
- The Generic tab icon is marked when a nested document carries a generic, not just the document itself.
- Rebuilt auras. The active GM writes each aura as a real effect on the tokens inside it, and only rewrites it when a token crosses the aura's edge or the aura changes. Effects left behind while the GM was away are corrected on load.
- Auras keep working on scenes no one is viewing. Walls block an aura only on the scene the GM is viewing.
- Added the `aura` generic macro, moved from CPR. It puts an aura on an item, activity or effect. It covers radius, dispositions, creature types, statuses applied by the source, disabling statuses, walls, separate ally and enemy effects, a stacking value, enter, exit and turn activities, and an optional filter macro.
- The optional bonus dialog disables and dims any bonus that can no longer be afforded beside the bonuses already chosen.
- Manual rolls show the flat modifier on dice groups without a damage type.
- A sheet's CatKit header control is colored by automation status, like its context menu entry. A scene reports the lowest status among its tokens' actors.
- The Registered Macros tab only counts macros picked in its list. A macro bound under a different ruleset than it was registered for is shown as that macro.
- Related Automations labels each nested document by type when one document holds more than one type.
- Combobox labels are trimmed, and the remove button on a multi-combobox chip has no border.
## API Update Notes:
- `automationUtils.getAutomationStatus` accepts any document.
- `automationUtils.isUpToDate` accepts an already-resolved `automation`.
- `genericUtils.notify` accepts `progress` and returns the notification
- `workflowUtils.bonusDamage` accepts `source`, naming what granted the damage. It is stored as `options.cat.source` and shown as attribution on manual rolls.
- Added `constants`: `contextMenuHookNames`, `activationTypeOptions`, `activityTypeOptions`, `sizeOptions`, `spiritTypeOptions`, `auraTriggers`, `auraMembershipKeys`, `auraActorKeys`, `auraItemPaths`.
- `constants` option lists, `itemProperties`, `physicalItemTypes`, `triggerTypes`, `usableItemTypes` and `weaponTypes` are getters. Read them without calling them.
- Removed `AuraEvent`. Auras are indexed by `lib.Auras` from the `descriptor` pass of a registered generic's `aura` event. The `aura` event's `filter` pass is the only aura pass a macro can bind.
- `constants.auraHookNames` lists the hooks the aura engine listens to.
- Event distances are measured the first time a trigger reads them.
- Swapped the order of D20 events `bonus` and `optionalBonus`. `bonus` is now the final event in which the roll can be changed and should be used for rerolls.
- Added utils:
  - `activityUtils`: `getCheckDCModifiedActivityData`, `getRecoveryPools`
  - `actorUtils`: `isWounded`, `hasStatusFromActor`, `getLevelOrCR`
  - `automationUtils`: `getMedkitChildren`, `getCatConfigKinds`, `getAnyAutomationStatus`, `getAutomationTree`, `countDescendantGenerics`, `isSelfAutomation`, `getOriginConfigValue`
  - `compendiumUtils.getDocumentsBySlug`
  - `dialogUtils`: `getSpellSlotOptions`, `selectLanguage`
  - `folderUtils.getActorsInFolder`
  - `itemUtils`: `getSpellAttackBonus`, `addDamageBonus`
  - `rollUtils.replaceD20`
  - `tokenUtils`: `canSense`, `movementSpent`, `swapTokens`, `getNonSightModes`
  - `uiUtils`: `storedWindowPosition`, `applyStoredWindowPosition`, `rememberWindowPosition`, `toggleDetached`, `onToggleDetach`, `isDetached`, `detachContext`
  - `workflowUtils`: `getScaledDuration`, `rollConfiguredSource`, `specialItemUse`, `removeTargets`, `getSaveSource`
- `documentUtils.getEffectByIdentifier` accepts `sourceActor`, matching only effects whose origin activity belongs to that actor.
- `$activity.dc` in a `flags.midi-qol.OverTime` change resolves to the origin activity's save DC when the effect is created. Without a save activity on the item, it falls back to the origin activity's spellcasting DC.
- An optional bonus for a spell cast through another feature's activity costs that activity's uses rather than a spell slot, and cannot be upcast.
- `tokenUtils.teleportToken` accepts `options` and passes them to the animation's macros, so a teleport animation's own config now reaches it.
- JSDoc added across `automationUtils`, `workflowUtils` and `documentUtils`.
## Bug Fixes:
- Mass apply on a level covered every token on the scene rather than the tokens on that level.
- A manual roll showed a roll's flat modifier against every damage group sharing its damage type, so a dagger's `+3` appeared three times.
- The manual roll input flashed a focus ring on the way in and out.
- The optional bonus scaling slider stopped one level short of the highest spell slot or affordable step.
- Manual rolls ignored a capitalized damage type in a dice flavor, so `1d8[Radiant]` was labeled with the weapon's damage type.
## API Bug Fixes:
- `actorUtils.isBloodied` was defined but never exported, so calling it threw.
- Class scales resolve from subclass items, not just class items.
- A `rules: 'all'` scale now matches on both 2014 and 2024 actors.
- Region macros never ran for a region placed by anything other than a spell. Cast data is defaulted rather than partially written, and a trigger that is alone in its group is no longer entered into the overlap contest it cannot win.
- `automationUtils.getAnimationConfig` passed its arguments through in the wrong order, so no animation config stored on an item ever resolved.
- The CatKit wrote a macro's animation config to a path nothing reads, so the values neither displayed nor applied.
- The CatKit re-injects registered scales when its config is saved, so changing a class or subclass identifier moves the scale.
- `tokenUtils.canSense` treats an empty sense list as no senses. MidiQOL treats it as no filter.
- Third party bonus requests no longer ask you to approve your own decision when the bonus belongs to an actor you own.
- `workflowUtils.completeItemUse` and `completeActivityUse` no longer throw when MidiQOL declines the use and returns nothing.
- Summoned items no longer throw when the summoning spell was granted by a feat rather than a class.
- `dialogUtils.selectDialog` and `numberDialog` localize their input label.
- `SummonsManager.moveSummon` no longer throws for a summon without a token.
- An optional bonus's formula tag refreshes when one of its extra inputs changes.
- A save activity whose DC used neither an ability nor spellcasting threw when it had no available abilities.
- A critical hit no longer throws for a damage bonus granted by an effect.

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
