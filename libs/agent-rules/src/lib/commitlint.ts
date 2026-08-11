import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** The file that validates commit messages, as the skill should name it, or `null` when none does. */
export type CommitlintSource = string | null;

const COMMITLINT_CONFIG_FILES = [
  'commitlint.config.js',
  'commitlint.config.cjs',
  'commitlint.config.mjs',
  'commitlint.config.ts',
  'commitlint.config.mts',
  'commitlint.config.json',
  'commitlint.config.yaml',
  'commitlint.config.yml',
  '.commitlintrc',
  '.commitlintrc.js',
  '.commitlintrc.cjs',
  '.commitlintrc.mjs',
  '.commitlintrc.ts',
  '.commitlintrc.json',
  '.commitlintrc.yaml',
  '.commitlintrc.yml',
];

export const findCommitlintConfig = (root: string): CommitlintSource => {
  const configFile = COMMITLINT_CONFIG_FILES.find((name) => existsSync(join(root, name)));

  if (configFile) return configFile;

  const manifestPath = join(root, 'package.json');

  if (!existsSync(manifestPath)) return null;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { commitlint?: unknown };

  return manifest.commitlint ? 'package.json' : null;
};

/**
 * The git-commit skill states where its format comes from, and whether a message can be verified,
 * from what the repo actually has. Promising a `commitlint` run to a repo without one makes the
 * agent narrate the contradiction it finds instead of just writing the commit — so a repo with no
 * commitlint gets a guide that never mentions it.
 */
export const commitMessageVars = (source: CommitlintSource): Record<string, string> =>
  source
    ? {
        commitRuleSource: `the **commitlint rules** in \`${source}\` - conventional commits with a required scope`,
        commitValidation: 'When unsure a message passes, check it: `echo "<msg>" | npx commitlint`.',
      }
    : {
        commitRuleSource: "this repo's **conventional-commit** convention",
        commitValidation:
          'Nothing checks the message once it is written, so get the type, scope and subject case right the first time.',
      };
