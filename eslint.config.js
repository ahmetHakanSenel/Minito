// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  // Formatting is Prettier's job (checked separately); turn off rules that would fight it.
  prettierConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      // Deno runtime with URL imports; checked with `deno check` instead.
      'supabase/functions/*',
      'scripts/*',
      'src/data/supabase/database.types.ts',
    ],
  },
]);
