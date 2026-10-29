import * as applications from '../applications/_module.mjs';
import {constants, Logging} from '../lib/_module.mjs';
import {animationUtils, automationUtils} from '../utilities/_module.mjs';

const TROUBLESHOOTER = {
    modules: {
        defunct: ['itemacro', 'sidebar-macros', 'temp-effects-as-statuses'],
        incompatible: ['dice-rng-protector', 'retroactive-advantage-5e', 'multilevel-tokens', 'advancedspelleffects', 'attack-roll-check-5e', 'betterrolls5e', 'effective-transferral', 'faster-rolling-by-default-5e', 'max-crit', 'mre-dnd5e', 'multiattack-5e', 'obsidian', 'quick-rolls', 'wire'],
        optional: ['ddb-importer', 'dice-so-nice', 'macro-autocomplete', 'tidy5e-sheet', 'visual-active-effects'],
        animation: ['sequencer', 'jb2a_patreon', 'JB2A_DnD5e', 'animated-spell-effects-cartoon'],
        scruvy: ['cGx1dG9uaXVt', 'cGx1dG9uaXVtLWFkZG9uLWF1dG9tYXRpb24='].map(atob)
    },
    aseForkManifest: 'https://github.com/chrisk123999/animated-spell-effects-cartoon/releases/latest/download/module.json',
    errorStores: ['macroErrors', 'embeddedMacroErrors', 'registrationErrors', 'attributeErrors'],
    permissions: ['ACTOR_CREATE', 'ITEM_CREATE', 'TOKEN_CREATE', 'TOKEN_DELETE', 'FILES_BROWSE', 'MESSAGE_WHISPER', 'MACRO_SCRIPT'],
    collections: ['actors', 'items', 'scenes', 'tables', 'macros'],
    midiSettings: ['autoCEEffects', 'attackPerTarget', 'allowActorUseMacro', 'allowUseMacro', 'autoRollAttack', 'autoFastForward', 'gmAutoAttack', 'gmAutoFastForward', 'autoRollDamage', 'gmAutoDamage', 'autoCheckHit', 'autoCheckSaves', 'confirmAttackDamage', 'waitForDamageApplication', 'autoCompleteWorkflow'],
    requiredSettings: {
        'dnd5e': {
            allowPolymorphing: {fix: true},
            rulesVersion: {}
        },
        'dae': {
            DependentConditions: {fix: true},
            expiryAction: {fix: 'delete'},
            coreExpiryAction: {fix: 'delete'}
        },
        'midi-qol': {
            'EnableWorkflow': {fix: true},
            'ReplaceDefaultActivities': {fix: true},
            'ConfigSettings.autoCEEffects': {fix: 'itempri'},
            'ConfigSettings.attackPerTarget': {fix: false},
            'ConfigSettings.autoCheckHit': {expected: value => value !== 'none', fix: 'all'},
            'ConfigSettings.autoCheckSaves': {expected: value => value !== 'none', fix: 'all'},
            'ConfigSettings.autoRollDamage': {expected: value => ['onHit', 'always'].includes(value), fix: 'onHit'},
            'ConfigSettings.gmAutoDamage': {expected: value => ['onHit', 'always'].includes(value), fix: 'onHit', label: 'CAT.Troubleshooter.Required.GmAutoDamage'},
            'ConfigSettings.confirmAttackDamage': {fix: 'none'},
            'ConfigSettings.waitForDamageApplication': {fix: true},
            'ConfigSettings.autoCompleteWorkflow': {fix: true},
            'ConfigSettings.removeButtons': {fix: 'all'},
            'ConfigSettings.autoApplyDamage': {fix: 'yesCard'},
            'ConfigSettings.addChatDamageButtons': {fix: 'none'}
        },
        'core': {
            'permissions.QUERY_USER': {expected: roles => roles?.includes(CONST.USER_ROLES.PLAYER), fix: Object.values(CONST.USER_ROLES).filter(Boolean), label: CONST.USER_PERMISSIONS.QUERY_USER.label},
            'permissions.REGION_CREATE': {expected: roles => roles?.includes(CONST.USER_ROLES.PLAYER), fix: Object.values(CONST.USER_ROLES).filter(Boolean), label: CONST.USER_PERMISSIONS.REGION_CREATE.label}
        }
    }
};
function report(key, detail) {
    return {status: 'info', label: `CAT.Troubleshooter.Report.${key}`, detail: String(detail)};
}
function formatValue(value) {
    if (Array.isArray(value) && value.length && value.every(id => game.users.has(id))) return _loc('CAT.Troubleshooter.Report.UserCount', {count: value.length});
    return value instanceof Object ? JSON.stringify(value) : String(value);
}
function usersDetail(permission) {
    const allowed = game.users.filter(user => user.hasPermission(permission)).length;
    return _loc('CAT.Troubleshooter.Report.Permissions.Users', {allowed, denied: game.users.size - allowed});
}
function moduleName(id) {
    if (id === 'core') return _loc('CAT.Troubleshooter.Sections.foundry');
    if (id === game.system.id) return game.system.title;
    return game.modules.get(id)?.title ?? id;
}
function requiredBy(id) {
    return ['cat', 'chris-premades'].some(owner => [...game.modules.get(owner)?.relationships.requires ?? []].some(relationship => relationship.id === id));
}
const MODULE_TAGS = {
    Required: {test: requiredBy, status: constants.MEDKIT_STATUSES.CONFIGURABLE},
    Optional: {test: id => TROUBLESHOOTER.modules.optional.includes(id)},
    AutomationSource: {test: id => constants.automations.sources.has(id) || constants.automations.moduleRegistrations.has(id), status: constants.MEDKIT_STATUSES.UP_TO_DATE},
    AnimationsLibrary: {test: id => TROUBLESHOOTER.modules.animation.includes(id), status: constants.MEDKIT_STATUSES.UNKNOWN},
    Defunct: {test: id => TROUBLESHOOTER.modules.defunct.includes(id), status: constants.MEDKIT_STATUSES.AVAILABLE},
    Incompatible: {test: id => TROUBLESHOOTER.modules.incompatible.includes(id), status: constants.MEDKIT_STATUSES.OUTDATED}
};
function moduleTags(id) {
    return Object.entries(MODULE_TAGS).filter(([, tag]) => tag.test(id)).map(([key, tag]) => ({label: _loc(`CAT.Troubleshooter.Tags.${key}`), status: tag.status}));
}
function moduleDetail(module) {
    if (module?.active) return module.version;
    return _loc(`CAT.Troubleshooter.Report.${module ? 'Inactive' : 'NotInstalled'}`);
}
function settingsDump(namespace) {
    return {
        id: `settings.${namespace}`,
        section: 'settings',
        get group() {
            return moduleName(namespace);
        },
        run: () => [...game.settings.settings.values()].filter(setting => setting.namespace === namespace && (setting.config || setting.menu)).map(setting => ({
            status: 'info',
            label: setting.name ? _loc(setting.name) : setting.key,
            detail: formatValue(game.settings.get(namespace, setting.key))
        }))
    };
}
function settingCheck({module, key, fix, expected = value => value === fix, label}) {
    const [settingKey, path] = key.split('.');
    const setting = () => game.settings.settings.get(`${module}.${settingKey}`);
    const read = () => {
        const value = game.settings.get(module, settingKey);
        return path ? value[path] : value;
    };
    const name = () => _loc(label ?? (path ? `${module}.${path.capitalize()}.Name` : setting().name));
    return {
        id: `required.${module}.${key}`,
        section: 'required',
        group: moduleName(module),
        run: () => {
            const value = read();
            const status = fix === undefined ? 'info' : expected(value) ? 'pass' : 'fail';
            if (module === 'core') return {status, label: name(), detail: usersDetail(path)};
            const detail = status === 'fail' ? _loc('CAT.Troubleshooter.Required.Expected', {value: String(value), fix: String(fix)}) : String(value);
            const scope = setting().scope === 'client' ? ' ' + _loc('CAT.Troubleshooter.Required.ClientScope') : '';
            return {status, label: name(), detail: detail + scope};
        },
        fix: fix === undefined ? undefined : async () => {
            if (!path) return game.settings.set(module, settingKey, fix);
            const data = foundry.utils.deepClone(game.settings.get(module, settingKey));
            data[path] = fix;
            return game.settings.set(module, settingKey, data);
        }
    };
}
function moduleCheck(id, kind) {
    return {
        id: `modules.${kind.toLowerCase()}.${id}`,
        section: 'modules',
        fixLabel: 'CAT.Troubleshooter.Fix.Disable',
        run: () => {
            const module = game.modules.get(id);
            if (!module?.active) return;
            return {status: 'warn', group: _loc(`CAT.Troubleshooter.Report.${kind}`), label: moduleName(id), detail: module.version};
        },
        fix: () => {
            const configuration = foundry.utils.deepClone(game.settings.get('core', 'moduleConfiguration'));
            configuration[id] = false;
            return game.settings.set('core', 'moduleConfiguration', configuration);
        }
    };
}
const AUTOMATIONS_CHECK = {
    id: 'modules.automations',
    section: 'modules',
    group: 'CAT.Troubleshooter.Groups.Automations',
    run: async () => {
        const counts = await new applications.WorldMedkit()._prepareAutomationCounts();
        return counts.map(({status, label, count}, index) => {
            const pending = count > 0 && status !== 'up-to-date';
            return {
                status: !pending ? 'pass' : status === 'outdated' ? 'fail' : 'warn',
                label,
                detail: String(count),
                order: index,
                action: pending ? 'openMassApply' : undefined,
                actionLabel: 'CAT.MEDKIT.MassApply.Button'
            };
        });
    }
};
const REPORT_CHECKS = [
    {
        id: 'foundry.versions',
        section: 'foundry',
        group: 'CAT.Troubleshooter.Groups.Core',
        run: () => [
            {status: 'info', label: moduleName('core'), detail: game.version},
            {status: 'info', label: game.system.title, detail: game.system.version},
            report('Language', game.i18n.lang)
        ]
    },
    {
        id: 'modules.list',
        section: 'modules',
        run: () => {
            const expected = [...[...game.modules.get('cat').relationships.requires].map(({id}) => id), ...TROUBLESHOOTER.modules.optional, ...TROUBLESHOOTER.modules.animation];
            const ids = [...game.modules.keys(), ...expected.filter(id => !game.modules.has(id))];
            const grouped = Object.groupBy(ids.map(id => {
                const module = game.modules.get(id);
                const tags = moduleTags(id);
                return {
                    status: 'info',
                    group: tags.length ? 'CatRelated' : module.active ? 'Active' : 'Inactive',
                    label: module?.title ?? id,
                    detail: moduleDetail(module) + (module?.manifest === TROUBLESHOOTER.aseForkManifest ? ` (${_loc('CAT.Troubleshooter.Report.ASEFork')})` : ''),
                    tags,
                    faded: !module?.active,
                    reportHidden: TROUBLESHOOTER.modules.scruvy.includes(id),
                    order: id === 'cat' ? -1 : 0
                };
            }), row => row.group);
            return ['CatRelated', 'Active', 'Inactive'].flatMap(group => (grouped[group] ?? []).map(row => ({...row, group: `CAT.Troubleshooter.Groups.${group}`})));
        }
    },
    {
        id: 'modules.bothJB2A',
        section: 'modules',
        run: () => {
            if (game.modules.get('jb2a_patreon')?.active && game.modules.get('JB2A_DnD5e')?.active) return {status: 'warn', label: 'CAT.Troubleshooter.BothJB2A'};
        }
    },
    {
        id: 'modules.oneWayDoors',
        section: 'modules',
        group: 'CAT.Troubleshooter.Groups.Conflicts',
        run: () => {
            if (game.modules.get('monks-wall-enhancement')?.active && game.settings.get('monks-wall-enhancement', 'allow-one-way-doors')) return {status: 'warn', label: 'CAT.Troubleshooter.OneWayDoors'};
        },
        fix: () => game.settings.set('monks-wall-enhancement', 'allow-one-way-doors', false)
    },
    {
        id: 'modules.argonTargetPicker',
        section: 'modules',
        group: 'CAT.Troubleshooter.Groups.Conflicts',
        run: () => {
            if (game.modules.get('enhancedcombathud')?.active && game.settings.get('enhancedcombathud', 'rangepicker')) return {status: 'warn', label: 'CAT.Troubleshooter.ArgonTargetPicker'};
        },
        fix: () => game.settings.set('enhancedcombathud', 'rangepicker', false)
    },
    {
        id: 'modules.contentMassApply',
        section: 'modules',
        run: () => [...constants.automations.sources].filter(source => automationUtils.isContentSource(source) && automationUtils.isMassApplySource(source))
            .map(source => ({status: 'warn', label: 'CAT.Troubleshooter.ContentMassApply', detail: automationUtils.getSourceName(source)})),
        fix: () => {
            const sources = foundry.utils.deepClone(game.settings.get('cat', 'automationSources'));
            for (const [source, data] of Object.entries(sources)) if (automationUtils.isContentSource(source)) data.massApply = false;
            return game.settings.set('cat', 'automationSources', sources);
        }
    },
    {
        id: 'modules.animationModules',
        section: 'modules',
        group: 'CAT.Troubleshooter.Groups.Conflicts',
        run: () => {
            return applications.WorldMedkit._worldItems().filter(item => automationUtils.getCurrentAutomation(item)).flatMap(item => animationUtils.getModuleAnimationNotices(item).map(detail => ({
                status: 'warn',
                label: item.actor ? `${item.actor.name}: ${item.name}` : item.name,
                detail
            })));
        }
    },
    {
        id: 'permissions.relevant',
        section: 'permissions',
        run: () => TROUBLESHOOTER.permissions.map(key => ({status: 'info', label: _loc(CONST.USER_PERMISSIONS[key].label), detail: usersDetail(key)}))
    },
    settingsDump('dnd5e'),
    settingsDump('cat'),
    settingsDump('chris-premades'),
    settingsDump('dae'),
    {
        id: 'settings.midi-qol',
        section: 'settings',
        get group() {
            return moduleName('midi-qol');
        },
        run: () => {
            const config = game.settings.get('midi-qol', 'ConfigSettings');
            return [
                ...['EnableWorkflow', 'ReplaceDefaultActivities'].map(key => ({status: 'info', label: _loc(game.settings.settings.get(`midi-qol.${key}`).name), detail: formatValue(game.settings.get('midi-qol', key))})),
                ...TROUBLESHOOTER.midiSettings.map(key => {
                    const label = `midi-qol.${key.capitalize()}.Name`;
                    return {status: 'info', label: game.i18n.has(label) ? _loc(label) : `ConfigSettings.${key}`, detail: formatValue(config[key])};
                })
            ];
        }
    },
    {
        id: 'foundry.scene',
        section: 'foundry',
        group: 'CAT.Troubleshooter.Groups.Scene',
        run: () => {
            const scene = canvas.scene;
            if (!scene) return;
            const tokens = scene.tokens.contents;
            const linked = Object.values(Object.groupBy(tokens.filter(token => token.actorLink && token.actor), token => token.actorId)).filter(group => group.length > 1);
            return [
                report('GridType', foundry.utils.invertObject(CONST.GRID_TYPES)[scene.grid.type]),
                report('GridUnits', scene.grid.units),
                report('GridDistance', scene.grid.distance),
                ...['metricLengthUnits', 'metricVolumeUnits', 'metricWeightUnits'].map(key => ({status: 'info', label: game.settings.settings.get(`dnd5e.${key}`).name, detail: String(game.settings.get('dnd5e', key))})),
                ...['walls', 'tokens', 'lights', 'regions', 'tiles'].map(name => ({status: 'info', label: scene[name].documentClass.metadata.labelPlural, detail: String(scene[name].size)})),
                report('ActorlessTokens', tokens.filter(token => !token.actor).length),
                ...linked.map(group => report('LinkedMultiple', `${group[0].actor.name} (${group.length})`))
            ];
        }
    },
    {
        id: 'foundry.documents',
        section: 'foundry',
        group: 'CAT.Troubleshooter.Groups.Game',
        run: () => TROUBLESHOOTER.collections.flatMap(name => {
            const {size, invalidDocumentIds, documentClass} = game[name];
            const type = _loc(documentClass.metadata.labelPlural);
            const invalid = invalidDocumentIds.size && {status: 'info', label: _loc('CAT.Troubleshooter.Report.Invalid', {type}), detail: String(invalidDocumentIds.size)};
            return [{status: 'info', label: type, detail: String(size)}, invalid];
        })
    },
    {
        id: 'foundry.token',
        section: 'foundry',
        group: 'CAT.Troubleshooter.Groups.Game',
        run: () => {
            const token = canvas.tokens?.controlled[0];
            if (!token) return;
            const actor = token.actor;
            const linked = `${_loc('TOKEN.FIELDS.actorLink.label')}: ${_loc(token.document.actorLink ? 'COMMON.Yes' : 'COMMON.No')}`;
            return [
                report('Token', `${token.name} (${token.document.uuid}) ${linked}`),
                actor && report('Actor', `${actor.name} [${actor.type}] (${actor.uuid})`)
            ];
        }
    },
    {
        id: 'importer.detected',
        section: 'importer',
        run: () => {
            const detected = [
                game.modules.get('ddb-importer')?.active && moduleName('ddb-importer'),
                TROUBLESHOOTER.modules.scruvy.some(id => game.modules.has(id)) && _loc('CAT.Troubleshooter.Report.Importer.Molten')
            ].filter(Boolean);
            return {status: 'info', label: 'CAT.Troubleshooter.Report.Importer.Label', detail: detected.join(', ') || _loc('CAT.Troubleshooter.Report.Importer.None')};
        }
    },
    {
        id: 'logs.errors',
        section: 'logs',
        group: 'CAT.Troubleshooter.Groups.Errors',
        run: () => TROUBLESHOOTER.errorStores.flatMap(store => Object.entries(Logging[store]).map(([key, errors]) => ({status: 'info', label: `${store}: ${key}`, detail: `${errors.length}x ${errors.at(-1).message}`})))
    },
    {
        id: 'logs.recent',
        section: 'logs',
        run: () => Logging.logs.map((log, index) => {
            if (Logging.isVerbose(log)) return;
            return {status: 'info', label: log.message, order: -index, labelStatus: log.type === 'ERROR' ? constants.MEDKIT_STATUSES.OUTDATED : constants.MEDKIT_STATUSES.AVAILABLE};
        })
    }
];
function registerChecks() {
    constants.troubleshooter.registerTroubleshooterChecks([
        ...Object.entries(TROUBLESHOOTER.requiredSettings).flatMap(([module, settings]) => Object.entries(settings).map(([key, setting]) => settingCheck({module, key, ...setting}))),
        AUTOMATIONS_CHECK,
        ...TROUBLESHOOTER.modules.defunct.map(id => moduleCheck(id, 'Defunct')),
        ...TROUBLESHOOTER.modules.incompatible.map(id => moduleCheck(id, 'Incompatible')),
        ...REPORT_CHECKS
    ]);
}
const CARDS = {
    settings: {
        sections: ['required'],
        select: row => row.status === 'fail'
    },
    modules: {
        sections: ['modules'],
        filter: check => check.id.startsWith('modules.defunct.') || check.id.startsWith('modules.incompatible.') || ['modules.bothJB2A', 'modules.oneWayDoors', 'modules.argonTargetPicker', 'modules.contentMassApply'].includes(check.id)
    }
};
const CARD_ACTIONS = {
    fix: async card => constants.troubleshooter.fix(await cardRows(card)),
    open: () => {
        new applications.TroubleshooterApp().render({force: true});
        return false;
    }
};
async function cardRows(card) {
    const {sections, filter, select = () => true} = CARDS[card];
    return (await constants.troubleshooter.run({sections, filter})).filter(select);
}
async function startup() {
    for (const card of Object.keys(CARDS)) {
        await ChatMessage.deleteDocuments(game.messages.filter(message => message.getFlag('cat', 'troubleshooter') === card).map(message => message.id));
        if (game.settings.get('cat', 'hideTroubleshooterWarnings')) continue;
        const rows = await cardRows(card);
        if (!rows.length) continue;
        const actions = ['fix', 'open'].filter(action => action !== 'fix' || rows.some(row => row.fixable));
        await ChatMessage.create({
            speaker: {alias: _loc('CAT.Troubleshooter.Title')},
            whisper: ChatMessage.getWhisperRecipients('GM').map(user => user.id),
            content: await foundry.applications.handlebars.renderTemplate('modules/cat/templates/troubleshooter/card.hbs', {
                message: `CAT.Troubleshooter.Card.${card}`,
                groups: Object.entries(Object.groupBy(rows, row => row.group ?? '')).map(([label, rows]) => ({label, rows})),
                actions: actions.map(action => ({action, label: `CAT.Troubleshooter.Card.${action}`}))
            }),
            flags: {cat: {troubleshooter: card}}
        });
    }
}
function onRenderChatMessage(message, html) {
    const card = message.getFlag('cat', 'troubleshooter');
    if (!card) return;
    html.querySelectorAll('[data-cat-troubleshooter]').forEach(button => button.addEventListener('click', async () => {
        if (await CARD_ACTIONS[button.dataset.catTroubleshooter](card) !== false) await message.delete();
    }));
}
export default {
    registerChecks,
    startup,
    onRenderChatMessage
};
