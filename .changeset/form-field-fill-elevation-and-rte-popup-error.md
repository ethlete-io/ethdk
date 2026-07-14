---
'@ethlete/components': patch
---

Form field: only a `filled` field raises the surface elevation for its contents — a `transparent` field now stays flush with its parent surface instead of bumping elevation without a painted background.

Rich text editor: the autocomplete popup no longer renders one elevation too high (it now matches menus), and its "source failed" error state is a centered icon-and-message panel instead of a stray line in an empty box.

Rich text editor: token chips (merge fields, mentions) now render as a tonal accent pill with a hairline ring — and keep their trigger char (`@`, `#`, …) visible as a de-emphasized prefix — so they read clearly as distinct entities in the prose, instead of a faint neutral highlight.

Rich text editor: the selection formatting toolbar now mounts through the overlay system (like the autocomplete popup) instead of a manually-positioned fixed element — so it shares the same anchoring, stacking, theming, and enter/leave animation.
