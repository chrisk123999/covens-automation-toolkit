import {dialogUtils} from '../utilities/_module.mjs';
import {Logging} from './_module.mjs';
const fields = foundry.data.fields;
export const SECTIONS = ['required', 'modules', 'foundry', 'permissions', 'importer', 'settings', 'logs'];
const FIXABLE_STATUSES = ['warn', 'fail'];
const isFunction = value => value instanceof Function;
export class RegisteredTroubleshooterChecks {
    #checkSchema = new fields.SchemaField({
        id: new fields.StringField({required: true, nullable: false, blank: false}),
        section: new fields.StringField({required: true, nullable: false, choices: SECTIONS}),
        run: new fields.AnyField({required: true, nullable: false, validate: isFunction}),
        fix: new fields.AnyField({required: false, validate: isFunction}),
        group: new fields.StringField({required: false, nullable: false, blank: false}),
        fixLabel: new fields.StringField({required: false, nullable: false, blank: false})
    });
    checks = new Map();
    registerTroubleshooterCheck(data) {
        const validationError = this.#checkSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'troubleshooter', validationError.asError());
            return false;
        }
        this.checks.set(data.id, data);
        return true;
    }
    registerTroubleshooterChecks(data = []) {
        return data.map(check => this.registerTroubleshooterCheck(check));
    }
    async run({sections = SECTIONS, filter = () => true} = {}) {
        const checks = [...this.checks.values()].filter(check => sections.includes(check.section) && filter(check));
        const rows = await Promise.all(checks.map(async check => [await this.#runCheck(check)].flat().filter(Boolean).map(row => ({
            ...row,
            label: _loc(row.label),
            group: (row.group ?? check.group) && _loc(row.group ?? check.group),
            detail: row.detail ?? '',
            id: check.id,
            section: check.section,
            fixable: !!check.fix && FIXABLE_STATUSES.includes(row.status),
            fixLabel: check.fixLabel ?? 'CAT.Troubleshooter.Fix.Label'
        }))));
        return rows.flat();
    }
    async #runCheck(check) {
        try {
            return await check.run();
        } catch (error) {
            return {status: 'fail', label: check.id, detail: error.message};
        }
    }
    async fix(rows) {
        const fixable = rows.filter(row => row.fixable);
        const checks = [...new Set(fixable.map(row => row.id))].map(id => this.checks.get(id));
        if (!checks.length) return false;
        const content = await foundry.applications.handlebars.renderTemplate('modules/cat/templates/troubleshooter/card.hbs', {
            message: 'CAT.Troubleshooter.Fix.Content',
            groups: Object.entries(Object.groupBy(fixable, row => row.group ?? '')).map(([label, rows]) => ({label, rows}))
        });
        if (!await dialogUtils.confirm('CAT.Troubleshooter.Fix.Title', content)) return false;
        for (const check of checks) await check.fix();
        await foundry.applications.settings.SettingsConfig.reloadConfirm({world: true});
        return true;
    }
}
function catSettings() {
    return [...game.settings.settings.values()].filter(setting => setting.namespace === 'cat' && setting.menu);
}
export default {RegisteredTroubleshooterChecks, SECTIONS, catSettings};
