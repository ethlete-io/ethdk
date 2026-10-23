# ethlete-studio

## 0.2.0-next.7

### Minor Changes

- Studio groups the open calls by their stage, in the design order, with loose calls last.
- Each call row shows the state the design tooling last recorded for it (scaffolded, drawing, checking, ready or failed) and updates when the state changes. A failed state shows its error on hover.
- A design call whose project names `themes` in its config shows a surface and a colour switch in its header. The pick draws every frame of the call and is remembered per project.
- The stage overview counts the calls without a stage and marks a stage as ahead when an earlier stage has no settled or ready call.
- Show a project's design system entries and a wireframe's inventory of component calls in the call list.

### Patch Changes

- A call now shows every round its variants name, also a round that has no entry in `rounds` yet. Before, a new round stayed hidden until somebody wrote its note.
- Hide the chat sidebar; Studio remembers the choice.
- Mark a call without a stage and without legacy as invalid in the overview, and list sketches and legacy calls apart from the stage counts.
- The design system section and the Restart button work in a release build.
- Studio now says when a design server was not started by it or runs an older cli, and offers Restart, which ends whatever listens on the port and starts its own server.
- Studio names design stages (Foundations, Wireframes, ...), shows a stage overview with open, ready and settled counts above the call list, and groups unknown stages under their id.
- Studio waits at most five seconds for the stamp of the installed cli, so an older cli without `design stamp` does not hold up the server state.
- Fix a type error in the call list: a failed status read now falls back to an empty, typed status map.
- Studio watches the whole design folder, so an edit to a design-system entry or to `config.json` refreshes the window.
- Update tokio to 1.54.1 to fix RUSTSEC-2026-0386.

## 0.2.0-next.6

### Patch Changes

- Update rustls-webpki and webpki-root-certs to fix RUSTSEC-2026-0382 and RUSTSEC-2026-0383.

## 0.2.0-next.5

### Patch Changes

- Update rustls to 0.23.46 and quinn-proto to 0.11.18 to fix the RUSTSEC-2026-0338 to 0349 advisories.

## 0.2.0-next.4

### Minor Changes

- Check for a newer release every 30 minutes while the app runs, not only at start, and add a "Check for updates" button under the project name.

## 0.2.0-next.3

### Patch Changes

- The checkout picker shows the checkout Studio actually opened, not the first kept one.
- Switching checkouts no longer leaves the calls of the checkout before on screen when the new one fails to read or a slower read lands late.
- A composed verb now hands the agent's tools the variant the compose card names, not whichever variant is on screen when Send is pressed.
- A draft composed while an agent run is going no longer disappears when the run ends.
- The top bar of a call no longer stays hidden because a variant with the same key was scrolled down in the call before.
- The call explorer no longer rounds a call's age up into the next unit, and stored conversations drop turns with missing text.
- The checkout picker names a Windows checkout by its folder instead of its whole path.
- Studio reads a call file as an object literal, so prose that holds `key:` no longer adds a phantom variant and a double-quoted claim reads whole.
- A call opens on the variant picked in it, else on its open or winning variant, and the sidebar count says how many variants are ruled.
- Fix the Rust host: added variant stubs are removed when the call cannot be written, a root folder can be named for a search, a failed re-watch stops the watch before, and PATH entries are split by platform.
- The call title bar no longer covers the top of a drawing: the drawing starts below it, and it fades out while the drawing scrolls down and back in on scroll up.

## 0.2.0-next.2

### Minor Changes

- Timetrack and Studio now update themselves. At startup, a release build downloads a newer release, and a "Restart to update" button installs it. AppImage, deb, macOS and Windows installs can update. A deb install asks for the administrator password.

### Patch Changes

- Timetrack and Studio now ship a Windows installer, and the Timetrack build includes transcription.

## 0.2.0-next.1

### Patch Changes

- A design call now lists its drawings as `variants` in `variant-<key>.ts` files, and `et design check` takes `--variant`; the old `options` key and `--option` flag are gone.

## 0.2.0-next.0

### Minor Changes

- The app version now advances through a changeset, like the Timetrack app, so each release names its version.

### Patch Changes

- A failed agent run now names its error even when the CLI prints that error after its output ends. The summary was sometimes empty.
