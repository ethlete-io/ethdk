import { describe, expect, it } from 'vitest';
import { RenderIssue } from './render-check';
import { sameRenderIssueKeyOf } from './render-issue-key';

const issueOf = (overrides: Partial<RenderIssue>): RenderIssue => ({
  rule: 'OVERFLOW',
  product: 'acme',
  part: 'pages/users',
  state: 'menu-open',
  size: 'phone',
  path: 'os-root.block',
  detail: 'content 390x953 in 390x844 frame',
  sketch: null,
  ...overrides,
});

describe('sameRenderIssueKeyOf', () => {
  it('matches an overflow of the same element whose content height changed', () => {
    const before = issueOf({});
    const after = issueOf({ detail: 'content 390x983 in 390x844 frame' });

    expect(sameRenderIssueKeyOf(after, null)).toBe(sameRenderIssueKeyOf(before, null));
  });

  it('keeps an overflow of another element or part apart', () => {
    const key = sameRenderIssueKeyOf(issueOf({}), null);

    expect(sameRenderIssueKeyOf(issueOf({ path: 'os-root.flex' }), null)).not.toBe(key);
    expect(sameRenderIssueKeyOf(issueOf({ part: 'pages/other' }), null)).not.toBe(key);
  });

  it('still tells two details of another rule apart', () => {
    const one = issueOf({ rule: 'SCROLLS', detail: 'a' });

    expect(sameRenderIssueKeyOf(issueOf({ rule: 'SCROLLS', detail: 'b' }), null)).not.toBe(
      sameRenderIssueKeyOf(one, null),
    );
  });
});
