import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  // Base JS + TS support
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    ignores: ["dist/**", "node_modules/**"],
    plugins: { js },
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },

  // TS-specific rules
  ...tseslint.configs.recommended,
]);
