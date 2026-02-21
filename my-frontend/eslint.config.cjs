const js = require("@eslint/js");
const globals = require("globals");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const jsxA11yPlugin = require("eslint-plugin-jsx-a11y");
const importPlugin = require("eslint-plugin-import");
const sonarjsPlugin = require("eslint-plugin-sonarjs");

module.exports = [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      import: importPlugin,
      sonarjs: sonarjsPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "no-console": "warn",
      "no-debugger": "error",
      eqeqeq: ["error", "always"],
      "no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^React$",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-key": "error",
      "react/no-unknown-property": "error",

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/anchor-is-valid": "warn",

      "import/no-duplicates": "error",
      "import/order": [
        "warn",
        {
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      "sonarjs/no-duplicated-branches": "error",
      "sonarjs/no-identical-functions": "warn",
    },
  },
  {
    files: ["**/*.{test,spec}.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.jest,
        vi: "readonly",
      },
    },
  },
  {
    files: ["src/utils/logger.js"],
    rules: {
      "no-console": "off",
    },
  },
];
