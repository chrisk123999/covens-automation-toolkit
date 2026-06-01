import {constants} from '../lib/_module.mjs';
function getAnimation(source, identifier) {
    return constants.animations.getAnimation(source, identifier);
}
async function preloadAnimations(animations, {showProgressBar} = {}) {
    return await Sequencer.Preloader.preloadForClients(animations, showProgressBar);
}
export default {
    getAnimation,
    preloadAnimations
};