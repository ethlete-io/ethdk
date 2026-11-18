import { definePart } from '@design-system';
import { inboxFor } from './shared/inbox';

const inbox = inboxFor('canvas');

export default definePart({
  ...inbox,
  note: "Inbox, flat: every thread of the product, newest first, in two groups: the part on the canvas on top, all others below, showing its latest message: mostly the exchange between the user and their AI agent (Claude, Codex and Gemini in this sample), plus a teammate QC pass. Each row has the author, the part and state it sits on, and a reply count. The canvas shows the frame of the selected comment with its pin. A click on a row, or Enter or Space on the focused row, selects its comment and opens its place on the canvas; for a comment on another part the canvas switches to that part first. States cover open comments only on the active part, an active part with no open comments, no open comments at all, the list while it loads, a load error with a retry, and a list longer than the panel, which scrolls. A click on a pin opens its thread as a card beside the pin on the canvas: the place, Erledigen and close in the head, every message with Zurückziehen under the user's own ones, and a focused reply field with Antworten; Esc or the close button shuts the card and keeps the pin selected. A failed send shows Kommentar nicht gesendet. Erneut versuchen. with Erneut senden; a 4xx shows the server's reason and no retry.",
  describe: {
    open: 'Open threads on the active part and on others; check the two groups, the selected row and its pin on the canvas frame.',
    'with-resolved':
      'The list with resolved threads shown; check Erledigte zeigen turned on and the resolved rows muted with their check mark.',
    'active-only':
      'Open threads only on the part on the canvas; check that the lower group is gone and the top group keeps its rows.',
    'active-clear':
      'No open thread on the active part but some on others; check the Keine offenen Kommentare line under the top group head, above the other threads.',
    'all-clear':
      'No open threads at all; check the centred check icon with the empty message in the panel and that the canvas shows no pins.',
    loading: 'The thread list while it loads; check the loading placeholder in the panel and that no stale rows show.',
    'load-error': 'A failed load; check the error line and Erneut laden in the panel, and that no rows show.',
    'long-list':
      'A list longer than the panel; check that the list scrolls inside the panel and the last row is not cut by the panel foot.',
    thread:
      'The selected pin opened as its thread card beside the pin on the canvas; check the four messages, Zurückziehen under each own message, Erledigen, the focused empty reply field and the disabled Antworten.',
    'thread-own':
      'The card of an own comment without replies; check the single message with Zurückziehen, Erledigen and the focused reply field.',
    'thread-busy':
      'A reply being sent; check that the field is disabled with the reply kept and Antworten shows its spinner.',
    'thread-error':
      'A reply that failed on the network or server; check Kommentar nicht gesendet. Erneut versuchen. under the field, the kept reply and Erneut senden.',
    'thread-rejected':
      'A reply the server refused with a 4xx; check its reason under the field and that Antworten offers no retry.',
  },
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6.1-terra', 'gpt-6', 'design check'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/inbox/inbox.component.ts' },
});
