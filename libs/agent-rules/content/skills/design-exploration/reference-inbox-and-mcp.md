# Design exploration: the inbox and the MCP server

### Read the inbox

The user comments on a state of a part in Studio, at a point, or on a sketch variant. The sketch of
an element also shows each page that uses it, with each variant swapped in: a comment there names
the page as its part and the element's sketch variant, so change the variant, not the page.

```bash
et design inbox [--json] [--product <p>]   # open comments and rebases, then what waits for the user
et design inbox done <id> --note <text> --by <model id>   # set the part note, mark the thread addressed
et design comment reply <id> --by <model id> <text> [--question]   # answer a comment thread (takes --product)
```

Read the inbox at the start of a session and after each sketch you mark `ready`. Answer a comment
by changing the sketch or the part, then `inbox done <id> --note "…"`. The note replaces the `note` of the part the comment was made on (for a sketch variant, the product's part), so write it to explain the whole shape of the part, and pass the old note unchanged when it still holds. `done` fails without `--note`; only the user withdraws a comment without one, in Studio. `done` also stores your `--by` where the comment sat: in the authors of the sketch variant, or in the `madeBy` of the part. A pick or discard decision is listed as waiting
for the user: Studio merges or discards on the user's click, so never run `sketch merge` after a pick.

A comment is a thread: the user and you both reply. When a comment is unclear, ask with
`comment reply --question` instead of guessing. The thread then moves to the "waiting for the user" group
(`waitingForUser` in `--json`) and returns to the inbox when the user answers. A thread there is
not work for you.

A thread has three states. **Open** waits for an answer. **Addressed** (`addressed`: who, when, why,
the round) means `inbox done`, a new round, a merge or a discard answered it: it leaves the inbox and
the check, Studio shows it with an "addressed" badge, and you may still `comment reply` on it to say
what you changed. A reply by the user opens it again. **Resolved** means the user closed it in Studio -
only the user resolves. The file stays so the user can look back at it; a reply or `done` on it fails.

Pass `--question` only when you cannot go on without the user's answer. Studio lists only those
threads under "Questions for you". A report of what you did is no question: reply without the
flag, and the thread shows as "answered" until the user withdraws it or replies.

### The `ethlete-design` MCP server

`ethlete-agents sync` registers `et design mcp` as `ethlete-design` in `.mcp.json` and
`.codex/config.toml` when `@ethlete/cli` is installed. When the tools are in your tool list, use them
instead of the CLI: each runs the `et design` command of the same name in the session's working
directory, takes its flags as arguments, and every write takes `by` (your model id). `product` may be
left out when the workspace has one. `shot` and `motion_shots` return the sheet image itself, so you
look at it without opening a PNG path.

- **Read:** `parts` (every part, as JSON), `call` (a call's `call.ts`, `fixture.ts`, the variant file to draw into and the frame URL; never change the fixture).
- **Check:** `check` (a product; with `call` and `variant` it lints, type-checks and renders that variant - run it after every edit of a variant), `sketch_check` (each variant laid over the product), `sketch_preview` (what a merge of a variant changes).
- **Shots:** `shot` (a part's states, `variants` for the open sketch), `motion_shots` (a motion at its keyframes, full and reduced, plus its tracks as JSON).
- **Sketch lifecycle:** `sketch_new`, `sketch_variant`, `sketch_round`, `sketch_report`, `sketch_ready`, `sketch_rebase`, `sketch_list`. `sketch_merge` and `sketch_discard` exist, but Studio runs them on the user's click; do not call them.
- **Comments:** `inbox` (what waits for you, then for the user), `comment_reply` (`question` waits for the user's answer), `inbox_done` (needs the new part `note`).

Part files are written with your own file tools; the server has no write tool for them. Call
`sketch_report` before every variant edit: it tells Studio what you build. It refuses a `ready` sketch: only when the
user asks for a change, run `et design sketch report … --reopen`, which moves the sketch back to in progress, and call
`sketch_ready` again when you are done. `sketch_ready` runs the
render check and refuses on any render issue; mark an element that renders wrong on purpose with
`data-et-skip="<rule>"`. A tool that fails returns the CLI's output; fix it and call again.
