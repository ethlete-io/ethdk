# Archive, done: 6. Agent process

### 6.6 Literal attachment variants passed checks but failed visual judgment - built (c94f3e095)

- **Pain (Tom, 2026-10-30):** "das schaut alles nicht wirklich gut aus" after reviewing the
  Avatar attachment round D/E/F. All 36 state renders passed; none of these alternatives
  received design approval. The initial recommendation of D was not supported by Tom's
  assessment of the overall appearance.
- **What was drawn:** the same existing composer with a pointer, an overlapping avatar or a
  narrow bridge. Parent review corrected disconnected geometry but still focused too much
  on whether endpoints touched. That did not establish a good comment composition.
- **Interpretation, not a quoted requirement:** the agent treated "more attached to an avatar"
  too mechanically and retained the cluttered composer structure. The next round should
  compare coherent avatar/editor compositions rather than more connector decorations.
- **Now:** round 3 G/H rebuilds the composer composition from the directionally useful A;
  D/E/F remain visible as rejected history. Scope stays the same point-comment task.
- **Fix options:** 1. before presenting, critique hierarchy, avatar relationship, spacing,
  form nesting and host context together, at a readable detail scale and in the whole page
  (recommended). Reject technically valid but visually weak alternatives before `ready`. 2. add a declared visual review rubric to the exploration brief; it must support human
  judgment rather than turn subjective design quality into a render-pass boolean.
- **Acceptance:** future summaries distinguish "renders correctly" from "designer approved";
  a successful attachment check or a preferred agent variant does not establish either
  design quality or implementation completeness. Tom still chooses the composition.
- **Reference review requested by Tom:** before continuing G/H, compare his Figma screenshot
  (`/tmp/codex-clipboard-ZMjDSV.png`) and other tools. The screenshot shows an empty compact
  input alongside a pin, with an integrated arrow action and no heading, target breadcrumb
  or separate footer. This is a different state from our filled multiline editor; it must
  not be treated as an alternative to that state.
- **References checked (2026-10-30):**
  - [Figma's current add-comment guide](https://help.figma.com/hc/en-us/articles/360041068574-Add-comments-to-files):
    the official animation also shows a filled composer adjacent to its pin, with the send
    arrow in its own lower action region. It supports distinguishing initial entry from
    filled composition; it does not justify copying a whole feature set. The
    [2021 design rationale](https://www.figma.com/blog/stay-in-the-flow-with-redesigned-comments/)
    explicitly describes reducing composer size to encourage focused feedback; treat this
    as historical rationale, not proof of today's exact appearance.
  - [Miro comments](https://help.miro.com/hc/en-us/articles/360017730873-Comments):
    documents saved drafts when navigating away, Enter to publish and Shift+Enter for a
    newline. Its official edit screenshot shows a thread with author, editing controls and
    a separate reply field. That screenshot is an existing-thread edit, not a new comment.
  - [Penpot workspace comments](https://help.penpot.app/user-guide/designing/workspace-basics/#comments):
    the official screenshot shows an anchored thread with messages, authors and a reply
    field. The guide distinguishes adding a point-comment from replying to a thread.
- **Implication to explore, not an approved design:** compare compact entry compositions
  first, and show empty, filled/multiline and existing-thread states as separate states of
  each candidate. Start with pin plus input and integrated send; add chrome only when the
  task needs it. Cover draft preservation/cancel semantics separately so visual reduction
  does not introduce text loss. G/H were interrupted before visual review or a passed check;
  they are unfinished drafts, not reference-backed proposals ready for Tom.
- **Round 4 review finding:** the first compact I/J drawings recreated the marker at
  x=610, y=244 while A's actual marker was x=609, y=187. They looked locally aligned with
  their input but moved the feedback point by 57 px. Parent review requested browser
  measurement; the author confirmed and corrected both to x=609, y=187. Compare the pin
  against the original target, not just against its editor. A reusable anchored-composer
  helper or target-identity/geometry check is a potential tooling improvement; fixed page
  coordinates currently allow this semantic drift without a render/type error.

### 6.8 The agent invented focus variants without establishing the editor lifecycle - done (`7c09b38b4`)

- **Correction (Tom, 2026-10-30):** "ich denke nicht dass wir das comment fenster ohne
  focus offen lassen. der bereits gestaltete stand ist der focus stand. kein focus ->
  comment schließt". The merged L appearance is already the open/focused editor.
- **Failure:** the agent treated focus as a missing visual decoration and opened a new
  A/B ring comparison. It assumed an open/unfocused base state instead of deriving valid
  states from the task. Render checks passed this invented matrix. The bare textarea's
  suppressed outline did not establish a requirement to redraw the accepted editor.
- **Agreed behavior:** opening the comment editor means it has focus; leaving its focus
  scope closes it. Focus moving between controls inside the editor, such as textarea to
  Send, keeps it open. There is no persistent open-but-unfocused editor state. Losing
  focus does not submit the comment. Draft retention/discard after closing is a separate
  policy, not silently decided by this correction.
- **Current action:** a corrective single-variant round restores L's accepted appearance,
  removes the speculative extra focus state in that candidate and documents the lifecycle.
  Existing no-editor drawings cover the closed presentation. No actual focus/blur runtime
  behavior is implemented by these static drawings, and no formal rejection state for
  the old A/B candidates is implied (3.45).
- **System improvement:** extend the proposed completeness model (4.47) with valid
  lifecycle states, transitions and focus scope. Require reachable states and meaningful
  transitions before expanding interaction coverage; do not demand every mechanical
  focus/hover combination for a control that would already be closed. Drawn focus evidence
  and real behavior verification remain distinct.
- **Acceptance:** the accepted L appearance is used for the focused editor; focus can move
  to Send without hiding it prematurely; moving outside closes it without sending. Future
  implementation must verify those transitions and the separately chosen draft policy.
- **Draft policy (Tom, 2026-10-30):** a closed editor keeps its draft. The pin shows a draft
  mark, and the editor shows the text again when it opens. Only Send or an explicit discard
  drops the draft.
- **Stopped at Tom's request:** "no more new sketches for you" / "wrap it up". Corrective C
  exists with an author check but remains unmerged and not ready. No further sketch work,
  publication or automatic continuation is authorized. The committed L design stays as is.
  Lifted (Tom, 2026-10-30): the stop held only for that evening.
