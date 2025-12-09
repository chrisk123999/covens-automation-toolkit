function getCastData(effect) {
    return effect.flags?.cat?.castData ?? effect.flags['midi-qol']?.castData;
}
export const effectUtils = {
    getCastData
};