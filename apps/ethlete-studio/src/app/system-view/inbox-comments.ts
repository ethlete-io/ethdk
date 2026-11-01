import { ListedComment } from '../../host/design';
import { InboxAgent, InboxComment } from '../design-parts/inbox/inbox-sample';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const AGENTS: { agent: InboxAgent; author: string; match: RegExp }[] = [
  { agent: 'claude', author: 'Claude', match: /claude|opus|sonnet|haiku|fable/i },
  { agent: 'codex', author: 'Codex', match: /codex|gpt|\bo\d/i },
  { agent: 'gemini', author: 'Gemini', match: /gemini/i },
];

const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0);

export const inboxAgeOf = (iso: string, now: number) => {
  const time = Date.parse(iso);
  const age = Math.max(0, now - time);

  if (age < MINUTE) return 'gerade eben';
  if (age < HOUR) return `vor ${Math.floor(age / MINUTE)} Min`;
  if (age < DAY && startOfDay(time) === startOfDay(now)) return `vor ${Math.floor(age / HOUR)} Std`;

  const days = Math.round((startOfDay(now) - startOfDay(time)) / DAY);
  const date = new Date(time);

  if (days <= 1) return 'gestern';
  if (days < 7) return WEEKDAYS[date.getDay()] ?? '';

  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
};

export const inboxPartOf = (part: string) => part.slice(part.indexOf('/') + 1);

const senderOf = (by: 'user' | 'agent', author: string | undefined) => {
  if (by === 'user') return { author: 'Du', initials: 'Du' };

  const known = AGENTS.find(({ match }) => author && match.test(author));

  return known
    ? { author: known.author, initials: known.author.charAt(0), agent: known.agent }
    : { author: author ?? 'Agent', initials: 'A' };
};

export const inboxCommentOf = (comment: ListedComment, now: number): InboxComment => {
  const last = comment.replies.at(-1) ?? {
    by: 'user' as const,
    author: undefined,
    text: comment.text,
    createdAt: comment.createdAt,
  };
  const interaction = comment.interaction && comment.interaction !== 'rest' ? ` · ${comment.interaction}` : '';

  return {
    id: comment.id,
    ...senderOf(last.by, last.author),
    when: inboxAgeOf(last.createdAt, now),
    part: inboxPartOf(comment.part),
    state: `${comment.state}${interaction}`,
    text: last.text,
    replies: comment.replies.length,
    unread: !comment.resolved && comment.threadState !== 'agent',
    resolved: !!comment.resolved,
  };
};
