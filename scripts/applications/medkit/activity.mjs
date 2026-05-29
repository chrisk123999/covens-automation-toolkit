import MedkitApp from './base.mjs';
const {fields} = foundry.data;

// Region-activity trigger types an activity-placed region can fire on (see handlers/region.mjs).
const REGION_TRIGGERS = ['enter', 'left', 'stay', 'passedThrough', 'entered', 'exited', 'stayed', 'passedOver', 'turnStart', 'turnEnd', 'everyTurn'];
const DISPOSITIONS = ['all', 'ally', 'enemy'];

// Activity medkit: Doc Props (Hidden), the activity's own Embedded / Registered macros, and the
// Placed Region config (flags.cat.placed.region.*) that handlers/region.mjs applies to any region
// this activity creates.
export default class ActivityMedkit extends MedkitApp {
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-activity',
        actions: {
            toggleRegionTrigger: ActivityMedkit.#toggleRegionTrigger,
            setRegionDisposition: ActivityMedkit.#setRegionDisposition,
            toggleRegionOncePerTurn: ActivityMedkit.#toggleRegionOncePerTurn,
            removeRegionActivity: ActivityMedkit.#removeRegionActivity
        }
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        docprops: {template: 'modules/cat/templates/medkit/activity/docprops.hbs'},
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'},
        region: {template: 'modules/cat/templates/medkit/activity/region.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'docprops', icon: 'fa-solid fa-sliders', label: 'CAT.MEDKIT.TABS.DocProps'},
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'},
                {id: 'region', icon: 'fa-solid fa-vector-square', label: 'CAT.MEDKIT.TABS.PlacedRegion'}
            ],
            initial: 'docprops'
        }
    };

    get title() {
        return _loc('CAT.MEDKIT.Title', {name: this.#displayName});
    }

    // "<Item> - <Activity>"; activity instances expose metadata.label (a raw i18n key), so the base label path is wrong here.
    get #displayName() {
        const activity = this.document;
        const itemName = activity.item?.name;
        return itemName && activity.name ? `${itemName} - ${activity.name}` : (activity.name || itemName || '');
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.label = this.#displayName;
        const flags = this._getFlags();
        context.fields = {
            hidden: new fields.BooleanField({label: _loc('CAT.MEDKIT.Activity.Hidden.Label')}),
            magicalDarkness: new fields.BooleanField({label: _loc('CAT.MEDKIT.Region.MagicalDarkness.Label')}),
            obscured: new fields.BooleanField({label: _loc('CAT.MEDKIT.Region.Obscured.Label')})
        };
        context.hidden = flags.hidden ?? false;
        const placed = flags.placed?.region ?? {};
        context.magicalDarkness = placed.visibility?.magicalDarkness ?? false;
        context.obscured = placed.visibility?.obscured ?? false;
        context.regionMacroChoices = this._prepareRegisteredMacros('placed.region.macros').choices;
        // Region effects are item-relative ActiveEffect ids (resolved against the origin item), not UUIDs.
        const pickedEffects = new Set(Array.isArray(placed.effects) ? placed.effects : []);
        context.effectChoices = Array.from(this.document.item?.effects ?? []).map(e => ({value: e.id, label: e.name, selected: pickedEffects.has(e.id)}));
        // Region embedded macros are a read-only count until the macro editor widget lands (deferred).
        context.regionEmbeddedCount = (placed.embeddedMacros ?? []).length;
        const configured = Array.isArray(placed.activities) ? placed.activities : [];
        const configuredIds = new Set(configured.map(a => a.id));
        const siblings = Array.from(this.document.item?.system?.activities ?? []).filter(a => a.id !== this.document.id);
        context.activityChoices = siblings.map(a => ({value: a.id, label: a.name ?? a.id, selected: configuredIds.has(a.id)}));
        context.activityRows = this.#prepareActivityRows(configured);
        return context;
    }

    // Per-activity rows (triggers / disposition / once-per-turn) for the placed-region trigger editor.
    #prepareActivityRows(configured) {
        const activities = this.document.item?.system?.activities;
        return configured.map(entry => {
            const activeTriggers = new Set(entry.triggers ?? []);
            const disposition = entry.disposition ?? 'all';
            return {
                id: entry.id,
                label: activities?.get(entry.id)?.name ?? entry.id,
                oncePerTurn: !!entry.oncePerTurn,
                triggers: REGION_TRIGGERS.map(key => ({key, label: _loc(`CAT.MEDKIT.Activity.Triggers.${key}`), active: activeTriggers.has(key)})),
                dispositions: DISPOSITIONS.map(key => ({key, label: _loc(`CAT.MEDKIT.Activity.Disposition.${key}`), active: disposition === key}))
            };
        });
    }

    // Region macros + the activity picker write map/array shapes the generic flag setter would mangle.
    async _onChangeForm(formConfig, event) {
        const target = event.target;
        const name = target?.name ?? target?.getAttribute?.('name');
        const multi = target?.closest?.('cat-multi-combobox');
        if (multi && (name === 'flags.cat.placed.region.macros' || name === 'flags.cat.placed.region.activities')) {
            const raw = multi.querySelector('input[type="hidden"]')?.value ?? '';
            let arr;
            try { arr = raw ? JSON.parse(raw) : []; }
            catch { arr = []; }
            if (name === 'flags.cat.placed.region.macros') this._writeMacroSelection(arr, 'placed.region.macros');
            else this.#syncRegionActivities(arr);
            this.render();
            return;
        }
        await super._onChangeForm(formConfig, event);
    }

    // Add/remove picked activities, preserving the trigger config of ones already set.
    #syncRegionActivities(ids) {
        const flags = this._getFlags();
        const byId = new Map((foundry.utils.getProperty(flags, 'placed.region.activities') ?? []).map(e => [e.id, e]));
        const next = ids.map(id => byId.get(id) ?? {id, triggers: [], disposition: 'all', oncePerTurn: false});
        foundry.utils.setProperty(flags, 'placed.region.activities', next);
    }

    #mutateRegionActivity(id, mutate) {
        const entry = (foundry.utils.getProperty(this._getFlags(), 'placed.region.activities') ?? []).find(e => e.id === id);
        if (!entry) return;
        mutate(entry);
        this.render();
    }

    /** @this {ActivityMedkit} */
    static #toggleRegionTrigger(_event, target) {
        const trigger = target.dataset.trigger;
        this.#mutateRegionActivity(target.dataset.activityId, entry => {
            entry.triggers ??= [];
            const i = entry.triggers.indexOf(trigger);
            if (i === -1) entry.triggers.push(trigger);
            else entry.triggers.splice(i, 1);
        });
    }

    /** @this {ActivityMedkit} */
    static #setRegionDisposition(_event, target) {
        this.#mutateRegionActivity(target.dataset.activityId, entry => entry.disposition = target.dataset.disposition);
    }

    /** @this {ActivityMedkit} */
    static #toggleRegionOncePerTurn(_event, target) {
        this.#mutateRegionActivity(target.dataset.activityId, entry => entry.oncePerTurn = !entry.oncePerTurn);
    }

    /** @this {ActivityMedkit} */
    static #removeRegionActivity(_event, target) {
        const flags = this._getFlags();
        const next = (foundry.utils.getProperty(flags, 'placed.region.activities') ?? []).filter(e => e.id !== target.dataset.activityId);
        foundry.utils.setProperty(flags, 'placed.region.activities', next);
        this.render();
    }
}
