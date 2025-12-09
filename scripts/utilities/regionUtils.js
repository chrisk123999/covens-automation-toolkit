function getCastData(region) {
    return region.flags.cat?.castData ?? region.flags['midi-qol']?.castData;
}
export const regionUtils = {
    getCastData
};