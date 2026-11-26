import { describe, expect, it } from 'vitest';
import { commitMessageVars } from './commitlint';

describe('commitMessageVars', () => {
  it('names the config that validates messages and offers the check', () => {
    expect(commitMessageVars('.commitlintrc.json')).toEqual({
      commitRuleSource: 'the **commitlint rules** in `.commitlintrc.json` - conventional commits with a required scope',
      commitValidation: 'When unsure a message passes, check it: `echo "<msg>" | npx commitlint`.',
    });
  });

  it('never mentions commitlint when the repo has none', () => {
    const vars = commitMessageVars(null);

    expect(Object.values(vars).join(' ')).not.toContain('commitlint');
    expect(vars['commitRuleSource']).toBe("this repo's **conventional-commit** convention");
  });
});
