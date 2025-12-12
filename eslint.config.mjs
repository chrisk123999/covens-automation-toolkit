import {defineConfig, globalIgnores} from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    globalIgnores(['foundry/**/*']),
    {
        extends: compat.extends('eslint:recommended'),
        plugins: {
            '@stylistic': stylistic
        },
        languageOptions: {
            globals: {
                ...globals.browser,
                chrisPremades: 'writable',
                DAE: 'writable',
                libWrapper: 'writable',
                MidiQOL: 'writable',
                Sequence: 'writable',
                Sequencer: 'writable',
                socketlib: 'writable',
                Hooks: 'writable',
                fromUuid: 'writable',
                fromUuidSync: 'writable',
                canvas: 'writable',
                foundry: 'writable',
                game: 'writable',
                TokenDocument: 'writable',
                CONFIG: 'writable'
            },

            ecmaVersion: 'latest',
            sourceType: 'module'
        },
        rules: {
            indent: ['error', 4, {
                SwitchCase: 1
            }],
            quotes: ['error', 'single', {
                avoidEscape: true,
                allowTemplateLiterals: true
            }],
            semi: ['error', 'always'],
            'no-unused-vars': ['off'],
            'no-inner-declarations': ['off'],
            '@stylistic/object-curly-spacing': ['error', 'never'],
            'space-infix-ops': 'error',
            'comma-dangle': ['error', 'never']
        }
    }
]);