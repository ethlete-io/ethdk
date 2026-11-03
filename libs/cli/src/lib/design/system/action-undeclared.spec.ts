import { describe, expect, it } from 'vitest';
import { actionUndeclaredUnderGoOf } from './action-undeclared';
import { RenderIssue } from './render-check';

const issue = (part: string, path: string, state = 'default', rule = 'ACTION-UNDECLARED'): RenderIssue => ({
  rule,
  product: 'studio',
  part,
  state,
  size: 'desktop',
  path,
  detail: `button "Go" is interactive but declares no action - add data-et-action="<state>" or "emit:<output>"`,
  sketch: null,
});

describe('actionUndeclaredUnderGoOf', () => {
  const issues = [
    issue('components/tree-row', 'div.row > button'),
    issue('components/tree-row', 'div.row > button', 'open'),
    issue('components/tree-row', 'div.row > span'),
    issue('components/title-bar', 'header > button'),
    issue('components/tree-row', 'div.row', 'default', 'CONTRAST'),
  ];

  it('keeps the action issues of a part without a current go as errors', () => {
    const split = actionUndeclaredUnderGoOf({ issues, isGo: () => false });

    expect(split.issues).toEqual(issues);
    expect(split.warnings).toEqual([]);
  });

  it('turns the action issues of a part with a current go into one warning line per part', () => {
    const split = actionUndeclaredUnderGoOf({ issues, isGo: ({ part }) => part === 'components/tree-row' });

    expect(split.issues).toEqual([issues[3], issues[4]]);
    expect(split.warnings).toEqual([
      {
        product: 'studio',
        part: 'components/tree-row',
        line: 'WARNING ACTION-UNDECLARED studio components/tree-row: 3 hits on 2 elements, unchanged since its go - first div.row > button: button "Go" is interactive but declares no action',
      },
    ]);
  });

  it('asks about the part that owns the element', () => {
    const embedded = issue('pages/inbox', 'main > [data-et-part=components/tree-row] > button');
    const asked: string[] = [];

    actionUndeclaredUnderGoOf({
      issues: [embedded],
      isGo: ({ product, part }) => asked.push(`${product} ${part}`) > 0,
    });

    expect(asked).toEqual(['studio components/tree-row']);
  });
});
