# The settled rulings of the roadmap

This ADR records decisions the human made earlier, on dates that predate it. They stood in the roadmap's "Settled - do
not re-open" list. Plan files hold only open things (ADR 0352), so the list moved here. Nothing in it is new. Where an
earlier ADR already holds a ruling, the ruling is cited and not restated here.

Already recorded: no hosted backend and only one person's own paired machines (ADR 0013); the model runs on a press,
with the prompt shown first, and in auto mode (ADR 0013, 0023, 0035); concurrent checkouts book once (ADR 0034); no
git flow, no subtasks or branch per issue (ADR 0001, 0009); one app, one store, one day screen (ADR 0004, 0011, 0014);
the epic and its parent (ADR 0022); a band that is not work takes nothing from a background band (ADR 0024); no
retention pass without compaction (ADR 0002).

## Scope

- No view over other people's time. No Jira Data Center. No worklog target but Tempo.
- No vendor call APIs (Slack huddle state, a Discord bot). The microphone holder is the signal.
- No Gmail source. The forge sources shell out to `glab` and `gh` and hold no token. A forge event is evidence, never
  time. Commit subjects never carry the issue key.
- Other agent CLIs (Cursor, Copilot, Gemini) are out of scope.
- The Tempo sync is always a human press. Every agent endpoint write waits in the approval queue. A model's answer
  never becomes a rule without a click and never writes the naming store.

## Time and cost

- Concurrent streams each book their full time, and a day may exceed its wall clock. No gate, no scaling.
  `scaleToPresence` only if an invoice needs it.
- The price table ships empty. No price is hardcoded.
- A break is corrected by `present`/`away` statements over a stretch, never by break id. A statement outranks every
  derived rule.
- Auto-pause and auto-resume on standby stay deferred and never share a control with the hard pause.

## Naming

- A parent issue is pre-selected only when the ranking clearly leads. No invitation attendees for naming.
- Only evidence names a checkout: no guessed session sticky, no `app_id`-to-process match, no `path-prefix` exclusion,
  no widened `title-pattern`. The private project link is the privacy control. `repoStickinessMs` is never changed in
  the same change as a mechanism.
- Heartbeats are reported per reporter, not per editor.

## Screen and design

- The timeline axis is a fixed 24 hours and is never cropped or rescaled.
- The metal of a band says what the band asks of the reader, not how sure the matcher was. No ornament on anything
  that repeats about 20 times on a screen. Ornament marks a threshold, never a workspace.

## Security and tooling

- No global hotkey on Wayland: `timetrack open` plus a compositor binding. The window lock uses the OS account
  credential, not TOTP, a passkey or a passphrase.
- A rejected Google refresh token is not deleted automatically, and a refused revocation keeps it. "Remove on this
  machine only" is a separate action.
- The agent proof is answered before the token and lock checks. An unlinked checkout's cursor keeps its `cwd`; a
  private one loses it.
- `cargo-audit` is pinned from crates.io, its CI target is not cached, `unmaintained` is not denied, and glib
  RUSTSEC-2024-0429 is accepted.
- No `tauri-driver` run for now. No client titles or keys in `libs/timetrack` fixtures.
