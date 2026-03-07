module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  globals: {
    'TRIGRAMS': 'readonly',
    'getShichen': 'readonly',
    'DivinationEngine': 'readonly',
    'GanzhiCalendar': 'readonly',
    'getEnergyState': 'readonly',
    'modalSettings': 'readonly'
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'error'
  }
};
