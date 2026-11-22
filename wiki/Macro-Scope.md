The variables passed to CAT registered macros when they are run is called the **scope**. This is similar to how variables such as `workflow` are always defined when Midi runs item macros. Variables included in the `scope` vary by event and pass, some data is consistently provided:

## Standard Scope Data

`document`: The document the macro is on. <br>
`castData`: Object with `castLevel` and `saveDC`, this data will always be added even if the trigger isn't a spell. This is taken from the midi workflow or otherwise calculated.

### Actor Data
*If `actor` is defined* <br>

`actor`: Most macros will have `actor` defined. This is the actor the macro is on.
- `token`: Taken from the workflow or from foundry to find the first token from the `actor`.
  - `scene`, `level`: The scene and level the `token` is on. 
  - `regions`: Regions the `token` is in.
- `encounters`, `groups`, `vehicles`: Any the sidebar `actor` belongs to.

### Additional Data 
`options`, `updates`: Raw hook data will be provided when available. Some hooks have additional arguments.

Some events and passes have additional specific scope data, detailed in [Events](https://github.com/chrisk123999/covens-automation-toolkit/wiki/Events)

### Embedded Macros
All `utils` are provided in the scope data for embedded macros (ex. `actorUtils.getItemByIdentifier` will be defined)

## Viewing Scope Data

There are two easy ways to view in-game what scope data is provided:
- CAT development tools settings
  - The `Development Tools` menu has settings to display the debug data and the event data. `Display Debug Logs` shows which events, passes, and macros are running. `Display Event Data` shows the scope data. If there is a macro it will show live data, otherwise it will show sample data. These are both logged in console.
- `console.log(...args)`: This is a core JavaScript function to log out all arguments provided in the scope.