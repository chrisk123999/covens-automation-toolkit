import {tokens} from '../handlers/_module.mjs';
function preDeleteToken(token, options, userId) {
    return tokens.preDeleteToken(token, options);
}
export default {
    preDeleteToken
};