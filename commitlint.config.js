module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'core',
        'cdk',
        'components',
        'query',
        'eslint-plugin',
        'types',
        'cli',
        'contentful',
        'eslint-plugin',
        'playground',
        'docs',
        'deps',
        'ci',
        'release',
        'repo',
      ],
    ],
    'scope-empty': [2, 'never'], // Require scope
    'subject-case': [2, 'always', 'sentence-case'],
  },
};
