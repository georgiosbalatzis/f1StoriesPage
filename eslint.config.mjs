import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.build/**',
      'blog-module/blog-entries/**',
      '**/*.min.js',
      '**/*.map',
      'scripts/build/asset-manifest.json'
    ]
  },
  {
    files: ['scripts/**/*.js', 'scripts/**/*.mjs', 'config/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      'no-debugger': 'error',
      'no-constant-condition': 'warn',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }]
    }
  },
  {
    files: ['standings/**/*.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker }
    },
    rules: {
      'no-debugger': 'error',
      'no-constant-condition': 'warn',
      'no-unused-vars': 'off'
    }
  }
];
