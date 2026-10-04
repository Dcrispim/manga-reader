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
              message: 'core must stay I/O-free; inject an adapter',
            },
            {
              name: 'path',
              message: 'core must stay I/O-free; inject an adapter',
            },
            {
              name: 'react',
              message: 'core must stay I/O-free; inject an adapter',
            },
            {
              name: 'react-native',
              message: 'core must stay I/O-free; inject an adapter',
            },
          ],
          patterns: [
            {
              group: ['fs/*', 'node:*', 'expo', 'expo/*', 'expo-*', 'next', 'next/*'],
              message: 'core must stay I/O-free; inject an adapter',
            },
          ],
        },
      ],
    },
  },
];
