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
        key: 'displayDebugLogs',
        type: Boolean,
        default: true // Change this to false eventually.
    });
    addSetting({
        key: 'automationSources',
        type: Object,
        default: {
            dnd5e: {
                enabled: true,
                priority: 100
            },
            'dnd-players-handbook': {
                enabled: true,
                priority: 99
            },
            'ddb-importer': {
                enabled: true,
                priority: 98
            },
            'midi-qol': {
                enabled: true,
                priority: 97
            }
        }
    });
}