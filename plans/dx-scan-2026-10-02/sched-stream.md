# sched-stream — DX scan 2026-10-02

Scope: `libs/components/src/lib/scheduler`, `libs/components/src/lib/stream`, `apps/docs/components/scheduler.md`,
`apps/docs/components/stream.md`, the stories under both folders.

| ID    | Sev    | Kind     | Decision | Title                                                                                                                            |
| ----- | ------ | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| SS-01 | High   | bug      | yes      | A scheduler without `provideSchedulerEditSurface()` is not really read-only: the draft range sticks, and dead buttons log ET4505 |
| SS-02 | High   | dx       | yes      | `<et-scheduler>` gives no way to add, remove or configure edit-surface fields and actions                                        |
| SS-03 | Medium | dx       | yes      | The default views inside a bare `[etScheduler]` render empty badges                                                              |
| SS-04 | Medium | dx       | no       | `TExtra` is lost at `<et-scheduler>`, its outputs and the edit-field contract                                                    |
| SS-05 | Medium | dx       | yes      | The PiP slot placeholder is off by default, and the guide never mentions it                                                      |
| SS-06 | Medium | dx       | no       | A missing or unparseable source (SOOP, Twitch) gives a shared `…-null` player and a loading overlay that never ends              |
| SS-07 | Medium | dx       | no       | `pipActivate()` does nothing and says nothing without `provideStreamPip()` or a player                                           |
| SS-08 | Medium | test-gap | no       | None of the eight platform player/params directives has a spec                                                                   |
| SS-09 | Low    | dx       | no       | The ET45xx docs leave out ET4504, and say "dev mode only" for codes that also throw in production                                |
| SS-10 | Low    | dx       | no       | The slot handle exposes a writable player-id signal, and the controls sit three hops deep                                        |
| SS-11 | Low    | dx       | no       | No stories for headless scheduler composition, custom adornments/fields, slot controls, CMP consent or custom PiP chrome         |

## SS-01 A scheduler without `provideSchedulerEditSurface()` is not really read-only: the draft range sticks, and dead buttons log ET4505

- Where: `libs/components/src/lib/scheduler/scheduler.component.ts:335-347` (`openDraftSurface` returns without
  clearing the draft), `:272-283`, `:318-330`; `scheduler-month-view.component.ts:203-214`;
  `scheduler-time-grid-view.component.ts:407-413`; `scheduler-action-add-appointment.directive.ts:32-39`; the
  docs claim at `apps/docs/components/scheduler.md:298`.
- Problem: the guide says a scheduler without the edit surface "remains read-only". In practice, with
  `<et-scheduler [appointments]="list" />` and no provider:
  1. A click on an empty month cell sets a draft range and commits it. `openDraftSurface` reports ET4505 and
     returns, but never calls `clearDraftRange()`. The cell keeps its drafted highlight for good. A later plain
     click lands in `settle` with `draft.phase === 'committed'` and returns, so the stuck range never goes away.
     Keyboard create (`createAppointmentOn` / `draftHourFrom`) is also blocked while it sits there. The time grid
     behaves the same way.
  2. The toolbar still renders the "Add appointment" button (`etSchedulerActionAddAppointment` is on by default).
     A click on it only reports ET4505.
  3. Every badge click reports ET4505 to the `ErrorHandler`, even when the app only wants
     `(selectedAppointmentIdChange)` to drive its own detail panel.
     Drag-to-create also has no feature toggle, unlike move/resize (`etSchedulerAppointmentDrag`) and swipe, so the
     consumer cannot turn the gesture off.
- Fix: when `SCHEDULER_EDIT_SURFACE` is absent, `<et-scheduler>` should (a) not start drag-to-create, or at least
  call `headless.clearDraftRange()` in the no-surface branch of `openDraftSurface`, (b) leave the add action out of
  `toolbarActions`, and (c) treat a selection as a plain selection with no ET4505. The other option is an explicit
  `readonly` input, or an `etSchedulerDragToCreate` feature directive with `{ enabled }`, which keeps ET4505 for the
  real misconfiguration. Add a component spec: no provider, click an empty cell, expect `draftRange()` null and no
  add button.
- Breaking: no (behavior change only). Decision: yes. Choose between "no provider means read-only" and an explicit
  `readonly` / drag-to-create toggle.
- Status: fixed: no provider means read-only. New `createEnabled` signal on `SchedulerDirective`, set from `<et-scheduler>`; views gate drag/click/Enter create on it; add action disabled without the surface; `openEditSurface` only selects without it; draft branch clears the range. Specs in `scheduler.component.spec.ts` (3 fail without the fix). `ReadOnly` story.
- Review: fixed: the add action's gate on `SCHEDULER_EDIT_SURFACE` hid it for an own feature host too (broke `scheduler-composition` scenario); it now reads the new optional `SchedulerFeatureHost.canAddAppointment()`. Updated the `scheduler.scenario` misuse test that still expected ET4505 on a badge click. Changeset bumped to minor.

## SS-02 `<et-scheduler>` gives no way to add, remove or configure edit-surface fields and actions

- Where: `libs/components/src/lib/scheduler/scheduler-edit-surface.provider.ts:6-12` (no options);
  `scheduler.component.ts:156-182, 288-291, 332, 360-363` (none of the three openers passes `directives`); docs
  `apps/docs/components/scheduler.md:334-338, 369, 373-396`.
- Problem: the built-in fields and actions are host directives on `<et-scheduler-edit-surface>`. Their config inputs
  (`[etSchedulerEditDescription]="{ enabled: false }"`) and custom field directives can only be bound when the app
  hosts the surface itself. `<et-scheduler>` opens the surface through `SCHEDULER_EDIT_SURFACE_OVERLAY` with only
  `origin` and `bindings`. So the most common setup, `<et-scheduler>` plus `provideSchedulerEditSurface()`, cannot
  hide the description field, add a custom field that writes `extra`, or add a custom appointment action. The guide
  shows `<et-scheduler-edit-surface [etSchedulerEditDescription]=…>` as if it applied here, and the "Extending the
  edit surface" section only covers a self-built headless shell. The way out is to rebuild the whole toolbar and
  views shell.
- Fix: accept the overlay's `directives` list from the provider and forward it in all three `open()` calls, e.g.
  `provideSchedulerEditSurface({ directives: [MyEditIssueDirective, { type: SchedulerEditDescriptionDirective, bindings: [inputBinding('etSchedulerEditDescription', () => ({ enabled: false }))] }] })`.
  Alternatively add an `editSurfaceDirectives` input on `<et-scheduler>`. Update the guide's "Extending the edit
  surface" section, and add a story with a custom field.
- Breaking: no. Decision: yes (shape of the new API: provider option vs input).
- Status: open: user decision.
- Review: open (user decision).

## SS-03 The default views inside a bare `[etScheduler]` render empty badges

- Where: `libs/components/src/lib/scheduler/scheduler-month-view.component.ts:51, 77-79` (same pattern in
  `scheduler-time-grid-view.component.ts:106` and `scheduler-agenda-view.component.ts:26`);
  `headless/scheduler-features.ts:158-169`; `scheduler-badge-title.directive.ts:20`; docs
  `apps/docs/components/scheduler.md:130`.
- Problem: only `SchedulerComponent` provides `SCHEDULER_FEATURE_HOST`. In
  `<div etScheduler [appointments]="a"><et-scheduler-month-view /></div>`, `badgeAdornments()` returns `[]`, so
  every badge is an empty `<button>`: no title, no time, and no accessible name. Adding `etSchedulerBadgeTitle` to
  the `[etScheduler]` element throws ET4500 ("must be used inside an <et-scheduler>"). The guide says the month view
  "only renders correctly inside `<et-scheduler>` or your own `[etScheduler]` element". The second half is wrong
  unless the app also implements a whole `SchedulerFeatureHost` (the `#own-feature-host` section). Nothing warns
  about it in dev mode.
- Fix: one of three. (a) Have `SchedulerDirective` (or a small `[etSchedulerFeatureHost]` directive) provide a
  registry-backed `SCHEDULER_FEATURE_HOST`, so badge directives work on a bare `[etScheduler]`. (b) Have the views
  fall back to the built-in title/time adornments when no host exists. (c) At minimum, raise a dev-mode error from
  the views when `featureHost` is null, and correct the guide sentence.
- Breaking: no. Decision: yes (pick a, b or c).
- Status: open: user decision.
- Review: open (user decision).

## SS-04 `TExtra` is lost at `<et-scheduler>`, its outputs and the edit-field contract

- Where: `libs/components/src/lib/scheduler/scheduler.component.ts:97, 112, 115` (`SchedulerComponent` is not
  generic, `output<Appointment>()`); `scheduler-edit-surface.token.ts:5-6`; `headless/scheduler-features.ts:105,
184, 231` (`Appointment` with `unknown` extra); compare `headless/scheduler.directive.ts:54` (generic).
- Problem: `Appointment<TExtra>` is documented as the extension point that custom fields "typically write into".
  But `(appointmentSave)="save($event)"` with `save(a: Appointment<IssueExtra>)` fails strict templates, because
  `extra?: unknown` does not assign to `IssueExtra`. `appointmentReschedule` behaves the same way through the host
  directive. A custom edit field's `draft: InputSignal<WritableSignal<Appointment>>` forces a cast on every
  `extra` read. The headless directive is generic, but everything a consumer actually touches is not.
- Fix: make `SchedulerComponent<TExtra = unknown>` generic, so it infers from `[appointments]`, and type
  `appointmentSave` / `appointmentsDelete` / `SchedulerEditSurfaceResult<TExtra>` with it. Make `SchedulerEditField`,
  `SchedulerFeatureHost` and `SchedulerEditSurfaceHost` generic over `TExtra` with an `unknown` default.
- Breaking: no (defaults keep today's types). Decision: no.
- Status: open: not fixed. Making `SchedulerComponent<TExtra>` generic gives nothing in templates, because Angular infers a component generic only from the component's own inputs, and `appointments` is a host-directive input. The component would have to own `appointments`, which collides with `SchedulerFeatureHost.appointments()` (the visible ones). Needs a rename such as `visibleAppointments()` (breaking), so it is a design call.
- Review: ok (left open, design call).

## SS-05 The PiP slot placeholder is off by default, and the guide never mentions it

- Where: `libs/components/src/lib/stream/stream-config.ts:17, 46` (`pipSlotPlaceholderComponent: null`);
  `stream-player-slot.ts:244-248`; `stream-default-components.ts:12-15` (no placeholder); docs
  `apps/docs/components/stream.md:126-158`, `:178` (theming for `--et-pip-slot-placeholder-*`), `:164` (labels).
  Every PiP story sets it by hand, e.g. `stories/components/youtube-player-slot-storybook.component.ts:219`.
- Problem: an app that follows the guide (`provideStreamPip()` + `STREAM_PIP_IMPORTS` + `pipActivate()`) gets an
  empty box where the player was while it floats. There is no "playing in PiP" message and no back button. The
  guide documents the placeholder's tokens and labels but never says that `PipSlotPlaceholderComponent` has to be
  registered via `provideStreamConfig({ pipSlotPlaceholderComponent: PipSlotPlaceholderComponent })`. Nothing in
  the docs names the option at all.
- Fix: one of two. (a) Let `provideStreamPip()` default the placeholder, since PiP is the only case where it
  renders, with `pipSlotPlaceholderComponent: null` to opt out. (b) Add it to `STREAM_DEFAULT_COMPONENTS`. Either
  way, document the option in the PiP section.
- Breaking: no for (a)/(b) (visual change). Decision: yes (which default).
- Status: open: user decision.
- Review: open (user decision).

## SS-06 A missing or unparseable source (SOOP, Twitch) gives a shared `…-null` player and a loading overlay that never ends

- Where: `libs/components/src/lib/stream/platform/soop/headless/soop-player-params.directive.ts:9-17`;
  `soop/headless/soop-player.directive.ts:44-46`;
  `platform/twitch/headless/twitch-player-params.directive.ts:20-39`;
  `twitch/headless/twitch-player.directive.ts:48-51`; `stream-player-slot.ts:124-134`.
- Problem: `<et-soop-player-slot />` with neither `userId` nor `videoId`, or a Twitch `src` the regexes reject
  (`https://www.twitch.tv/videos/`, a clip URL), yields the player id `soop-video-null` / `twitch-video-null`.
  The player directive returns `null` params, so the state stays `isReady: false` and the slot's overlay computes
  `'loading'` indefinitely. Two such slots on a page get the same id and share one player. SOOP warns nothing.
  Twitch logs a bare `console.warn` (no code, not via `ErrorHandler`) that names inputs `channel` / `video`, which
  the slot does not have; its input is `src`. SOOP also accepts both ids at once and silently prefers `userId`.
- Fix: in dev mode, report a new `ET1611` through the `ErrorHandler` when a params directive resolves no source,
  and name the real inputs. Set `state.error` so the error overlay shows instead of the spinner. Use a non-null
  sentinel that cannot collide (or skip `registerPlayer`) when there is no source. Optionally type SOOP's source as
  a union (`{ userId } | { videoId }`) or warn when both are set.
- Breaking: no. Decision: no.
- Status: fixed: SOOP/Twitch params use a unique `…-missing-<id>` player id; the player directives fail the resource with `ET1611` (reported via `ErrorHandler` in dev mode, naming the real inputs), so the error overlay shows. Scenario in `stream-players.scenario.spec.ts`, params specs.
- Review: ok. Changeset shortened.

## SS-07 `pipActivate()` does nothing and says nothing without `provideStreamPip()` or a player

- Where: `libs/components/src/lib/stream/stream-player-slot.ts:61-76, 373-387`; `pip-manager.ts:73-77`.
- Problem: `slot.slotDirective.slot.pipActivate()` is `streamPip?.manager.pipActivate(...)`. Without the provider
  it returns `undefined` and nothing happens, and the same goes for a slot still behind the consent gate (no
  registered slot or player). The playback controls on the same handle return `boolean` for exactly this
  "could not" case (docs `stream.md:76`). PiP is the odd one out, so a consumer who forgot `provideStreamPip()`
  gets a button that silently does nothing.
- Fix: have `pipActivate` / `pipDeactivate` return `boolean` like the controls, and in dev mode report a coded error
  when `STREAM_PIP_TOKEN` is missing ("add provideStreamPip() where the slot is provided"). Update the handle
  JSDoc and the guide's PiP section.
- Breaking: no (`void` → `boolean`). Decision: no.
- Status: fixed: `pipActivate`/`pipDeactivate` return `boolean` on the handle and the PiP manager; `ET1612` in dev mode without `provideStreamPip()`. Specs in `stream-player-slot.spec.ts`.
- Review: ok.

## SS-08 None of the eight platform player/params directives has a spec

- Where: `libs/components/src/lib/stream/platform/**` (no `*.spec.ts` under `platform/`). The parsing at risk is in
  `twitch/headless/twitch-player-params.directive.ts:5-39`.
- Problem: the Twitch `src` parsing (channel URL vs `/videos/<id>` vs bare name vs all-digit id), the SOOP id
  choice, the iframe `title`s from `STREAM_LABELS.playerFrame`, the Facebook SDK locale mapping
  (`de` → `de_DE`, documented at `stream.md:206`) and each SDK's `onReady` / `onError` → `state` wiring are all
  untested. `stream-player-slot.spec.ts` and the managers use a fake player only. A regex tweak or an SDK event
  rename regresses silently.
- Fix: add one spec per params directive (pure: input → `playerId` / `channel` / `video`), plus one per SDK player
  that stubs `injectStreamScriptLoader` and the window global (`YT`, `Twitch`, `Vimeo`, `FB`) and asserts the state
  transitions and the ET16xx errors.
- Breaking: no. Decision: no.
- Status: fixed (partly): params specs for all eight platforms; player specs for YouTube, Vimeo and Facebook. Twitch/SOOP players are covered by the scenarios. No player specs for Dailymotion, Kick or TikTok (iframe-only).
- Review: ok, done: Twitch, SOOP, Kick, Dailymotion and TikTok player state/error wiring is asserted in `stream-players.scenario.spec.ts`, so every platform player is covered by a spec or a scenario. Nothing left.

## SS-09 The ET45xx docs leave out ET4504, and say "dev mode only" for codes that also throw in production

- Where: `apps/docs/components/error-codes.md:446-457`; `libs/components/src/lib/scheduler/scheduler-errors.ts:11`;
  `scheduler-appointment-drag.directive.ts:45-51`; `headless/scheduler-features.ts:161-166, 255-260`;
  `scheduler-swipe-navigation.directive.ts:47-53`.
- Problem: `ET4504` (`[etSchedulerAppointmentDrag]` outside an `[etScheduler]`) is missing from the table. The
  section header says "Checked in dev mode only", but ET4500, ET4502, ET4503 and ET4504 throw unconditionally in
  constructors. Only ET4501 (via `afterNextRender` under `ngDevMode`), ET4505 and ET4506 are dev-only.
- Fix: add the ET4504 row and split the header the way the Icon section does ("ET4500, ET4502–ET4504 throw on
  creation in all builds; ET4501, ET4505, ET4506 are dev-mode only").
- Breaking: no. Decision: no.
- Status: fixed: ET4504 row added, the header now says which codes are dev-only, and ET4505 is re-described.
- Review: ok.

## SS-10 The slot handle exposes a writable player-id signal, and the controls sit three hops deep

- Where: `libs/components/src/lib/stream/stream-player-slot.ts:61-63, 408-410`;
  `stream-player-slot.directive.ts:40-61` (no `exportAs`, no selector);
  `platform/youtube/youtube-player-slot.component.ts:29-31` (same in all eight); docs `stream.md:76, 117-118`.
- Problem: `StreamPlayerSlotHandle.currentPlayerIdSignal` is a `WritableSignal`. A consumer can `.set()` it and
  desync the slot from the stream manager, because `sync()` reads it as the source of truth for the bound player.
  Reaching the controls takes `#slot` then `slot.slotDirective.slot.play()`. The docs show this exact path, and it
  leaks two implementation layers into every template.
- Fix: expose `currentPlayerId: Signal<StreamPlayerId | null>` (use `.asReadonly()`) on the handle. Give each slot
  component a `public controls = inject(STREAM_PLAYER_SLOT_TOKEN).slot` (or make `slot` itself the handle), so the
  template reads `slot.controls.pipActivate()`.
- Breaking: yes (rename on the handle; the old path could stay as a deprecated alias). Decision: no.
- Status: fixed: handle has a read-only `currentPlayerId`; slot components expose `controls` (replacing `slotDirective`); new `injectStreamPlayerSlot()`. Callers in stories, scenarios and docs updated.
- Review: fixed: the guide now uses `injectStreamPlayerSlot()` instead of `inject(STREAM_PLAYER_SLOT_TOKEN).slot`; changeset shortened.

## SS-11 No stories for headless scheduler composition, custom adornments/fields, slot controls, CMP consent or custom PiP chrome

- Where: `libs/components/src/lib/scheduler/stories/scheduler.stories.ts:14-52`;
  `libs/components/src/lib/stream/stories/*.stories.ts`.
- Problem: the guides give whole sections to a bare `[etScheduler]` composition (`scheduler.md:445-490`), custom
  badge adornments (`:443`), custom edit fields (`:369-396`), slot playback controls via `STREAM_PLAYER_SLOT_TOKEN`
  (`stream.md:76-101`), a CMP-driven `STREAM_USER_CONSENT_PROVIDER_TOKEN` (`stream.md:105`) and a custom PiP chrome
  implementing `PipChromeRef` (`stream.md:136-150`). None of them has a story. A story would have exposed SS-02,
  SS-03 and SS-05 directly. The scheduler stories also all use `provideSchedulerEditSurface()`, so nothing exercises
  the read-only path (SS-01).
- Fix: add `Headless`, `CustomBadgeAdornment`, `CustomEditField` and `ReadOnly` scheduler stories, plus
  `SlotControls`, `ConsentProvider` and `CustomPipChrome` stream stories. Wire them into the guides with
  `<StoryEmbed>` where the page cap allows, otherwise name them in text.
- Breaking: no. Decision: no.
- Status: fixed (partly): `ReadOnly` scheduler story and YouTube `SlotControls` stream story. Not added: headless, custom adornment and custom edit field (blocked by SS-02/SS-03), consent provider, custom PiP chrome.
- Review: fixed (partly): added the YouTube `ConsentProvider` story (a fake CMP through `createUserConsentProvider`), and embedded `SlotControls` and `ConsentProvider` in the stream guide; the scheduler guide names the `ReadOnly` story (page already has 6 embeds). Left: `Headless`, `CustomBadgeAdornment`, `CustomEditField` scheduler stories (wait for SS-02/SS-03), and a `CustomPipChrome` stream story (port the `PipChromeRef` chrome from `stream-pip.scenario.spec.ts` "app-built chrome").
