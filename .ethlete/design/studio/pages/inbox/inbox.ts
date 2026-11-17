import { definePart } from '@design-system';
import { inbox } from './shared/inbox';

export default definePart({
  ...inbox,
  note: 'Inbox, flat: every thread of the product, newest first, in two groups: the part on the canvas on top, all others below, showing its latest message: mostly the exchange between the user and their AI agent (Claude, Codex and Gemini in this sample), plus a teammate QC pass. Each row has the author, the part and state it sits on, and a reply count. The canvas shows the frame of the selected comment with its pin. A click on a row, or Enter or Space on the focused row, selects its comment and opens its place on the canvas; for a comment on another part the canvas switches to that part first. States cover open comments only on the active part, an active part with no open comments, no open comments at all, the list while it loads, a load error with a retry, and a list longer than the panel, which scrolls.',
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
  },
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6.1-terra', 'gpt-6', 'design check'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/inbox/inbox.component.ts' },
});
