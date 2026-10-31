import { definePart } from '@design-system';
import { inbox } from '@shared/inbox';

export default definePart({
  ...inbox(),
  note: 'Inbox, flat: every thread of the product, newest first, in two groups: the part on the canvas on top, all others below, showing its latest message: mostly the exchange between the user and their AI agent (Claude, Codex and Gemini in this sample), plus a teammate QC pass. Each row has the author, the part and state it sits on, and a reply count. The canvas shows the frame of the selected comment with its pin. States cover open comments only on the active part, an active part with no open comments, and no open comments at all. The comment editor is open only while focus is within it; moving focus between its controls keeps it open, and leaving the editor closes it.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6.1-terra', 'gpt-6'],
});
