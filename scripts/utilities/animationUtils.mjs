import {constants, ColorMatrix} from '../lib/_module.mjs';
import {genericUtils} from './_module.mjs';
const minSequencerVersion = '3.6.0';
let shownSequencerWarning = false;
/**
 * Look up a registered animation, treating 'none' as unset.
 * @param {object} reference Animation selection.
 * @param {string} reference.source Module that registered the animation.
 * @param {string} reference.identifier Animation identifier.
 * @returns {object|undefined}
 */
function getAnimation({source, identifier}) {
    if (!source || !identifier || source === 'none' || identifier === 'none') return;
    return constants.animations.getAnimation(source, identifier);
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
 * Credit details for Eskie's animation assets.
 * @returns {{name: string, discord: string, patreon: string}}
 */
function getEskieCredits() {
    return {
        name: 'Eskie',
        discord: 'https://discord.gg/RXwkJD4hTe',
        patreon: 'https://www.patreon.com/c/EskieEffects'
    };
}
/**
 * Whether Sequencer is active and new enough, warning once if it is outdated.
 * @returns {boolean}
 */
function sequencerCheck() {
    let sequencer = game.modules.get('sequencer');
    if (!sequencer?.active) return false;
    if (genericUtils.isNewerVersion(minSequencerVersion, sequencer.version)) {
        if (!shownSequencerWarning) {
            shownSequencerWarning = true;
            genericUtils.notify('CAT.Error.OutdatedSequencer', {type: 'warn', format: {minSequencerVersion}});
        }
        return false;
    }
    return true;
}
/**
 * Which JB2A module is active, warning if both are.
 * @returns {'patreon'|'free'|false}
 */
function jb2aCheck() {
    let patreon = game.modules.get('jb2a_patreon')?.active;
    let free = game.modules.get('JB2A_DnD5e')?.active;
    if (patreon && free) {
        genericUtils.notify('CAT.Troubleshooter.BothJB2A', {type: 'warn'});
        return 'patreon';
    }
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
export default {
    getAnimation,
    preloadAnimations,
    simpleAttack,
    buildColorOptions,
    getEskieCredits,
    sequencerCheck,
    jb2aCheck,
    aseCheck,
    colorMatrix
};