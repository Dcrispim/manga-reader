import tseslint from 'typescript-eslint';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fs',
              message: 'api-contract must stay I/O-free; import types only from @manga/core',
            },
            {
              name: 'path',
              message: 'api-contract must stay I/O-free; import types only from @manga/core',
            },
            {
              name: 'react',
              message: 'api-contract must stay I/O-free; import types only from @manga/core',
            },
            {
              name: 'react-native',
              message: 'api-contract must stay I/O-free; import types only from @manga/core',
            },
          ],
          patterns: [
            {
              group: ['fs/*', 'node:*', 'expo', 'expo/*', 'expo-*', 'next', 'next/*'],
              message: 'api-contract must stay I/O-free; import types only from @manga/core',
            },
          ],
        },
      ],
    },
  },
];
