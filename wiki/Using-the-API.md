_**This page provides information on some of CAT's API, including: [Embedded Macros](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Using-the-API#embedded-macros), [Registered Macros](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Using-the-API#registered-macros), [Module Registration](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Using-the-API#module-registration), and references [Events](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events), [Priority](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Priority), and [Macro Scope](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Macro-Scope)**_

CAT is primarily an API module, meaning it's functions are meant to be used by other modules to create automations. There are two main parts to the API, utility functions and running automations. The reason to use the CAT API to run automations is that it takes overlapping spell rules and priority considerations into account automatically, making automations smoother and more compatible than directly using DAE or Midi. This guide will not be about how to write automations or macros, it is only how to use CAT's API specifically. 

There are a few different ways to utilize CAT's API for utility functions and to run automations which vary in complexity. Select your skill level below to learn about Embedded Macros, registering macros from a compendium, and registering macros from a module.

[For Macro Writers](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Using-the-API#embedded-macros) <br>
[For Advanced Macro Writers](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Using-the-API#registered-macros) <br>
[For Module Creators](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Using-the-API#module-registration) <br>

***

# Embedded Macros

Embedded Macros are similar to item macros, in that the macro data is kept in flags on the document itself. Embedded Macros are accessed by opening the [Cat Kit](https://github.com/chrisk123999/covens-automation-toolkit/wiki#the-cat-kit) on any supported document, navigating to the "Embedded Macros" tab, and clicking the `Add Macro` button.

<img width="820" height="620" alt="Embedded Macros" src="https://github.com/user-attachments/assets/0ae629b5-1699-47cb-bbe7-19a082102ea1" />

- `Name` can be any string, however it should be unique between macros on a document. One document should not have two macros named "Macro", but an item and an actor can both have a macro named "Macro".
- `Event` and `Pass` determine when a macro will run. Detailed information is found [here](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events).
- `Priority` determines the order that macros on the same pass will run. This generally does not need to be modified, but detailed information is found [here](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Priority).
- `Macro` is where you put the macro you want to run. Some variables are pre-defined by CAT, details on macro scope are available [here](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Macro-Scope). All CAT `utils` are provided in the scope data for embedded macros.

# Registered Macros

Registered Macros are a way to have one macro be used by multiple items, so that a macro only has to be changed in one place instead of on each item. This method does not require creating a module as macros are put into a user-specified compendium.

Macro Compendium

Formatting Macros

Applying Automation

# Module Registration

To register a premades module and its automations, CAT provides helper functions in the `CAT.api` namespace. Below you can find a description of each of the `api` functions and the required steps for registering a module with CAT.

## API Functions

CAT's API functions for registering macros are available in the `globalThis` under `cat.api`.

`registerFnMacros([{macroData}, ...], options = {})` - Takes an array of [Macro Data](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Macro-Data) objects, which follow a specific format and provide information about your individual macros. <br>

`registerAutomations([{automationData}, ...], options = {})` - Takes an array of [Automation Data](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Automation-Data) objects, which follow a specific format and provide information about your automations. This is required for an automation to be shown in the CatKit, whether it does or does not have registered macros. <br>

`registerAutomationCompendium(pack, options = {})` - Takes a pack and registers all documents in it. This can be used to bulk register automations on a pack basis, config data can be passed in `options`. See [CAT](https://github.com/chrisk123999/covens-automation-toolkit/blob/62d7d1e70328b6babb7c6edade316b40901c61f7/scripts/lib/automations.mjs#L216) and [CPR](https://github.com/chrisk123999/chris-premades/blob/295458e897cb7bc0aadaec59f86bd7eb00d24b6d/scripts/module.mjs#L60). <br>

`registerAutomationModule(id, options = {})` - Takes a module id and registers all documents in its associated packs. This can be used to bulk register automations from an entire module, config data can be passed in `options`. See [CAT](https://github.com/chrisk123999/covens-automation-toolkit/blob/84898813fcb64f5db6b8b3723f4c7ca3d6a98d08/scripts/lib/automations.mjs#L281). <br>

`registerSourceName(id, name)` - Adds module as a `source` for automations, instead of individual compendiums being listed. Required for source name to be shown in the CatKit and additional sources menu. <br>

`registerScales([{scaleData}, ...])` - Registers premade scales that can be used by automations that require a scale when none is found on the actor. `scaleData` must be formatted as: <br>

> { 
> >   source = 'moduleId', <br>
>     rules = '2014' OR '2024' OR 'all', <br>
>     identifier = 'scaleIdentifier', <br>
>     classIdentifier = ie 'rogue', <br>
>     data = {} <br>
>
> } 

- `data` should be the object form of a `ScaleValueAdvancement` (`.toObject()` the advancement document from the class item). <br>

`registerAnimations([{animationData}, ...]})` - Registers animations that can be called from macros and generic automations. `automationData` must be formatted as: <br>

> {
> > source = 'moduleId' <br>
    identifier = 'animationIdentifier' <br>
    name = 'Automation Name' <br>
    macros = {animationFunction, ...} <br>
    inputs = ie ['sourceToken', 'targetToken'] --- Arbitrary array of strings of keys of required variables for the animation. <br>
    requirements = ['moduleId'] --- ie 'jb2a_patreon' <br>
    config = {configOptions} <br>
    category = String --- Arbitrary categorization of the animation. <br>
    credits = {
> > > name <br>
      discord <br>
      patreon <br>
> >
> > }
>
> } <br>

## Examples

Below are heavily simplified examples of using the CAT API within a module. You can also look at the CPR repo for more complex examples, specifically for registering functions and automations. <br>

https://github.com/chrisk123999/chris-premades/blob/main/scripts/module.mjs#L60

### Required Steps

Use the hook `catReady` to call API functions to register your automations. `catReady` is called shortly after `ready`. Example:

```javascript
Hooks.once('catReady', () = {
    // Register your module as a source
    cat.api.registerSourceName('myModuleId', 'My Module Name');

    // Register function macros (if any). These are the macros CAT's API calls when various things happen in game.
    cat.api.registerFunctionMacros(myArrayOfMacros);

    // Register automations, either individually, by compendium, or by module.
    cat.api.registerAutomations([automationData, ...], options); // OR
    cat.api.registerAutomationCompendium(pack, options); // OR
    cat.api.registerAutomationModule(id, options);

    // Register scales and animations, if needed.
    cat.api.registerScales([scaleData, ...]);
    cat.api.registerAnimations([automationData, ...]);
}
```

### Function Macro Example

```javascript
async function use(scope) {
    console.log(scope);
}
const macroFunctionData = {
    identifier: 'my-macro', // Identifier of the document that runs the macro
    source: 'my-module',
    rules: 'all',
    roll: [
        {
            pass: 'activityRollFinished',
            macro: use,
            priority: 50,
        }
    ]
};
cat.api.registerFnMacros([macroFunctionData]);
```

### Register Automation Example

```javascript
async function use(scope) {
    console.log(scope);
}
let myAutomation = {
    source: 'my-module',
    identifier: 'my-automation',
    version: '0.0.1',
    rules: 'all',
    type: 'feat',
    config: {
        myConfigOption: {
            label: 'My Config Option',
            type: 'checkbox',
            default: false,
            category: 'homebrew'
        }
    }
};
const pack = game.packs.get('my-module.automations');
const index = await pack.getIndex({fields: ['system.identifier']});
const uuid = index.find(i -> i.document.system.identifier === myAutomation.identifier).uuid;
myAutomation.uuid = uuid;
cat.api.registerAutomations([myAutomation]);
```

### Bulk Register Automations Example

```javascript
const myAutomations = [
    myAutomation
]
const configsAll = {};
myAutomations.map(i => {
    if (i.config) configsAll[i.identifier] = i.config;
});
const pack = game.packs.get('my-module.automations');
const options = {
    configsAll
};
cat.api.registerAutomationCompendium(pack, options);
```

## Proxying CAT's helper functions

When using ES Modules, you can proxy CAT's helper functions to use them directly in your scripts without going through the globalThis every time. CPR has a proxy script file, feel free to directly copy the file and use it in your own module. <br>

https://github.com/chrisk123999/chris-premades/blob/main/scripts/proxy.mjs