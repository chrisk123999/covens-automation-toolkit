All macros using the CAT API provide a `priority` which determines if it will run sooner or later than other macros on using the same event pass. **Lower priority will execute sooner**, higher will execute later. Priority will not change when a macro executes if there are no others running on the same event pass. While the priority recommendations below are not strict, they are recommended so that all macros play nice with each other. 

- < 50 is generally reserved for the item's own purposes, such as re-rolling its own damage.
- 50 is the default priority.
- 250 for roll bonuses from other sources, like hex.
- 500 for stuff that generally doesn't modify the workflow. <br>

For v14 CAT compared to previous CPR versions, priority matters less for damage passes because they are more split up. However, actor macros and item macros will execute in the same event, so actor macros should generally have a higher (later) priority (CPR previously ran item macros first).