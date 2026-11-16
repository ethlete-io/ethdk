---
status: accepted
open: B539
decided: 2026-11-16
source: doc-agent session 2026-11-16, the human on the comment structure ("Irgendwie ist diese Struktur an sich komisch")
---

# One comment mode everywhere, and comments live where they belong

Studio had no way to comment in a sketch: the comment button and comment mode exist only in the system view of parts
and pages; a comment on a sketch variant came only from the CLI. All comments lived apart from the design, in the
Inbox section. The human named both as the problem and answered the recommendations with "Q2ok q3ok q4ok".

- One comment mode, the same everywhere a design is shown: parts, pages and every sketch variant, with the same
  button, pin and Esc behaviour (ADR 0321). A comment in a sketch belongs to the variant it was placed on.
- Each view shows its own open comments next to its canvas, for example a sketch the comments on its variants. The
  Inbox stays only as the overview of everything open.
- Where the list, the button and the pins sit is a look question: the builder draws a sketch of the whole comment flow
  in Studio, with variants, and the human picks.
