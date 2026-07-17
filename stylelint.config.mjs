export default {
  ignoreFiles: ['**/*.min.css', 'dist/**', '.build/**', 'node_modules/**'],
  // Parsing is the initial ratchet; stylistic rules will be enabled per subsystem.
  rules: {},
  overrides: [
    {
      files: ['styles/layers.css'],
      rules: {
        'selector-max-specificity': '0,3,0',
        'declaration-no-important': true
      }
    }
  ]
};
