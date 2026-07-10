import {constants, ColorMatrix} from '../lib/_module.mjs';
import {genericUtils} from './_module.mjs';
const minSequencerVersion = '3.6.0';
let shownSequencerWarning = false;
function getAnimation({source, identifier}) {
    if (!source || !identifier || source === 'none' || identifier === 'none') return;
    return constants.animations.getAnimation(source, identifier);
}
async function preloadAnimations(animations, {showProgressBar} = {}) {
    return await Sequencer.Preloader.preloadForClients(animations, showProgressBar);
}
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
function getEskieCredits() {
    return {
        name: 'Eskie',
        discord: 'https://discord.gg/RXwkJD4hTe',
        patreon: 'https://www.patreon.com/c/EskieEffects'
    };
}
function sequencerCheck() {
    let sequencer = game.modules.get('sequencer');
    if (!sequencer?.active) return false;
    if (genericUtils.isNewerVersion(minSequencerVersion, sequencer.version)) {
        if (!shownSequencerWarning) {
            shownSequencerWarning = true;
            let sequencerAlert = genericUtils.format('CAT.Error.OutdatedSequencer', {minSequencerVersion});
            genericUtils.notify(sequencerAlert, 'warn');
        }
        return false;
    }
    return true;
}
function jb2aCheck() {
    let patreon = game.modules.get('jb2a_patreon')?.active;
    let free = game.modules.get('JB2A_DnD5e')?.active;
    if (patreon && free) {
        genericUtils.notify('CAT.Troubleshooter.BothJB2A', 'warn', {localize: true});
        return 'patreon';
    }
    if (patreon) return 'patreon';
    if (free) return 'free';
    return false;
}
function aseCheck() {
    let isActive = game.modules.get('animated-spell-effects-cartoon')?.active;
    return isActive;
}
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