import { AgentLogoName } from '../../icons/agent-logos';
import { CommentSendPhase } from '../system-page/comment-draft.component';

export type InboxAgent = AgentLogoName;

export type InboxComment = {
  id: string;
  author: string;
  initials: string;
  agent?: InboxAgent;
  when: string;
  part: string;
  state: string;
  text: string;
  replies: number;
  unread?: boolean;
  resolved?: boolean;
};

export type InboxMessage = {
  author: string;
  initials: string;
  agent?: InboxAgent;
  when: string;
  text: string;
  own?: boolean;
};

/** The opened thread of the selected comment, with the send phase of the reply being written. */
export type InboxThread = {
  id: string;
  place: string;
  messages: InboxMessage[];
  phase?: CommentSendPhase | null;
  reason?: string;
};

export const INBOX_SAMPLE: InboxComment[] = [
  {
    id: 'c1',
    author: 'Claude',
    initials: 'C',
    agent: 'claude',
    when: 'vor 3 Min',
    part: 'button',
    state: 'filled · hover',
    text: 'Hover ist jetzt eine Stufe heller, ich nehme accent-hover statt der Mischung. Reicht dir der Abstand zu active noch?',
    replies: 3,
    unread: true,
  },
  {
    id: 'c2',
    author: 'Codex',
    initials: 'CX',
    agent: 'codex',
    when: 'vor 20 Min',
    part: 'button',
    state: 'outline · disabled',
    text: 'Ich habe zwei Wege skizziert: den Rand auf 3:1 heben oder eine leise Fläche statt Rand. Beide liegen als Runde 2 unter Sketches.',
    replies: 1,
    unread: true,
  },
  {
    id: 'c3',
    author: 'human',
    initials: 'H',
    when: 'vor 1 Std',
    part: 'button',
    state: 'tonal · rest',
    text: 'Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist.',
    replies: 0,
  },
  {
    id: 'c4',
    author: 'Lena Krüger',
    initials: 'LK',
    when: 'gestern',
    part: 'form-field',
    state: 'default',
    text: 'QC: Label und Feld sitzen hier enger als bei select. Gewollt oder Drift?',
    replies: 0,
  },
  {
    id: 'c5',
    author: 'Lena Krüger',
    initials: 'LK',
    when: 'gestern',
    part: 'select',
    state: 'open',
    text: 'QC: Die offene Liste deckt den Hilfetext ab. Bitte nachziehen, bevor wir das Formular bauen.',
    replies: 0,
  },
  {
    id: 'c6',
    author: 'Gemini',
    initials: 'G',
    agent: 'gemini',
    when: 'Mo',
    part: 'system',
    state: 'part',
    text: 'Die Baumzeilen sind jetzt 24 px hoch. Die Schrift bleibt dicht, nur die Trefferfläche wächst. Runde 3 zeigt beide Höhen nebeneinander.',
    replies: 4,
  },
  {
    id: 'c7',
    author: 'human',
    initials: 'H',
    when: 'Fr',
    part: 'button',
    state: 'filled · focus-visible',
    text: 'Der Fokusring verschwindet auf der dunklen Fläche. Mach ihn sichtbar.',
    replies: 2,
    resolved: true,
  },
  {
    id: 'c8',
    author: 'Codex',
    initials: 'CX',
    agent: 'codex',
    when: 'Do',
    part: 'button',
    state: 'filled',
    text: 'Alle Labels lesen jetzt „Save“. Ich habe auch die Shots der Varianten neu erzeugt.',
    replies: 1,
    resolved: true,
  },
];

const HUMAN = { author: 'human', initials: 'H', own: true };
const CLAUDE = { author: 'Claude', initials: 'C', agent: 'claude' as const };

export const INBOX_THREAD_SAMPLE: Record<string, InboxMessage[]> = {
  c1: [
    { ...HUMAN, when: 'vor 2 Std', text: 'Hover und active liegen zu nah beieinander. Mach hover heller.' },
    { ...CLAUDE, when: 'vor 1 Std', text: 'Ich mische accent mit 12 % Weiß. Passt das so?' },
    { ...HUMAN, when: 'vor 40 Min', text: 'Noch zu dunkel. Nimm lieber den Token statt der Mischung.' },
    {
      ...CLAUDE,
      when: 'vor 3 Min',
      text: 'Hover ist jetzt eine Stufe heller, ich nehme accent-hover statt der Mischung. Reicht dir der Abstand zu active noch?',
    },
  ],
  c3: [
    {
      ...HUMAN,
      when: 'vor 1 Std',
      text: 'Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist.',
    },
  ],
};

/** The app thread of the design's `thread` prop: the sample messages of `id` at the place of its sample comment. */
export const inboxThreadSampleOf = ({
  id,
  phase,
  reason,
}: {
  id: string;
  phase?: CommentSendPhase;
  reason?: string;
}): InboxThread | null => {
  const comment = INBOX_SAMPLE.find((candidate) => candidate.id === id);

  if (!comment) return null;

  return {
    id,
    place: `${comment.part} › ${comment.state}`,
    messages: INBOX_THREAD_SAMPLE[id] ?? [],
    ...(phase ? { phase } : {}),
    ...(reason ? { reason } : {}),
  };
};
