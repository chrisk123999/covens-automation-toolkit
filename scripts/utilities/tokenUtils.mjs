function getSavedCastData(token) {
    return token.flags.cat?.castData;
}
export const tokenUtils = {
    getSavedCastData
};