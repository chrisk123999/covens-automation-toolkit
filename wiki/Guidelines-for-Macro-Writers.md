# Updating Macros from v13 to v14

While most functions from v13 of CPR are the same in v14 CAT, there are some key differences to keep in mind while updating macros. For an example of these changes in practice, see Chromatic Orb in [v14 of CPR](https://github.com/chrisk123999/chris-premades/blob/main/scripts/macros/modern/spells/chromaticOrb.mjs) vs [v13 of CPR](https://github.com/chrisk123999/chris-premades/blob/v13/scripts/macros/2024/spells/chromaticOrb.js).

### 1. Changes to macro scope
- `trigger` is no longer a property of the scope and is now the scope data itself. `trigger.entity` is now `document`.  See [Macro Scope](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Macro-Scope) and [Events](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events) for further details.

### 2. Event and Pass changes
- All passes now have a prefix (ie `activity`, `scene`, etc.). See [Events - Prefixes](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events/_edit#prefixes).
- Midi Item and Midi Actor passes have been combined into `roll`. These are mostly extensions of the midi workflow, with added passes to help separate some types of macros. See [Events - Roll](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events/_edit#roll).
- Item passes no longer have an activity filter, macros are applied directly to activities instead.

### 3. Token documents instead of token placeables
- Helper functions now generally use the token document instead of token placables. 

### 4. Macro Exports
- `rules` is now `2014`, `2024`, or `all` instead of legacy and modern.
- `config` is now an object instead of an array, what was `value` is now the key for the property within the `config` object.

## Changes to helpers
Most helpers are the same, except they are found in the `cat` namespace instead of `chris-premades`. Below is a list of known changes to helpers.
- `activityUtils.getActivityByIdentifier` -> `itemUtils.getActivityByIdentifier`. No longer needs `{strict: true}`, no longer uses module flag.
- `activityUtils.getIdentifier` -> `documentUtils.getIdentifier`. No longer uses module flag.
- `activityUtils.withChangedDamage` -> `activityUtils.getDamageModifiedActivityData`.
- `actorUtils.getCRFromProf` -> `actorUtils.getCR(actor)`.
- `combatUtils.perTurnCheck` -> `combatUtils.isStampedThisTurn`.
- `combatUtils.setTurnCheck` -> `combatUtils.addTurnStamp`.
- `compendiumUtils.getItemFromCompendium(key, name, options)` -> `compendiumUtils.getDocumentByIdentifier(packId, identifier)`.
- `effectUtils.getEffectByIdentifier` -> `actorUtils.getEffectByIdentifier`.
- `effectUtils.getEffectByStatusID` -> `actorUtils.getEffectByStatusID`.
- `effectUtils.applyConditions` -> `actorUtils.applyConditions`.
- `effectUtils.getOriginItem` -> Removed in favor of `effectUtils.getOriginActivity`.
- `effectUtils.getOriginItemSync` -> Removed in favor of `effectUtils.getOriginActivitySync`.
- `genericUtils.translate` -> `_loc`.
- `genericUtils.update` -> `documentUtils.update`.
- `genericUtils.setFlag` -> `documentUtils.setFlag`.
- `genericUtils.unsetFlag` -> Removed, use setFlag with _del.
- `genericUtils.remove` -> `documentUtils.deleteDocument`.
- `genericUtils.createEmbeddedDocuments` -> `documentUtils.createEmbeddedDocuments`.
- `genericUtils.updateEmbeddedDocuments` -> `documentUtils.updateEmbeddedDocuments`.
- `genericUtils.deleteEmbeddedDocuments` -> `documentUtils.deleteEmbeddedDocuments`.
- `genericUtils.log` -> `cat.lib.Logging.addEntry`.
- `genericUtils.getIdentifier` -> `documentUtils.getIdentifier`.
- `genericUtils.getRules` -> `documentUtils.getRules`.
- `itemUtils.getConfig` -> `automationUtils.getConfigValue`. Takes the item the config is on.
- `itemUtils.setConfig` -> `automationUtils.setConfigValue`.
- `itemUtils.getItemByIdentifier` -> `actorUtils.getItemByIdentifier`.
- `itemUtils.getVersion` -> `documentUtils.getVersion`.
- `itemUtils.getSource` -> `documentUtils.getSource`.
- `itemUtils.isUpToDate` -> `automationUtils.isUpToDate`.
- `itemUtils.getGenericFeatureConfig` -> `automationUtils.getGenericConfigValue`.
- `itemUtils.setHiddenActivities` -> `itemUtils.unhideActivities` & `itemUtils.rehideActivities`.
- `itemUtils.getEffectByIdentifier` -> `documentUtils.getEffectByIdentifier`.
- `itemUtils.fixScales` -> `automationUtils.updateScales`.
- `templateUtils` -> `regionUtils`.
- `tokenUtils.moveTokenAlongRay(targetToken, origRay, distance)` -> `slideToken(targetToken, {distance, ray: origRay})`.
- `tokenUtils.pushToken(sourceToken, targetToken, distance)` -> `slideToken(targetToken, {sourceToken, distance})`.
- `tokenUtils.findNearby(Token, range, disposition, options)` -> `tokenUtils.findNearby(TokenDocument, range, options = {disposition, etc.})`. Uses token placeable and changes to `options`.
- `workflowUtils.applyDamage(tokens, value, damageType)` -> `workflowUtils.applyWorkflowDamage(sourceToken, damageRoll, damageType, targets, options = {})`. Use `applyWorkflowDamage` when possible, but `applyDamage` is still available. Uses token documents now.
- `workflowUtils.handleInstantTemplate` -> `workflowUtils.handleInstantRegion`.
- `workflowUtils.getCastLevel` -> No longer needed, use castData.castLevel.
- `workflowUtils.swapAttackAbility` -> Use alternate attributes in the feature CatKit.
- `workflowUtils.addEntityRemoval` -> `workflowUtils.addDocumentRemoval`.
