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
   - Compiler (Tom decided, 2026-10-23; step 2 done, demo call `components/ssr/00-button-and-field`): (a), server-side render. A test
     proved it: `@angular/compiler` (JIT) plus `renderApplication` from
     `@angular/platform-server` render `dist/libs/components` in Node in about 25 ms, with host
     bindings from directive state (`data-text-shell="true"`) and the component `<style>` tags.
     - API: a variant calls `await ng(template, { imports: ['FORM_FIELD_IMPORTS', …] })` and
       puts the HTML in its `html` body. The template is a real Angular template.
     - Source: the built package. Consumers: `node_modules/@ethlete/*`. SDK: `dist/libs/*`,
       because `node_modules/@ethlete/*` links to `libs/*/src`; a resolve hook maps it.
     - Providers: `config.json` names a `providers.ts` per project (colour and surface themes).
       The form field throws without colour themes.
     - The server render carries the input `placeholder` and the active hint (`data-active`),
       checked on 2026-10-23. A render error goes to a collecting `ErrorHandler`, so `ng()`
       rejects with it.
   - Open, interaction: a snapshot has CSS states (hover, focus, CSS motion) but no behavior. A
     prototype needs a small runtime in the frame that swaps a component to another state on an
     event (click → `open: true`). The frame now drops `<script>` (`libs/cli/design/web/frame.ts`
     sets `innerHTML`); tomflix asked for a `setup(root)` hook or host controls for replay,
     speed and reduced motion.
     - Tom decided, 2026-10-23: first a `setup(root)` hook on the drawing (done, 84ee476e9),
       then a state-snapshot helper on top: named `ng()` states, swapped by rules such as
       `click .trigger → open`, with a View Transition. Host controls are still open.
   - Theme (Tom decided, 2026-10-23): one switch per call, applied to every frame. The frame side is
     done (3890782af): `frame.html?…&surface=<name>&color=<name>` puts the classes on `#root`;
     a project names `themes` in `config.json`. The control belongs in Studio, not in a web page.
   - Old web call page removed (00dd153e1). Studio is the only call UI; `frame.html` stays.
   - `setup` will accept a function or an array (tomflix feedback), so `flow.on` combines with own code.
   - Call creation (Tom decided, 2026-10-23): `et design` subcommands are the core (boilerplate,
     status, screenshot). They write status files that Studio shows; Studio's MCP tools
     (`apps/ethlete-studio/src-tauri/src/tools.rs`) wrap them. Discovery is part of it: the skill
     lists every command, and `et design --help` works. Today no doc names the Studio MCP tools,
     and terminal sessions do not get them. Tom decided the details, 2026-10-23:
     `et design new <slug> [--variants a,b]` scaffolds call.ts, fixture.ts and one file per
     variant, so the call renders at once. `et design status <slug> <state>` sets the state.
     `et design check --call <slug> --shot` also writes a PNG next to the receipt. States:
     scaffolded (new), drawing (agent), checking, then ready or failed (check). The status file
     lives next to the receipts in the temp dir `ethlete-studio-checks/`, one per checkout and call.
   - Design workflow (Tom decided, 2026-10-23): colours, colour and surface themes → logo and CI
     (if needed) → wireframes (early concepts, to see which components are needed) → components
     from the SDK ones → larger elements (shell, nav) → pages → working prototype. An agent
     that skips the component library is a sign the tool and skill are not clear enough. The
     skill states the order in "The order of a design". Tom accepted four additions, 2026-10-23:
     (1) `defineCall` gets a `stage` (themes, ci, wireframe, component, element, page,
     prototype); Studio groups calls by stage; `check` warns when a page or element call imports
     nothing from `system/`. (2) The wireframe stage ends with an inventory of the needed parts,
     each mapped to an SDK component or marked new; it is the queue of component calls. The
     inventory is a typed `inventory` field of the wireframe call's `defineCall()` (Tom, 2026-10-23),
     not a markdown file.
   - Enforced (Tom, 2026-10-23): the design process is enforced from now on. A call without a
     `stage` is invalid; legacy calls created before this rule are ignored, not migrated.
     (3) Stage 1 is foundations: colours plus type scale, spacing and radius. (4) A page that
     shows a missing part opens a component call; it never draws the part inline.
   - After tomflix's component-call test (Tom decided, 2026-10-23): a drawing may set
     `et-surface--<name>` on an inner panel (side by side, elevated card), never on its root.
     `ng()` gets a `fields` option that builds signal form fields with value, errors and touched.
     A variant overrides a colour theme with `themeCss()` in its styles. `et-banner` keeps the
     projected icon; the SDK cannot know the icon of an app-registered theme.
   - Order (Tom agreed, 2026-10-23): first the project design system and the skill rule to
     reuse it, then the SSR compiler, then the interaction runtime and the theme switch.
   - Design system (Tom decided, 2026-10-23; step 1 done): an entry is a folder
     `.ethlete/design/system/<project>/<entry>/` with `<entry>.ts` (a drawing function built
     from the SDK mocks) and `entry.md` (what, when, SDK parts, do and do not). Its preview is
     a view call at `calls/<project>/system/<entry>/`. A `chosen` verdict does not make an
     entry; Tom says "accept into the system", and the agent extracts it in one commit. The
     rule is in the `design-exploration` skill, "Draw from the design system". No entry exists
     yet.

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
