import DialogApp from '../applications/dialog.mjs';
// TODO: uncomment when socket layer exists
// import {socket, sockets} from '../sockets.mjs';

async function confirm(title, content, {userId = game.user.id, buttons = 'yesNo'} = {}) {
    let selection;
    // TODO: uncomment when socket layer exists
    // if (userId !== game.user.id) {
    //     selection = await socket.executeAsUser(sockets.dialog.name, userId, title, content, [], buttons);
    // } else selection = await DialogApp.dialog(title, content, [], buttons);
    selection = await DialogApp.dialog(title, content, [], buttons);
    return selection?.buttons;
}
async function buttonDialog(title, content, buttons, {displayAsRows = true, userId = game.user.id} = {}) {
    let inputs = [
        ['button', [], {displayAsRows: displayAsRows}]
    ];
    for (let [label, value, options] of buttons) {
        inputs[0][1].push({label: label, name: value, options: options ?? {}});
    }
    let result;
    // TODO: uncomment when socket layer exists
    // if (userId != game.user.id) {
    //     result = await socket.executeAsUser(sockets.dialog.name, userId, title, content, inputs, undefined, {width: 400});
    // } else result = await DialogApp.dialog(title, content, inputs, undefined, {width: 400});
    result = await DialogApp.dialog(title, content, inputs, undefined, {width: 400});
    return result?.buttons ?? false;
}
async function numberDialog(title, content, input = {label: 'Label', name: 'identifier', options: {}}, {buttons = 'okCancel', userId = game.user.id} = {}) {
    let inputs = [
        ['number',
            [{
                label: input.label,
                name: input.name,
                options: input.options
            }]
        ]
    ];
    let result;
    // TODO: uncomment when socket layer exists
    // if (userId && userId != game.user.id) {
    //     result = await socket.executeAsUser(sockets.dialog.name, userId, title, content, inputs, buttons);
    // } else result = await DialogApp.dialog(title, content, inputs, buttons);
    result = await DialogApp.dialog(title, content, inputs, buttons);
    return result[input.name];
}
async function selectDialog(title, content, input = {label: 'Label', name: 'identifier', options: {}}, {buttons = 'okCancel', userId = game.user.id} = {}) {
    if (!input.options) input.options = {};
    let inputOptions = input.options.options ?? [];
    if (!inputOptions.length) inputOptions = [game.i18n.localize('DND5E.None')];
    if (inputOptions[0].label === undefined) {
        inputOptions = inputOptions.map(text => {return {value: text, label: text};});
    }
    input.options.options = inputOptions;
    let inputs = [
        ['selectOption',
            [{
                label: input.label,
                name: input.name,
                options: input.options
            }]
        ]
    ];
    let result;
    // TODO: uncomment when socket layer exists
    // if (userId && userId != game.user.id) {
    //     result = await socket.executeAsUser(sockets.dialog.name, userId, title, content, inputs, buttons);
    // } else result = await DialogApp.dialog(title, content, inputs, buttons);
    result = await DialogApp.dialog(title, content, inputs, buttons);
    return result?.[input.name];
}
export default {
    confirm,
    buttonDialog,
    numberDialog,
    selectDialog
};
