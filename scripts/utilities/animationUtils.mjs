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
 * Look up a registered animation, treating 'none' as unset.
 * @param {object} reference Animation selection.
 * @param {string} reference.source Module that registered the animation.
 * @param {string} reference.identifier Animation identifier.
 * @param {object} [options]
 * @param {Item5e} [options.item] Item the animation belongs to, skipped when CAT Animations defers to AA/BLFX for it.
 * @returns {object|undefined}
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
 * Whether an animation requirement is met: a known asset tier or an active module.
 * @param {string} requirement Requirement key or module id.
 * @returns {boolean}
 */
function meetsRequirement(requirement) {
    return requirementMap[requirement]?.() ?? !!game.modules.get(requirement)?.active;
}
/**
 * Preload animation files for all clients.
 * @param {string[]} animations Sequencer database paths to preload.
 * @param {object} [options] Additional options.
 * @param {boolean} [options.showProgressBar] Show Sequencer’s preload progress bar.
 * @returns {Promise<boolean>}
 */
async function preloadAnimations(animations, {showProgressBar} = {}) {
    return await Sequencer.Preloader.preloadForClients(animations, showProgressBar);
}
/**
 * Play a ranged attack effect stretched from one token to another.
 * @param {foundry.documents.TokenDocument} sourceToken Token making the attack.
 * @param {foundry.documents.TokenDocument} targetToken Token being attacked.
 * @param {string} animation Sequencer database path or file path.
 * @param {object} [options] Additional options.
 * @param {string} [options.sound] Sound file played with the animation.
 * @param {boolean} [options.missed] Play the miss variant.
 */
function simpleAttack(sourceToken, targetToken, animation, {sound, missed = false} = {}) {
    if (!sequencerCheck()) return;
    /* eslint-disable indent */
    new Sequence()
        .effect()
            .atLocation(sourceToken)
            .stretchTo(targetToken)
            .file(animation)
            .missed(missed)
        .sound()
            .playIf(sound)
            .file(sound)
        .play();
    /* eslint-enable indent */
}
/**
 * Build animation config colour options, gating non-free colours behind requirements.
 * @param {Record<string, string>} colorMap Colour keys mapped to their labels.
 * @param {object} [options] Additional options.
 * @param {string[]} [options.freeColors] Colours offered without requirements.
 * @param {string} [options.labelPrefix] Localization prefix the colour labels are appended to.
 * @param {boolean} [options.random] Offer a random colour option.
 * @param {boolean} [options.cycle] Offer a cycling colour option.
 * @param {string[]} [options.requirements] Modules required by the gated colours.
 * @returns {Record<string, object>}
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
 * Credit details for an animation's author.
 * @param {string} [author] Author key, such as 'eskie'.
 * @returns {{name: string, discord?: string, patreon?: string}} The Coven when the author is missing or unknown.
 */
function getCredits(author) {
    const authors = {
        eskie: {name: 'Eskie', discord: 'https://discord.gg/RXwkJD4hTe', patreon: 'https://www.patreon.com/c/EskieEffects'},
        tyler: {name: 'Tyler', discord: 'https://discord.gg/PzzUwU9gdz', patreon: 'https://www.patreon.com/3deathsaves'}
    };
    return authors[author] ?? {name: 'The Coven'};
}
/**
 * Whether animations can play, warning once per session when Sequencer is missing or outdated.
 * @returns {boolean}
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
 * Which JB2A module is active, preferring patreon.
 * @returns {'patreon'|'free'|false}
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
 */
function aseCheck() {
    let isActive = game.modules.get('animated-spell-effects-cartoon')?.active;
    return isActive;
}
/**
 * Colour matrix filter values recolouring an animation, or the default matrix if either key is unknown.
 * @param {string} animation A key of ColorMatrix.animations.
 * @param {string} color A key of ColorMatrix.colors.
 * @returns {object}
 */
function colorMatrix(animation, color) {
    if (!Object.keys(ColorMatrix.animations).includes(animation)) return ColorMatrix.defaultMatrix;
    if (!Object.keys(ColorMatrix.colors).includes(color)) return ColorMatrix.defaultMatrix;
    let matrix = {
        brightness: ColorMatrix.colors[color].brightness + 1,
        saturate: ColorMatrix.colors[color].saturate - ColorMatrix.animations[animation].saturate,
        hue: ColorMatrix.colors[color].hue - ColorMatrix.animations[animation].hue
    };
    return matrix;
}
/**
 * Whether Automated Animations would animate the item, from its own flags or its Automatic Recognition menus.
 * @param {Item5e} item The item to check.
 * @returns {boolean}
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
 * Whether an active Boss Loot FX module has an animation macro assigned to the item.
 * @param {Item5e} item The item to check.
 * @returns {boolean}
 */
function hasBossLootAnimation(item) {
    return blfxModuleIds.some(id => game.modules.get(id)?.active && Object.values(item.flags[id] ?? {}).some(entry => entry?.command));
}
/**
 * Whether CAT Animations defers to AA/BLFX for this item.
 * @param {Item5e} [item] The item to check.
 * @returns {boolean}
 */
function deferredToAABLFX(item) {
    if (!item?.system || game.settings.get('cat', 'animationPriority') !== 'module') return false;
    return hasAutomatedAnimation(item) || hasBossLootAnimation(item);
}
/**
 * Notices for AA/BLFX animations that still play alongside the item's CAT animation.
 * @param {Item5e} item The item to check.
 * @returns {string[]}
 */
function getModuleAnimationNotices(item) {
    const priority = game.settings.get('cat', 'animationPriority');
    if (['module', 'off'].includes(priority)) return [];
    const notices = [];
    if (priority === 'both' && hasAutomatedAnimation(item)) notices.push(game.i18n.format('CAT.Troubleshooter.Report.ModuleAnimation', {module: game.modules.get('autoanimations').title}));
    if (hasBossLootAnimation(item)) notices.push(priority === 'cat' ? game.i18n.localize('CAT.Troubleshooter.Report.BLFXOverride') : game.i18n.format('CAT.Troubleshooter.Report.ModuleAnimation', {module: 'BLFX'}));
    return notices;
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
    deferredToAABLFX
};
