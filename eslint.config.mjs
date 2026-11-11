import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  // Build output and Node tool configs are not plugin code. tsconfig.test.json
  // is JSON and must not be parsed as TypeScript when parserOptions are set.
  globalIgnores([
    "node_modules/**",
    "dist/**",
    "main.js",
    "coverage/**",
    "scripts/**",
    "rollup.config.js",
    "tsconfig.test.json",
  ]),
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The settings tab is highly dynamic (rule editor, file suggesters,
      // organize preview, menu reordering, random ranges). The 1.13
      // declarative API skips display() when getSettingDefinitions() returns
      // a non-empty list, so a partial implementation would hide those
      // controls on 1.13+. minAppVersion stays below 1.13 for getLanguage().
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
  {
    files: ["package.json"],
    rules: {
      // Production uses window.moment / import type only. The package stays
      // as typings + test runtime; Obsidian already ships moment at runtime.
      "depend/ban-dependencies": [
        "error",
        {
          presets: ["native", "microutilities", "preferred"],
          allowed: ["moment"],
        },
      ],
    },
  },
  {
    // The community scanner does not lint test files (its ignores.json).
    files: [
      "**/*.{test,tests,spec,specs}.*",
      "**/__tests__/**",
      "**/__mocks__/**",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "eslint-comments/require-description": "off",
      "eslint-comments/no-restricted-disable": "off",
      "eslint-comments/no-unused-disable": "off",
    },
  },
]);
