const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
module.exports = {
    devtool: 'source-map',
    entry: './scripts/module.mjs',
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    format: {
                        comments: false
                    }
                },
                extractComments: false
            })
        ]
    },
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist')
    }
};