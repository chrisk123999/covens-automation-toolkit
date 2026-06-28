import {constants} from '../lib/_module.mjs';
function getAnimation({source, identifier}) {
    if (!source || !identifier) return;
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
export default {
    getAnimation,
    preloadAnimations,
    simpleAttack,
    buildColorOptions
};