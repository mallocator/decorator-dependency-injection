import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import babelParser from "@babel/eslint-parser";

export default defineConfig([
  // Recommended base config
  js.configs.recommended,

  // Global ignores
  {
    ignores: ["node_modules/**", "coverage/**", "docs/**", ".history/**"]
  },

  // Source files configuration
  {
    name: "source-files",
    files: ["index.js", "src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: babelParser,
      parserOptions: {
        requireConfigFile: true,
        babelOptions: {
          configFile: "./babel.config.json"
        }
      },
      globals: {
        console: "readonly",
        process: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],
      "no-throw-literal": "error"
    }
  },

  // Test files with relaxed rules and Jest globals
  {
    name: "test-files",
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: babelParser,
      parserOptions: {
        requireConfigFile: true,
        babelOptions: {
          configFile: "./babel.config.json"
        }
      },
      globals: {
        console: "readonly",
        process: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
        fail: "readonly"
      }
    },
    rules: {
      // In tests, decorated classes are used by the decorator system, not directly
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  }
]);
