const js = require("@eslint/js");

module.exports = [
    js.configs.recommended,
    {
        files: ["src/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                process: "readonly",
                require: "readonly",
                module: "readonly",
                __dirname: "readonly",
                Buffer: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearTimeout: "readonly",
                clearInterval: "readonly",
                console: "readonly"
            }
        },
        rules: {
            "no-console": "off",
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
        }
    }
];
