// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  // Formatting is Prettier's job (checked separately); turn off rules that would fight it.
  prettierConfig,
  {
    rules: {
      // React Compiler's immutability rule does not know about Reanimated shared values, whose
      // documented API is `sharedValue.value = ...` inside effects and worklets.
      'react-hooks/immutability': 'off',

      // The app draws its own surfaces. `Alert` and `ToastAndroid` draw the platform's — a white
      // Material box with blue capitalised buttons in the middle of a dark purple app — and they
      // turn up at the moments that matter most, like deleting a task or an account. The
      // replacement is `useDialog()` from components/feedback/Dialog.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Alert', 'ToastAndroid'],
              message:
                'Use useDialog() from src/components/feedback/Dialog so the app asks in its own voice.',
            },
          ],
        },
      ],
    },
  },
  {
    // The dialog is what everything else is pointed at, so it may say the name.
    files: ['src/components/feedback/Dialog.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    ignores: [
      'dist/*',
      '.expo/*',
      // Agent worktrees are second checkouts of this repository, not source.
      '.claude/**',
      // Deno runtime with URL imports; checked with `deno check` instead.
      'supabase/functions/*',
      'scripts/*',
      'src/data/supabase/database.types.ts',
    ],
  },
]);
