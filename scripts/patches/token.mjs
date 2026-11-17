import {Logging} from '../lib/_module.mjs';
import {actorUtils, tokenUtils} from '../utilities/_module.mjs';
/**
 * Whether moving this token drags a grappled creature at extra cost.
 * `flags.cat.grappleDrag.freeSizeOffset` waives it for creatures up to that many sizes larger than the mover.
 * @param {foundry.documents.TokenDocument} token Token moving.
 * @returns {boolean}
 */
function draggingCost(token) {
    const actor = token.actor;
    if (!actor?.effects.some(effect => effect.flags.cat?.identifier === 'grappleSource')) return false;
    if (game.settings.get('dnd5e', 'movementAutomation') === 'none') return false;
    const size = actorUtils.getSize(actor);
    const modern = game.settings.get('dnd5e', 'rulesVersion') === 'modern';
    const freeSizeOffset = actor.flags.cat?.grappleDrag?.freeSizeOffset;
    return tokenUtils.getGrappled(token).some(other => {
        if (!other.actor) return false;
        const otherSize = actorUtils.getSize(other.actor);
        if (size - otherSize >= 2 || (modern && otherSize === 0)) return false;
        return freeSizeOffset === undefined || otherSize > size + Number(freeSizeOffset);
    });
}
function getMovementCostFunction(wrapped, options) {
    const costFunction = wrapped(options);
    if (!draggingCost(this.document)) return costFunction;
    return (from, to, distance, segment) => {
        const cost = costFunction(from, to, distance, segment);
        if (segment.actionConfig?.teleport || !Number.isFinite(cost)) return cost;
        return cost + distance;
    };
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: foundry.canvas.placeables.Token.prototype._getMovementCostFunction', {force: true});
        libWrapper.register('cat', 'foundry.canvas.placeables.Token.prototype._getMovementCostFunction', getMovementCostFunction, 'WRAPPER');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: foundry.canvas.placeables.Token.prototype._getMovementCostFunction');
        libWrapper.unregister('cat', 'foundry.canvas.placeables.Token.prototype._getMovementCostFunction');
    }
}
export default {
    patch
};
