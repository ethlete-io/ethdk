import { definePart } from '@design-system';
import { commentDraft } from '@system/components/comment-draft';
import { inbox } from './shared/inbox';

const placedDraft = async (text: string) => {
  const draft = await commentDraft({ text });
  return {
    body: `<div role="dialog" aria-label="Kommentar" data-et-auto-surface>${draft.body}</div>`,
    styles: draft.styles,
  };
};

export default definePart({
  ...inbox(placedDraft),
  note: 'Inbox, flat: every thread of the product, newest first, in two groups: the part on the canvas on top, all others below, showing its latest message: mostly the exchange between the user and their AI agent (Claude, Codex and Gemini in this sample), plus a teammate QC pass. Each row has the author, the part and state it sits on, and a reply count. The canvas shows the frame of the selected comment with its pin. A click on a row, or Enter or Space on the focused row, selects its comment and opens its place on the canvas; for a comment on another part the canvas switches to that part first. States cover open comments only on the active part, an active part with no open comments, no open comments at all, the list while it loads, a load error with a retry, and a list longer than the panel, which scrolls. The comment editor is open only while focus is within it; moving focus between its controls keeps it open, and leaving the editor closes it.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6.1-terra', 'gpt-6'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/inbox/inbox.component.ts' },
});
