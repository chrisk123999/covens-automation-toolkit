import {Logging} from '../lib/_module.mjs';
import CatRollResolver from '../applications/dice/roll-resolver.mjs';
const FULFILLABLE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
function register() {
    CONFIG.Dice.fulfillment.methods.cat = {
        label: 'CAT.Manual.MethodLabel',
        icon: '<i class="fa-solid fa-dice-d20"></i>',
        interactive: true,
        resolver: CatRollResolver
    };
}
function unregister() {
    delete CONFIG.Dice.fulfillment.methods.cat;
}
function force(enabled) {
    if (enabled) register(); else unregister();
    const method = enabled ? 'cat' : '';
    CONFIG.Dice.fulfillment.defaultMethod = method;
    const config = Object.fromEntries(FULFILLABLE.map(d => [d, method]));
    return game.settings.set('core', Roll.DICE_CONFIGURATION_SETTING, config);
}
async function buildEvaluate(wrapped, rolls = [], config = {}, message = {}) {
    const resolverClass = CONFIG.Dice.fulfillment.methods.cat?.resolver;
    if (resolverClass && config.evaluate !== false) {
        const diceConfig = game.settings.get('core', Roll.DICE_CONFIGURATION_SETTING) ?? {};
        const isCat = term => (diceConfig[term.denomination] || diceConfig.default || CONFIG.Dice.fulfillment.defaultMethod) === 'cat';
        const isDamage = roll => CONFIG.Dice?.DamageRoll && roll instanceof CONFIG.Dice.DamageRoll;
        const manualRolls = rolls.filter(roll => !isDamage(roll) && Roll.defaultImplementation.identifyFulfillableTerms(roll.terms).some(isCat));
        if (manualRolls.length) {
            const subject = config.subject;
            const workflowId = config.midiOptions?.workflowId ?? subject?.uuid;
            if (workflowId) for (const roll of manualRolls) roll.options.workflowId = workflowId;
            if (manualRolls.length > 1) {
                const label = subject?.item?.name ? `${subject.item.name} — ${subject.name}` : undefined;
                await resolverClass.fulfillBatch(manualRolls, label);
                for (const roll of rolls) await roll.evaluate({allowInteractive: false});
                return;
            }
        }
    }
    return wrapped(rolls, config, message);
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dice.BasicRoll.buildEvaluate', {force: true});
        libWrapper.register('cat', 'dnd5e.dice.BasicRoll.buildEvaluate', buildEvaluate, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dice.BasicRoll.buildEvaluate');
        libWrapper.unregister('cat', 'dnd5e.dice.BasicRoll.buildEvaluate');
    }
}
export default {
    patch,
    force
};
