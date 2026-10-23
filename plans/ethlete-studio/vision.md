# Ethlete Studio - open work

Studio lives in `apps/ethlete-studio`, the design server in `libs/cli/src/lib/design`. The
names are **project → feature → call → variant**.

## Live work

1. **Create the work from inside Studio.** Studio creates a project, a feature and a call,
   and writes the config and the files each one needs. Today all three are written by hand.
   `apps/ethlete-studio/src-tauri/src/design.rs` has no command for it yet. A new command
   must be listed in `build.rs` **and** in `src-tauri/capabilities/default.json`; two tests
   in `lib.rs` check both.
2. **A frame that renders a real component from another checkout.** A frame cannot import
   an `@ethlete` barrel: libs resolve to source, and the import dies with
   `ERR_INSUFFICIENT_RESOURCES`. Pre-bundle the library instead. Drawings are not affected,
   because they import nothing from the libraries.
3. **One round, several agents.** A round can run more than one agent CLI or model on the
   same question, for example Claude and Codex, or two models under one CLI. Each variant
   records which CLI drew it and on which model. Studio asks the CLI which models it
   offers, or stores the name as written.
4. **Move the chat fully into Studio.** Planning a whole call and debugging a broken frame
   still happen in a CLI session outside Studio. The agent bridge already streams turns,
   and the right rail already keeps them per call and CLI.
5. **Captured thumbnails, if a large call needs them.** A tile is the variant's own frame,
   scaled down with a CSS transform, so a live tile costs one running copy of the drawing
   per variant. A captured picture would replace it. The pieces exist:
   `libs/cli/src/lib/design/check.ts` launches a headless Chromium, and
   `libs/cli/src/lib/design/serve.ts` watches the calls folder. A tile also assumes a 16:9
   window, because the design server reports no frame height.
   - Open, and Tom decides: does a live tile hold up for about two dozen variants?
     `timetrack/kerbe/06-break-label` (24 variants) is the test case.

6. **Consistent calls: components, prototype, project design system.** Tom, 2026-10-23: "Each
   design call just totally invents new components and looks that do not match the sdks vision
   at all. It's also pretty hard to keep consistency between calls." The goal is a full
   interactive prototype with motion and theme (dark, light, custom). Accepted component calls
   move into a design system for the project, which the agent knows and reuses.
   - Components: no more hand-written mocks. A compiler makes the HTML mock of a component, with
     its options, from the real component. The three hand-written mocks
     (`libs/components/design/`, see `component-design-mocks.md`) stay until it exists.
   - Open, compiler: Angular's template alone can not give the DOM, because host bindings come
     from directive state (`formFieldDir.usesTextFieldShell()`). Candidates: (a) render the real
     component server-side (Angular SSR in the design server) for the options a drawing asks for;
     (b) render a fixed state matrix at build time into static snapshots. (a) keeps free options.
   - Open, interaction: a snapshot has CSS states (hover, focus, CSS motion) but no behavior. A
     prototype needs a small runtime in the frame that swaps a component to another state on an
     event (click → `open: true`). The frame now drops `<script>` (`libs/cli/design/web/frame.ts`
     sets `innerHTML`); tomflix asked for a `setup(root)` hook or host controls for replay,
     speed and reduced motion.
   - Open, theme: a frame control that switches the fixture's surface and color themes.
   - Order (Tom agreed, 2026-10-23): first the project design system and the skill rule to
     reuse it, then the SSR compiler, then the interaction runtime and the theme switch.
   - Open, design system: where accepted calls land (for example `.ethlete/design/system/`), and
     how the `ethlete-design-exploration` skill makes the agent reuse it before it draws new.

## Settled - do not re-open

- Calls stay HTML, also for real components (Tom, 2026-10-23). Angular frames were rejected:
  the design server would need the Angular compiler for every repo's Angular version.

- Studio stays an Angular app.
- A drawing is a value (`html`, `css`, `drawing()`), not an Angular component. htmx, Vue,
  Lit and plain HTML files were rejected.
- A model name is never a fixed union in the code. The agent bridge is one interface with
  one implementation per CLI.
- `check_call` reports and never blocks Accept.
- A project's design files live in that project's own repo.
