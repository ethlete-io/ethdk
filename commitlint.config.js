const AGENT_ATTRIBUTION =
  /^(?:co-authored-by:\s*(?:claude|codex|cursor|copilot|chatgpt|gpt[-\s]|gemini|devin|aider|openai|anthropic)|(?:claude|codex|agent)-session:|(?:🤖\s*)?generated with\b|assisted-by:|ai-generated-by:)/i;

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-agent-attribution': ({ raw }) => {
          const found = (raw ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => AGENT_ATTRIBUTION.test(line));

          return [
            found.length === 0,
            `must not credit an agent - delete ${found.map((line) => `"${line}"`).join(', ')}. Commits here carry no trailers, no "Generated with" line and no session link, whichever agent wrote them.`,
          ];
        },
      },
    },
  ],
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
        'agent-rules',
        'components',
        'query',
        'query-devtools',
        'eslint-plugin',
        'types',
        'cli',
        'contentful',
        'eslint-plugin',
        'storybook',
        'docs',
        'deps',
        'ci',
        'release',
        'repo',
      ],
    ],
    'scope-empty': [2, 'never'], // Require scope
    'subject-case': [2, 'always', 'sentence-case'],
    'no-agent-attribution': [2, 'always'],
  },
};
