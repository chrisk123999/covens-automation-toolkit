function addSetting(options) {
    const setting = {
        scope: options.scope ?? 'world',
        config: false,
        type: options.type,
        default: options.default,
        onChange: options.onChange,
        choices: options.choices,
        reloadRequired: options.reloadRequired,
        select: options.select
    };
    game.settings.register('cat', options.key, setting);
}
export function registerSettings() {
    addSetting({
        key: 'gmID',
        type: String,
        default: ''
    });
}