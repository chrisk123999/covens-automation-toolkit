/**
 * Registered animation lookups, simple Sequencer effects and checks for animation modules. Covers Sequencer, JB2A,
 * Animated Spell Effects: Cartoon, AA and BLFX.
 * @module
 */
import {ColorMatrix, constants} from '../lib/_module.mjs';
import {genericUtils} from './_module.mjs';
const minSequencerVersion = '3.6.0';
const blfxModuleIds = ['boss-loot-assets-free', 'boss-loot-assets-premium'];
let shownSequencerWarning = false;
const requirementMap = {
    'animated-spell-effects-cartoon': aseCheck,
    'jb2a_patreon': () => jb2aCheck() === 'patreon',
    'JB2A_DnD5e': () => !!jb2aCheck()
};

/**
 * Look up a registered animation from a config selection. Returns undefined when the selection is empty or `none`,
 * {@link sequencerCheck} fails, or CAT Animations defers to AA/BLFX for the item. Also returns undefined, with a
 * warning, when a requirement of the animation is not met.
 * @param {object} reference             Animation selection, as stored in config.
 * @param {string} reference.source      Module that registered the animation.
 * @param {string} reference.identifier  Animation identifier.
 * @param {object} [options]             Additional options.
 * @param {Item5e} [options.item]        Item the animation plays for, checked with {@link deferredToAABLFX}.
 * @returns {object|undefined}           The registered animation.
 * @example
 * const animation = animationUtils.getAnimation(automationUtils.getConfigValue(item, 'animation'), {item});
 * if (animation?.macros?.play) await animation.macros.play(token.document, target);
 */
function getAnimation({source, identifier}, {item} = {}) {
    if (!source || !identifier || source === 'none' || identifier === 'none') return;
    if (!sequencerCheck() || deferredToAABLFX(item)) return;
    const result = constants.animations.getAnimation(source, identifier);
    const missing = result?.requirements?.find(requirement => !meetsRequirement(requirement));
    if (missing) {
        genericUtils.notify('CAT.Error.NoAnimations', {type: 'warn', format: {module: missing}});
        return;
    }
    return result;
}
/**
 * Whether an animation requirement is met. `jb2a_patreon` needs the JB2A Patreon module, `JB2A_DnD5e` accepts either
 * JB2A module, and any other value must be an active module id.
 * @param {string} requirement  Requirement key or module id.
 * @returns {boolean}
 * @example
 * animationUtils.meetsRequirement('JB2A_DnD5e'); // true with free or Patreon JB2A active
 */
function meetsRequirement(requirement) {
    return requirementMap[requirement]?.() ?? !!game.modules.get(requirement)?.active;
}
/**
 * Preload animation files on every connected client through Sequencer's preloader. Does nothing when
 * {@link sequencerCheck} fails.
 * @param {string[]} animations                Sequencer database paths or file paths to preload.
 * @param {object} [options]                   Additional options.
 * @param {boolean} [options.showProgressBar]  Show Sequencer's preload progress bar.
 * @returns {Promise<boolean|undefined>}       Sequencer's preload result, or undefined when Sequencer is unavailable.
 * @example
 * await animationUtils.preloadAnimations(['jb2a.fireball.explosion.orange']);
 */
async function preloadAnimations(animations, {showProgressBar} = {}) {
    if (!sequencerCheck()) return;
    return await Sequencer.Preloader.preloadForClients(animations, showProgressBar);
}
/**
 * Play an effect stretched from one token to another, with an optional sound. Does nothing when {@link sequencerCheck}
 * fails. The sequence is not awaited.
 * @param {foundry.documents.TokenDocument} sourceToken  Token making the attack.
 * @param {foundry.documents.TokenDocument} targetToken  Token being attacked.
 * @param {string} animation                             Sequencer database path or file path.
 * @param {object} [options]                             Additional options.
 * @param {string} [options.sound]                       Sound file played with the animation.
 * @param {boolean} [options.missed]                     Offset the effect so it misses the target.
 * @example
 * animationUtils.simpleAttack(workflow.token.document, target.document, 'jb2a.arrow.physical.white', {missed: !workflow.hitTargets.has(target)});
 */
function simpleAttack(sourceToken, targetToken, animation, {sound, missed = false} = {}) {
    if (!sequencerCheck()) return;
    /* eslint-disable indent */
    new Sequence({moduleName: 'cat'})
        .effect()
            .atLocation(sourceToken)
            .stretchTo(targetToken)
            .file(animation)
            .missed(missed)
        .sound().name(constants.soundName)
            .playIf(sound)
            .file(sound)
        .play();
    /* eslint-enable indent */
}
/**
 * Build the choices for an animation's color config. Colors not in `freeColors` carry `requirements`, as do the
 * optional random and cycle choices.
 * @param {Record<string, string>} colorMap  Color keys mapped to their labels.
 * @param {object} [options]                 Additional options.
 * @param {string[]} [options.freeColors]    Colors offered without requirements.
 * @param {string} [options.labelPrefix]     Prefix added to every label, such as a localization key path.
 * @param {boolean} [options.random]         Add a `random` choice.
 * @param {boolean} [options.cycle]          Add a `cycle` choice.
 * @param {string[]} [options.requirements]  Requirements attached to the gated choices.
 * @returns {Record<string, object>}         Choices keyed by color, each with a `label` and, when gated,
 *                                           `requirements`.
 * @example
 * const options = animationUtils.buildColorOptions({orange: 'Orange', blue: 'Blue'}, {freeColors: ['orange'], random: true, requirements: ['jb2a_patreon']});
 * // {orange: {label: 'Orange'}, blue: {label: 'Blue', requirements: ['jb2a_patreon']}, random: {label: 'Random', requirements: ['jb2a_patreon']}}
 */
function buildColorOptions(colorMap, {freeColors = [], labelPrefix = '', random, cycle, requirements = []} = {}) {
    const options = {};
    for (const [key, label] of Object.entries(colorMap)) {
        options[key] = {label: labelPrefix + label};
        if (!freeColors.includes(key)) options[key].requirements = requirements;
    }
    if (random) options.random = {label: labelPrefix + 'Random', requirements};
    if (cycle) options.cycle = {label: labelPrefix + 'Cycle', requirements};
    return options;
}
/**
 * Credit details for an animation author. Known authors are `eskie` and `tyler`.
 * @param {string} [author]  Author key.
 * @returns {{name: string, discord?: string, patreon?: string}}
 *                           `{name: 'The Coven'}` when the author is missing or unknown.
 * @example
 * animationUtils.getCredits('eskie').name; // 'Eskie'
 */
function getCredits(author) {
    const authors = {
        eskie: {name: 'Eskie', discord: 'https://discord.gg/RXwkJD4hTe', patreon: 'https://www.patreon.com/c/EskieEffects'},
        tyler: {name: 'Tyler', discord: 'https://discord.gg/PzzUwU9gdz', patreon: 'https://www.patreon.com/3deathsaves'}
    };
    return authors[author] ?? {name: 'The Coven'};
}
/**
 * Whether CAT animations can play. False when the Animation Priority setting is `off`, or when Sequencer is missing or
 * older than 3.6.0. The missing or outdated Sequencer warning shows once per session.
 * @returns {boolean}
 * @example
 * if (!animationUtils.sequencerCheck()) return;
 */
function sequencerCheck() {
    if (game.settings.get('cat', 'animationPriority') === 'off') return false;
    const sequencer = game.modules.get('sequencer');
    const missing = !sequencer?.active;
    if (!missing && !genericUtils.isNewerVersion(minSequencerVersion, sequencer.version)) return true;
    if (!shownSequencerWarning) {
        shownSequencerWarning = true;
        genericUtils.notify(missing ? 'CAT.Error.NoSequencer' : 'CAT.Error.OutdatedSequencer', {type: 'warn', format: {minSequencerVersion}});
    }
    return false;
}
/**
 * Which JB2A module is active, preferring Patreon when both are.
 * @returns {'patreon'|'free'|false}  False when neither is active.
 * @example
 * const path = animationUtils.jb2aCheck() === 'patreon' ? 'jb2a.fireball.explosion.purple' : 'jb2a.fireball.explosion.orange';
 */
function jb2aCheck() {
    let patreon = game.modules.get('jb2a_patreon')?.active;
    let free = game.modules.get('JB2A_DnD5e')?.active;
    if (patreon) return 'patreon';
    if (free) return 'free';
    return false;
}
/**
 * Whether Animated Spell Effects: Cartoon is active.
 * @returns {boolean}
 * @example
 * if (!animationUtils.aseCheck()) return;
 */
function aseCheck() {
    return !!game.modules.get('animated-spell-effects-cartoon')?.active;
}
/**
 * Color matrix filter values that recolor a known animation to a known color. Returns the default matrix when either
 * key is unknown.
 * @param {string} animation  A key of `ColorMatrix.animations`.
 * @param {string} color      A key of `ColorMatrix.colors`: a spell school abbreviation such as `evo`, or a damage
 *                            type.
 * @returns {{brightness: number, saturate: number, hue: number}}
 * @example
 * const matrix = animationUtils.colorMatrix('jb2a.impact.010.orange', 'cold');
 * new Sequence().effect().file('jb2a.impact.010.orange').atLocation(token).filter('ColorMatrix', matrix).play();
 */
function colorMatrix(animation, color) {
    if (!Object.keys(ColorMatrix.animations).includes(animation) || !Object.keys(ColorMatrix.colors).includes(color)) return {...ColorMatrix.defaultMatrix};
    let matrix = {
        brightness: ColorMatrix.colors[color].brightness + 1,
        saturate: ColorMatrix.colors[color].saturate - ColorMatrix.animations[animation].saturate,
        hue: ColorMatrix.colors[color].hue - ColorMatrix.animations[animation].hue
    };
    return matrix;
}
/**
 * Whether AA would animate the item. Checks the item's own AA flags first, then the Automatic Recognition menus matched
 * against the item name. False when AA is inactive.
 * @param {Item5e} item  Item to check.
 * @returns {boolean}
 * @example
 * if (animationUtils.hasAutomatedAnimation(item)) return;
 */
function hasAutomatedAnimation(item) {
    if (!game.modules.get('autoanimations')?.active) return false;
    const flags = item.flags.autoanimations ?? {};
    if (flags.killAnim || flags.isEnabled === false) return false;
    if (flags.isCustomized) return true;
    if (game.settings.get('autoanimations', 'disableAutoRec')) return false;
    const rinse = name => name.replace(/\s+/g, '').toLowerCase();
    const name = rinse(item.name);
    return ['melee', 'range', 'ontoken', 'templatefx', 'aura', 'preset'].flatMap(menu => game.settings.get('autoanimations', 'aaAutorec-' + menu) ?? []).some(entry => {
        if (!entry.label) return false;
        if (entry.advanced?.exactMatch) return entry.label === item.name;
        return name.includes(rinse(entry.label)) && !entry.advanced?.excludedTerms?.some(term => name.includes(rinse(term)));
    });
}
/**
 * Whether an active BLFX module has an animation macro assigned to the item.
 * @param {Item5e} item  Item to check.
 * @returns {boolean}
 * @example
 * if (animationUtils.hasBossLootAnimation(item)) return;
 */
function hasBossLootAnimation(item) {
    return blfxModuleIds.some(id => game.modules.get(id)?.active && Object.values(item.flags[id] ?? {}).some(entry => entry?.command));
}
/**
 * Whether CAT Animations skips the item so AA or BLFX can animate it instead. Only true when the Animation Priority
 * setting is `module` and AA or BLFX has an animation for the item.
 * @param {Item5e} [item]  Item to check. False when missing or not an item.
 * @returns {boolean}
 * @example
 * if (animationUtils.deferredToAABLFX(workflow.item)) return;
 */
function deferredToAABLFX(item) {
    if (!item?.system || game.settings.get('cat', 'animationPriority') !== 'module') return false;
    return hasAutomatedAnimation(item) || hasBossLootAnimation(item);
}
/**
 * Localized notices for AA or BLFX animations that still play alongside the item's CAT animation. AA is only reported
 * when the Animation Priority setting is `both`. Returns an empty array when the setting is `module` or `off`.
 * @param {Item5e} item  Item to check.
 * @returns {string[]}
 * @example
 * const notices = animationUtils.getModuleAnimationNotices(item);
 */
function getModuleAnimationNotices(item) {
    const priority = game.settings.get('cat', 'animationPriority');
    if (['module', 'off'].includes(priority)) return [];
    const notices = [];
    if (priority === 'both' && hasAutomatedAnimation(item)) notices.push(game.i18n.format('CAT.Troubleshooter.Report.ModuleAnimation', {module: game.modules.get('autoanimations').title}));
    if (hasBossLootAnimation(item)) notices.push(priority === 'cat' ? game.i18n.localize('CAT.Troubleshooter.Report.BLFXOverride') : game.i18n.format('CAT.Troubleshooter.Report.ModuleAnimation', {module: 'BLFX'}));
    return notices;
}
/**
 * Check whether a sound can play on this client. Returns false for an empty value, when {@link sequencerCheck} fails,
 * and for a Sequencer database path that no active module registers, such as a PSFX path without PSFX or a PSFX
 * Patreon path with only free PSFX.
 * @param {string} file  Audio file path or Sequencer database path.
 * @returns {boolean}    True when the sound can play.
 * @example
 * animationUtils.soundAvailable('psfx.impacts.slashing.v1'); // true while PSFX is active
 * animationUtils.soundAvailable('sounds/dice.wav'); // true
 */
function soundAvailable(file) {
    if (!file || !sequencerCheck()) return false;
    return file.includes('/') || Sequencer.Database.entryExists(file);
}
/**
 * Play an audio file or Sequencer database path for every connected client. Players with Enable Sound FX turned off
 * hear nothing.
 * @param {string} file             Audio file path or Sequencer database path.
 * @param {object} [options]        Additional options.
 * @param {number} [options.volume] Volume from 0 to 1. Defaults to 0.8.
 * @param {number} [options.delay]  Milliseconds before the sound starts. Defaults to 0.
 * @returns {Promise|undefined}     The `Sequence#play` promise, or undefined when nothing plays.
 * @example
 * // A swing, then the hit 400ms later
 * animationUtils.playSound('psfx.weapon-attacks.sword.v1');
 * animationUtils.playSound('psfx.impacts.slashing.v1', {delay: 400});
 */
function playSound(file, {volume = 0.8, delay = 0} = {}) {
    if (!soundAvailable(file)) return;
    return new Sequence().sound().name(constants.soundName).file(file).volume(volume).delay(delay).play();
}
/**
 * Empty the `sound` and `impactSound` values of a resolved animation config that fail {@link soundAvailable}. An
 * animation that plays these sounds itself then skips them instead of making Sequencer log a missing file.
 * @param {object} config  Resolved animation config values.
 * @returns {object}       The same config object.
 * @example
 * animationUtils.clearUnavailableSounds({sound: 'psfx.not.installed', impactSound: 'psfx.impacts.slashing.v1', color: 'red'});
 * // {sound: '', impactSound: 'psfx.impacts.slashing.v1', color: 'red'}
 */
function clearUnavailableSounds(config) {
    ['sound', 'impactSound'].forEach(key => {
        if (config[key] && !soundAvailable(config[key])) config[key] = '';
    });
    return config;
}
export default {
    getAnimation,
    preloadAnimations,
    simpleAttack,
    buildColorOptions,
    getCredits,
    sequencerCheck,
    jb2aCheck,
    meetsRequirement,
    aseCheck,
    colorMatrix,
    hasAutomatedAnimation,
    hasBossLootAnimation,
    getModuleAnimationNotices,
    deferredToAABLFX,
    soundAvailable,
    playSound,
    clearUnavailableSounds
};
