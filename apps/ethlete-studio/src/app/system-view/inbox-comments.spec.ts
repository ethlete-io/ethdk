import { ListedComment } from '../../host/design';
import { inboxAgeOf, inboxCommentOf } from './inbox-comments';

const NOW = Date.parse('2026-11-04T15:00:00');

const comment = (rest: Partial<ListedComment>): ListedComment => ({
  id: 'a',
  part: 'components/button',
  state: 'filled',
  size: 'fitted',
  text: 'Too pale',
  createdAt: '2026-11-04T14:00:00',
  replies: [],
  threadState: 'agent',
  stale: null,
  ...rest,
});

describe('inboxAgeOf', () => {
  it('tells minutes and hours today, then yesterday, a weekday, and a date', () => {
    expect(inboxAgeOf('2026-11-04T14:59:30', NOW)).toBe('gerade eben');
    expect(inboxAgeOf('2026-11-04T14:57:00', NOW)).toBe('vor 3 Min');
    expect(inboxAgeOf('2026-11-04T13:00:00', NOW)).toBe('vor 2 Std');
    expect(inboxAgeOf('2026-11-03T23:00:00', NOW)).toBe('gestern');
    expect(inboxAgeOf('2026-11-02T10:00:00', NOW)).toBe('Mo');
    expect(inboxAgeOf('2026-10-14T10:00:00', NOW)).toBe('14.10.');
  });
});

describe('inboxCommentOf', () => {
  it('shows the first text by the user while nobody answered, and waits on the agent unmarked', () => {
    expect(inboxCommentOf(comment({ interaction: 'hover' }), NOW)).toEqual({
      id: 'a',
      author: 'Du',
      initials: 'Du',
      when: 'vor 1 Std',
      part: 'button',
      state: 'filled · hover',
      text: 'Too pale',
      replies: 0,
      unread: false,
      resolved: false,
    });
  });

  it('shows the last reply by its agent, and marks a thread that waits for the user', () => {
    const row = inboxCommentOf(
      comment({
        threadState: 'question',
        replies: [{ by: 'agent', author: 'claude-opus-5-5', text: 'Darker?', createdAt: '2026-11-04T14:57:00' }],
      }),
      NOW,
    );

    expect(row).toMatchObject({ author: 'Claude', agent: 'claude', text: 'Darker?', when: 'vor 3 Min', replies: 1 });
    expect(row.unread).toBe(true);
  });

  it('names an unknown agent by its model id and never marks a resolved thread', () => {
    const row = inboxCommentOf(
      comment({
        threadState: 'answered',
        resolved: { by: 'user', resolvedAt: '2026-11-04T14:58:00' },
        replies: [{ by: 'agent', author: 'mistral-large', text: 'Done', createdAt: '2026-11-04T14:00:00' }],
      }),
      NOW,
    );

    expect(row).toMatchObject({ author: 'mistral-large', initials: 'A', resolved: true, unread: false });
    expect(row.agent).toBeUndefined();
  });
});
