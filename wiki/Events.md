An `event` is part of the CAT framework that determines when a macro will run. Events have `passes` that further define when a macro will be called. Events are categorized by things that happen in foundry, such as moving a token or rolling an item. All CAT events have different passes and scope data.

**Events:** [Aura](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#aura) | [Called](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#called) | [Check, Save, Skill and Tool](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#check-save-skill-and-tool) | [Combat](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#combat) | [Effect](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#effect) | [Item](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#item) | [Move](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#move) | [Region](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#region) | [Rest](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#rest) | [Roll](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#roll) | [Summon](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#summon) | [Time](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events#time)

### Prefixes

Most passes require prefixes. These determine how broad a macro looks for events to apply to. `actor` prefixed passes will only run when the actor the automation is on is the event, where as `scene` will run when any actor on the scene is the event. <br>

Default prefixes available on most passes:
- `actor`
- `scene`
- `nearby`
- `region`
- `level`
- `group`
- `vehicle`
- `encounter` <br>

Additional prefixes available for workflow (roll) passes:
- `activity`
- `item`
- `token`
- `target`
- `enchantment`
- `castEnchantment`

## Aura

*Passes:* Auras have one pass, other macro configuration data lets the API determine when to call the macro. <br>
*Trigger Data:* Standard data is included. Note: `targetToken` is the token document providing the aura, `token` is the token document receiving the aura. <br>
*Return Data:* An Aura `update` macro is expected to return Effect Data or `undefined`. Effect Data will be used to create an effect on the target token. Your macro can include its own logic to determine if the aura should not apply an effect by returning `undefined` instead. <br>
*Macro Configuration:* Data must include `distance` (hardcoded Number) or `configDistance` (configuration key) <br>
*Example:* **Aura of Protection** <br>

## Called

*Passes:* Called macros (callee) are only ever executed by other macros (caller). These are basically custom events for specific automations. The pass determines how broad the caller macro will check for the callee macro. `actorCalled` will look for macros from the actor, `sceneCalled` will look for macros from all actors on the scene, etc. <br>
*Trigger Data:* Standard data is included. Arbitrary additional data may be provided by the caller macro. <br>
*Return Data:* Caller macro may expect returned data. <br>
*Macro Configuration:* Data must include `passIdentifier` for the pseudo-event that will be called. <br>
*Example:* **Sneak Attack** with **Cunning Strike** <br>

## Check, Save, Skill, and Tool

*Passes:* Check is called when an **ability** check is made. `actor`, `scene`, `nearby` etc. is how broad a macro will look for actors to apply to. `save` also has `target` prefixes.
- `Situational` is called before a roll is made. 
- `Context` is called before the roll is made and after `situational`. 
- `Bonus` is called after the roll is made but before the result.
- `Post` is called after result is determined. <br>

*Trigger Data:* Standard data is included. All passes include raw hook data such as `config, dialog, message, options, checkId`. `Bonus` and `Post` also contain the roll. <br>
*Return Data:* `Context` expects specifically formatted return data to generate a dialog for contextual advantage/disadvantage when it cannot be determined programmatically (`{type: 'advantage' | 'disadvantage', label: string}`). All other passes do not take return data, modify the `options` directly. <br>
*Macro Configuration:* No specific requirements. <br>
*Example:* `actorContext` - **Keen Senses** <br>

## Combat

*Passes:* Determines when in combat a macro is called. `actor`, `scene`, `nearby` etc. is how broad a macro will look for actors to apply to. <br>
*Trigger Data:* Standard data is included. All passes include raw hook data and context specific data such as `combat`, `combatant`, `previousCombatant`, `context (hook data)`, `round`, `turn`, `previousRound`, `previousTurn`. <br>
*Return Data:* Passes do not take return data, modify documents directly. <br>
*Macro Configuration:* No specific requirements. <br>
*Example:* `actorTurnEnd` - **Rage** <br>

## Effect

*Passes:* Called when effects are created/deleted/updated. `DoCreated` and `DoDeleted` allow you to block creation/deletion. `Pre` passes are called synchronously. For a macro on an effect, it does not need a prefix. `actor`, `scene`, `nearby` etc. is how broad a macro will look for effects to apply to. <br>
*Trigger Data:* Standard data is included. Some passes include raw hook data such as `options, updates`. <br>
*Return Data:* `DoCreate` and `DoDelete` will cancel the creation/deletion of an effect when the return value is truthy. All other passes do not take return data, `updates` can be modified directly where available. <br>
*Macro Configuration:* No specific requirements. <br>
*Example:* `actorDoCreate` - **I Survived to Tell the Tale**

## Item
*Passes:* Called when items are created, modified, or change state on an actor. `actor`, `scene`, `nearby` etc. is how broad a macro will look for items to apply to. <br>
- `created`, `deleted`, `updated`, `equipped`, `unequipped`, `attuned`, `unattuned` are called when such actions happen to an item.
- `bulkUpdated` is called when the actor medkit is used.
- `munched` is called when an actor is imported or updated via D&D Beyond.
- `medkit` is called when an item is medkited. <br>

*Trigger Data:* Standard data is included. Most passes include raw hook data such as options, and modification passes (like updated, equipped, attuned) include the specific updates object. The munched pass includes ddbCharacter data. <br>
*Return Data:* Passes do not take return data. Modify the item or actor documents directly. <br>
*Macro Configuration:* No specific requirements. <br>
*Example:* actorEquipped - **Dwarven Thrower**

## Move
*Passes:* Called when a token moves across the canvas, including forced movement and teleportation. `actor`, `scene`, `nearby` etc. determines how broad a macro will look for actors to apply to.
- `moved` is called after a token moves.
- `aimTeleport` is called before crosshairs are aimed; modify `range` and `animation` to change range or animation. 
- `preTeleport` and `postTeleport` are called pre/post CAT teleport.
- `displace` is called when a token is moved by the CAT API to an arbitrary point.
- `slide` is called when a token is moved by the CAT API in a line. <br>

*Trigger Data:* Standard data is included. Passes include the token and raw hook data such as `options`, `destination`, `animation`, `range`, `sourceToken`. <br>
*Return Data:* `preTeleport` and `displace` can be returned truthy to cancel movement. `slide` can be returned a Number that will add/reduce from the movement, `0` will cancel the movement. <br>
*Macro Configuration:* No specific requirements. <br>
*Example:* actorMoved - **Booming Blade**

## Region
*Passes:* Called during scene region creation/modification, or when tokens interact with regions during movement.
- `created`, `updated`, `deleted` are called during standard region document operations.
- `enter`, `left`, `stay`, `passedThrough` are when the token moves.
- `entered`, `exited`, `stayed`, and `passedOver` are when a region itself moves. <br>

*Trigger Data:* Standard data is included. Passes include region and raw hook data such as `options` and `updates`. `workflow` is only available for `created` when the region was made as part of a workflow. <br>
*Return Data:* Passes do not take return data. <br>
*Macro Configuration:* No specific requirements. <br>
*Example:* regionEntered - **Spike Growth**

## Rest
*Passes:* Called when an actor completes a rest cycle. Long rests trigger short rests as well. <br>
*Trigger Data:* Standard data is included. Includes raw hook data such as `result` and `config`. <br>
*Return Data:* Passes do not take return data. Rests *cannot* be interrupted/canceled at this time. <br>
*Macro Configuration:* No specific requirements. <br>
*Example:* actorShort - **Arcane Recovery**

## Roll
*Passes:* The core automation passes extending Midi-QOL's workflow. Determines exactly when a macro is called during an item's entire usage sequence. `actor`, `scene`, `nearby` etc. is how broad a macro will look for actors to apply to.
- `preTargeting` 
- `preItemRoll` for changing the activity.
- `targeting` for editing targets.
- `preambleComplete` for other stuff.
- `attackRollConfig` for adjustments to attack roll advantage and disadvantage.
- `attackRoll` for regular adjustments to attack rolls, such as re-rolling them or editing the formula. **Do not re-roll an attack after this pass**.
- `attackRollBonuses` for adding bonuses to attack rolls but before target AC checks.
- `attackRollMissedBonuses` for adding bonuses to attack rolls after checking target AC.
- `attackRollComplete` for doing stuff after the attack roll has been finalized, like animations. **No adjustments can be made here**.
- `savesComplete` for adjusting the `hitTargets` and `failedSaves` (not often used).
- `damageRoll` for regular adjustments to damage rolls, such as re-rolling them or editing the formula. **Do not re-roll damage after this pass**.
- `damageRollBonuses` for adding bonuses to damage rolls.
- `damageRollComplete` for doing stuff after the damage roll has been finalized, like animations. **No adjustments can be made here**.
- `utilityRoll` for regular adjustments to utility rolls, such as re-rolling them or editing the formula. **Do not re-roll after this pass**.
- `utilityRollBonuses` for adding bonuses to utility rolls.
- `utilityRollComplete` for doing stuff after finalized utility rolls. **No adjustments can be made here**.
- `damage` for regular adjustments to target damage item.
- `damageBonuses` for bonus damage to specific targets.
- `damageFlatReductions` for flat reductions of damage to specific targets.
- `damagePercentReductions` for percent reductions of damage to specific targets.
- `damageComplete` for other edits to damage such as preventing death.
- `rollFinished` for all other things that don't required workflow edits or adjustments.
- `onHit` for retribution-like macros.
- `cleanup` for other stuff after CAT specific special durations have already been taken into account. <br>

*Trigger Data:* Standard data is included. All passes include the `workflow` and `activity`. Damage application passes also include `token` and `ditem`. <br>
*Return Data:* Early pre-passes (`preTargeting`, `preItemRoll`, `preambleComplete`) will cancel the workflow if the macro returns a truthy value. Other passes do not expect return data; modify the workflow or ditem directly. <br>
*Macro Configuration:* No specific requirements.

## Summon
*Passes:* Called during the lifecycle of a summoned token/actor from the CAT API. 
- `preCreate` is for editing `updates`. 
- `create` is when a summon actor has been made in the sidebar but before it has been placed.
- `delete` is when a summon actor has been deleted from the sidebar and the scene. <br>

*Trigger Data:* Standard data is included. Passes include the `summon` class and `updates`. <br>
*Return Data:* Passes do not take return data. Edit `updates` in `preCreate` directly. <br>
*Macro Configuration:* No specific requirements. <br>
*Example:* `actorPreCreate` - **Undead Thralls/Mighty Summoner**

## Time
*Passes:* Called when the world time is advanced. <br>
*Trigger Data:* Standard data is included. Includes `worldTime`, `diff`, and `options`. <br>
*Return Data:* Passes do not take return data. <br>
*Macro Configuration:* No specific requirements. <br>
*Example:* actorTimeUpdated - **Mummy Rot**