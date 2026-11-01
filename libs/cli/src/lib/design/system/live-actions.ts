import { readFileSync } from 'fs';
import { AddressInfo } from 'net';
import { resolve } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { createPartShooter } from '../shot';
import { Browser, createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import { ACTION_INPUTS, ActionElement, actionFailureOf, ActionInput, actionScanScriptOf, parseAction } from './actions';
import { EMIT_WAIT_MS, INIT_SCRIPT, OVERLAY_ROOTS, settle } from './action-press';
import { compareFrameOf } from './compare-command';
import { frameContentOf, LiveError, LivePage, liveSpecOf, LiveState, openLivePage } from './live-compare';
import {
  PointerFocusProbes,
  tabAwayFrom,
  pointerFocusVerdictOf,
  readRingProbe,
  RingProbe,
  RingStyle,
} from './pointer-focus';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { createSystemModules, productModuleIdOf } from './system-modules';

/** A shell control: `occurrence` counts among the scanned controls of its key, `x`/`y` is its centre in the host box. */
export type LiveControl = ActionElement & {
  x: number;
  y: number;
  expanded: string | null;
  current: string | null;
  overlay: boolean;
  parts: string[];
};

/** What a press on a shell control changed on a page, comparable across pages. */
export type LiveOutcome = {
  emitted: string[];
  expanded: string[];
  current: string | null;
  added: string[];
  removed: string[];
};

/** One checked control and input on a live page; `page` is `drift` for a cross-page comparison. */
export type LiveLine = {
  page: string;
  element: string;
  input: ActionInput | null;
  failure: string | null;
  warning?: string | null;
  parts: string[];
};

const ownedScript = (shell: string) => `
  const shellHost = document.querySelector(${JSON.stringify(shell)});
  const shellRoot = shellHost && window.ng ? window.ng.getComponent(shellHost) : null;
  const owned = (element) => {
    let owner = window.ng.getOwningComponent(element);

    for (let depth = 0; owner && depth < 100; depth++) {
      if (owner === shellRoot) return true;
      owner = window.ng.getOwningComponent(window.ng.getHostElement(owner));
    }

    return false;
  };`;

/**
 * A script that scans the interactive elements under `roots` as the part check does and answers them with their
 * centre relative to the first `frame` element, `aria-expanded`, `aria-current` and their `data-et-part` keys from the
 * innermost out. With `shell` it keeps only the elements the shell component's view tree owns (Angular dev mode) and
 * those in an overlay, whose host Angular creates outside any view.
 */
export const liveControlsScriptOf = (options: { roots: string[]; frame: string; shell: string | null }) => `(() => {
  const scanned = ${actionScanScriptOf(options.roots)};
  ${options.shell === null ? 'const keep = () => true;' : `${ownedScript(options.shell)}\n  if (!window.ng) throw new Error('the app has no window.ng - the live action check needs a development build');\n  if (!shellRoot) return null;\n  const keep = (element) => owned(element) || !!element.closest(${JSON.stringify(OVERLAY_ROOTS)});`}
  const frame = document.querySelector(${JSON.stringify(options.frame)})?.getBoundingClientRect() ?? { x: 0, y: 0 };
  const counts = new Map();

  return scanned.flatMap((found) => {
    const element = document.querySelector('[data-et-action-probe="' + found.probe + '"]');

    if (!element || !keep(element)) return [];

    const box = element.getBoundingClientRect();
    const parts = [];

    for (let marked = element.closest('[data-et-part]'); marked; marked = marked.parentElement?.closest('[data-et-part]') ?? null)
      parts.push(...(marked.getAttribute('data-et-part') ?? '').split(' ').filter(Boolean));

    const occurrence = counts.get(found.key) ?? 0;

    counts.set(found.key, occurrence + 1);

    return [{
      ...found,
      occurrence,
      x: Math.round(box.x + box.width / 2 - frame.x),
      y: Math.round(box.y + box.height / 2 - frame.y),
      expanded: element.getAttribute('aria-expanded'),
      current: element.getAttribute('aria-current'),
      overlay: !!element.closest(${JSON.stringify(OVERLAY_ROOTS)}),
      parts,
    }];
  });
})()`;

/** A script that records each output the shell's components emit in `window.__etDesignEmits`. */
export const listenOutputsScriptOf = (shell: string) => `(() => {
  ${ownedScript(shell)}
  window.__etDesignEmits = [];
  window.__etListened ??= new WeakSet();

  for (const element of document.querySelectorAll('*')) {
    const component = window.ng.getComponent(element);

    if (!component || window.__etListened.has(component) || (component !== shellRoot && !owned(element))) continue;

    window.__etListened.add(component);

    for (const [output, property] of Object.entries(window.ng.getDirectiveMetadata(component)?.outputs ?? {}))
      component[property]?.subscribe?.(() => window.__etDesignEmits.push({ output }));
  }
})()`;

const idOf = (control: { key: string; occurrence: number }) => `${control.key}#${control.occurrence}`;

/** The name a report line gives a control. */
export const controlNameOf = (control: { key: string; occurrence: number }) =>
  control.occurrence === 0 ? control.key : `${control.key} (${control.occurrence + 1}.)`;

/** The design control of the same key nearest to `app`, as both sit in their host box. */
export const nearestControlOf = <T extends { key: string; x: number; y: number }>(app: T, design: T[]) =>
  design
    .filter((candidate) => candidate.key === app.key)
    .reduce<T | null>(
      (best, candidate) =>
        best === null ||
        Math.hypot(candidate.x - app.x, candidate.y - app.y) < Math.hypot(best.x - app.x, best.y - app.y)
          ? candidate
          : best,
      null,
    );

/** What a press changed: the outputs it fired, the expanded controls after it, the controls that gained an `aria-current`, and the controls it added or removed. */
export const liveOutcomeOf = (options: { before: LiveControl[]; after: LiveControl[]; emitted: string[] }) => {
  const { before, after } = options;
  const currentBefore = new Map(before.map((control) => [idOf(control), control.current]));
  const gained = after
    .filter((control) => control.current !== null && currentBefore.get(idOf(control)) !== control.current)
    .map((control) => `${controlNameOf(control)}=${control.current}`);
  const ids = (controls: LiveControl[]) => new Set(controls.map(idOf));
  const had = ids(before);
  const has = ids(after);

  return {
    emitted: [...new Set(options.emitted)].sort(),
    expanded: after.filter((control) => control.expanded === 'true').map(controlNameOf),
    current: gained.length === 0 ? null : gained.join(', '),
    added: after.filter((control) => !had.has(idOf(control))).map(controlNameOf),
    removed: before.filter((control) => !has.has(idOf(control))).map(controlNameOf),
  } satisfies LiveOutcome;
};

const outcomeTextOf = (outcome: LiveOutcome, fields: (keyof LiveOutcome)[]) =>
  fields
    .map((field) => {
      const value = outcome[field];

      return `${field} ${Array.isArray(value) ? (value.length > 0 ? value.join(', ') : 'none') : (value ?? 'unchanged')}`;
    })
    .join('; ');

/**
 * The drift lines of the presses on several pages: a control, its declared action and input whose outcome differs
 * between pages fails once, naming each page with what it did.
 */
export const liveDriftOf = (
  presses: {
    page: string;
    control: string;
    action: string | null;
    input: ActionInput;
    outcome: LiveOutcome;
    parts: string[];
  }[],
): LiveLine[] => {
  const groups = new Map<string, typeof presses>();

  for (const press of [...presses].sort((a, b) => a.page.localeCompare(b.page))) {
    const group = `${press.control}\n${press.action ?? ''}\n${press.input}`;

    groups.set(group, [...(groups.get(group) ?? []), press]);
  }

  return [...groups.values()].flatMap((group) => {
    const first = group[0];
    const distinct = new Set(group.map((press) => JSON.stringify(press.outcome)));

    if (!first || group.length < 2) return [];

    const fields = (Object.keys(first.outcome) as (keyof LiveOutcome)[]).filter(
      (field) => new Set(group.map((press) => JSON.stringify(press.outcome[field]))).size > 1,
    );

    return [
      {
        page: 'drift',
        element: first.control,
        input: first.input,
        parts: [...new Set(group.flatMap((press) => [press.page, ...press.parts]))],
        failure:
          distinct.size === 1
            ? null
            : `behaves differently per page: ${group.map((press) => `${press.page}: ${outcomeTextOf(press.outcome, fields)}`).join(' | ')}`,
      },
    ];
  });
};

/** Whether the controls after a press show the `aria-expanded` values the declared state draws. */
export const liveStateCompareOf = (options: {
  state: string;
  expected: Record<string, string>;
  after: LiveControl[];
}) => {
  const keys = Object.keys(options.expected);

  if (keys.length === 0)
    return {
      ok: false,
      detail: `state ${options.state} draws no aria-expanded control, so a live page cannot tell it`,
    };

  const wrong = keys.flatMap((key) => {
    const found = options.after.find((control) => control.key === key)?.expanded ?? 'absent';

    return found === options.expected[key] ? [] : [`${key} aria-expanded ${found}, not ${options.expected[key]}`];
  });

  return { ok: wrong.length === 0, detail: wrong.join(', ') };
};

/** The line `design actions --live` prints for one checked control and input. */
export const liveLineOf = ({ page, element, input, failure, warning }: LiveLine) =>
  `${page} ${element}${input === null ? '' : ` ${input}`} ${failure === null ? `ok${warning ? ` (warning: ${warning})` : ''}` : `FAILED ${failure}`}`;

const LOCATE_TIMEOUT_MS = 5000;

const LOCATE_POLL_MS = 100;

const STABLE_SCANS = 3;

const STABLE_POLL_MS = 250;

type Context = Awaited<ReturnType<Browser['newContext']>>;

type Target = { key: string; occurrence: number };

type PageRun = {
  name: string;
  page: LivePage;
  state: LiveState;
  design: string;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Presses every shell control of the first live state of every live page with click, Enter and Space, checks that each
 * reaches the action its page design declares (an output of a shell component fires, or the declared state's
 * `aria-expanded` values show), and compares the outcome of each control across pages. With `part` it presses only the
 * controls drawn by that part and keeps the lines of that page or part.
 */
export const checkLiveActions = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  url: string;
  part: string | null;
}): Promise<{ lines: LiveLine[] } | string> => {
  const { target, config, product, url, part } = options;
  const live = liveSpecOf({ target, product });

  if (typeof live === 'string') return live;

  const { spec, dir } = live;

  if (spec.shell === undefined) return `the live spec has no "shell" selector of the app's shell component`;

  const presetName = Object.keys(product.presets)[0] ?? '';
  const presetSize = product.presets[presetName];

  if (presetSize?.height === undefined) return `the product has no preset "${presetName}" with a height`;

  const size = { width: presetSize.width, height: presetSize.height };
  const shell = spec.shell;

  if (!(await chromiumOf(target))) return 'actions needs playwright or playwright-core in the checkout';

  const queue = createDrawQueue({ target });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });
  let shooter: ReturnType<typeof createPartShooter> | undefined;

  try {
    await server.listen();

    const base = `http://localhost:${(server.httpServer?.address() as AddressInfo).port}`;

    shooter = createPartShooter({ target, base, system: createSystemModules({ target, config }), queue });

    const pictures = shooter;
    const slotFill = spec.frame ? frameContentOf(readFileSync(resolve(dir, spec.frame))) : null;
    const statesCache = new Map<string, string[]>();
    const statesOf = async (key: string) => {
      const cached = statesCache.get(key);

      if (cached) return cached;

      const file = product.parts.find((candidate) => partKeyOf(candidate) === key)?.file;
      const module = file
        ? ((await server.ssrLoadModule(productModuleIdOf({ file, product: product.name }))) as {
            default?: { states?: unknown };
          })
        : {};
      const loaded = module.default?.states;
      const names = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? Object.keys(loaded) : [];

      statesCache.set(key, names);

      return names;
    };
    const designControlsOf = async (design: {
      markup: string;
      frame: string;
      viewport: { width: number; height: number };
    }) =>
      queue.run(async (browser) => {
        const context = await browser.newContext({ viewport: design.viewport, deviceScaleFactor: 1 });

        try {
          const page = await context.newPage();

          await page.setContent(design.markup);

          return (await page.evaluate(
            liveControlsScriptOf({ roots: ['body'], frame: design.frame, shell: null }),
          )) as LiveControl[];
        } finally {
          await context.close();
        }
      });
    const targetCache = new Map<string, Promise<LiveControl[]>>();
    const targetControlsOf = (owner: string, state: string) => {
      const key = `${owner}\n${state}`;
      const cached =
        targetCache.get(key) ??
        (async () => {
          const frame = compareFrameOf({ presets: product.presets, part: owner, preset: null });
          const picture = await pictures.pictureOf({
            product: product.name,
            part: owner,
            state,
            preset: typeof frame === 'string' ? null : frame.preset,
            width: null,
            sketch: null,
            interaction: null,
            bare: true,
            emptySlots: true,
            params: new URLSearchParams(),
          });

          return designControlsOf({
            markup: picture.markup ?? '',
            frame: 'body',
            viewport:
              typeof frame === 'string' || !frame.size
                ? size
                : { width: frame.size.width, height: frame.size.height ?? size.height },
          });
        })();

      targetCache.set(key, cached);

      return cached;
    };
    const ownerOf = async (state: string, parts: string[]) => {
      for (const candidate of parts) if ((await statesOf(candidate)).includes(state)) return candidate;

      return null;
    };

    const runs: PageRun[] = Object.entries(spec.pages).flatMap(([name, page]) => {
      const first = Object.values(page.states)[0];

      return first ? [{ name, page, state: first, design: first.design }] : [];
    });
    const lines: LiveLine[] = [];
    const presses: Parameters<typeof liveDriftOf>[0] = [];

    const press = async (options: { run: PageRun; opener: Target | null; pick: Target; input: ActionInput }) =>
      queue.run(async (browser) => {
        const context: Context = await browser.newContext({
          viewport: size,
          deviceScaleFactor: 1,
          ...(spec.now !== undefined && { timezoneId: 'UTC' }),
        });

        try {
          await context.addInitScript(INIT_SCRIPT);

          const { page, host } = await openLivePage({
            context,
            url,
            size,
            spec,
            dir,
            page: options.run.page,
            state: options.run.state,
            server: base,
            checkout: target,
            timeout: DRAW_TIMEOUT_MS,
          });
          const scan = async () =>
            (await page.evaluate(liveControlsScriptOf({ roots: [host, OVERLAY_ROOTS], frame: host, shell }))) as
              LiveControl[] | null;
          const locate = async (want: Target) => {
            const deadline = Date.now() + LOCATE_TIMEOUT_MS;

            for (;;) {
              const found = (await scan())?.find(
                (control) => control.key === want.key && control.occurrence === want.occurrence,
              );

              if (found) return page.locator(`[data-et-action-probe="${found.probe}"]`);
              if (Date.now() > deadline)
                throw new LiveError(`the page has no ${controlNameOf(want)} after a fresh load`);

              await page.waitForTimeout(LOCATE_POLL_MS);
            }
          };

          const stableScan = async () => {
            const deadline = Date.now() + DRAW_TIMEOUT_MS;
            let last = '';
            let same = 0;

            await page.waitForLoadState('networkidle', { timeout: DRAW_TIMEOUT_MS }).catch(() => undefined);

            for (;;) {
              const controls = await scan();
              const shape = JSON.stringify(
                controls?.map(({ key, occurrence, expanded, current }) => [key, occurrence, expanded, current]),
              );

              same = shape === last ? same + 1 : 0;
              last = shape;

              if (same >= STABLE_SCANS - 1 || Date.now() > deadline) return controls ?? [];

              await page.waitForTimeout(STABLE_POLL_MS);
            }
          };

          await page.mouse.move(-1, -1);
          await settle(page, DRAW_TIMEOUT_MS);
          await stableScan();

          if (options.opener) {
            await (await locate(options.opener)).click({ timeout: DRAW_TIMEOUT_MS });
            await page.mouse.move(-1, -1);
            await settle(page, DRAW_TIMEOUT_MS);
          }

          const before = await stableScan();
          const control = await locate(options.pick);

          await page.evaluate(listenOutputsScriptOf(shell));
          await page.evaluate('window.__etPrevented = [];');

          let clickRing: RingProbe | null = null;
          let keyboardRing: PointerFocusProbes['keyboard'] = null;

          if (options.input === 'click') {
            await tabAwayFrom(page, control);
            await control.click({ timeout: DRAW_TIMEOUT_MS });
            await settle(page, DRAW_TIMEOUT_MS);
            clickRing = await readRingProbe(control).catch(() => null);
            await page.mouse.move(-1, -1);
          } else {
            const before: RingStyle | undefined = (await readRingProbe(control).catch(() => null))?.style;

            await page.keyboard.press('Shift');
            await control.focus({ timeout: DRAW_TIMEOUT_MS });

            if (options.input === 'Enter') {
              await settle(page, DRAW_TIMEOUT_MS);

              const probe = await readRingProbe(control).catch(() => null);

              keyboardRing = before && probe ? { before, probe } : null;
            }

            await page.keyboard.press(options.input);
          }

          await page.waitForTimeout(EMIT_WAIT_MS);
          await settle(page, DRAW_TIMEOUT_MS);

          const emitted = (await page.evaluate(
            '(window.__etDesignEmits ?? []).map((emit) => emit.output)',
          )) as string[];
          const prevented = ((await page.evaluate('window.__etPrevented')) as string[]).length > 0;

          return { before, after: await stableScan(), emitted, prevented, clickRing, keyboardRing };
        } finally {
          await context.close();
        }
      });

    type Checked = {
      app: LiveControl;
      declared: string | null;
      owner: string | null;
      parts: string[];
      opener: Target | null;
    };

    const check = async (run: PageRun, controls: Checked[]) => {
      const found: Checked[] = [];

      await Promise.all(
        controls.map(async ({ app, declared, owner, parts, opener }) => {
          const name = controlNameOf(app);
          const action =
            declared === null
              ? null
              : declared.trim().startsWith('emit:')
                ? parseAction(declared, [])
                : owner === null
                  ? `data-et-action="${declared}" names no state of ${parts.join(', ') || 'its part'}`
                  : parseAction(declared, await statesOf(owner));

          if (action === null || typeof action === 'string') {
            lines.push({
              page: run.name,
              element: name,
              input: null,
              parts,
              failure: action ?? 'the page design declares no data-et-action for it',
            });
          }

          const rings: PointerFocusProbes = { click: null, keyboard: null };

          await Promise.all(
            ACTION_INPUTS.map(async (input) => {
              try {
                const result = await press({ run, opener, pick: app, input });
                const outcome = liveOutcomeOf(result);

                rings.click ??= result.clickRing;
                rings.keyboard ??= result.keyboardRing;

                presses.push({ page: run.name, control: name, action: declared, input, outcome, parts });

                if (
                  input === 'click' &&
                  action !== null &&
                  typeof action !== 'string' &&
                  action.kind === 'state' &&
                  owner !== null
                ) {
                  const reached = await targetControlsOf(owner, action.state);

                  for (const added of result.after.filter(
                    (control) => control.overlay && !result.before.some((had) => idOf(had) === idOf(control)),
                  )) {
                    const drawn = reached.find(
                      (control) => control.key === added.key && control.occurrence === added.occurrence,
                    );

                    found.push({
                      app: added,
                      declared: drawn?.action ?? null,
                      owner: drawn?.action ? await ownerOf(drawn.action, [owner, ...drawn.parts]) : null,
                      parts: [...new Set([...(drawn?.parts ?? []), ...parts])],
                      opener: app,
                    });
                  }
                }

                if (action === null || typeof action === 'string') return;

                const compare =
                  action.kind === 'state' && owner !== null
                    ? liveStateCompareOf({
                        state: action.state,
                        expected: Object.fromEntries(
                          (await targetControlsOf(owner, action.state)).flatMap((control) =>
                            control.expanded === null ? [] : [[control.key, control.expanded]],
                          ),
                        ),
                        after: result.after,
                      })
                    : null;

                lines.push({
                  page: run.name,
                  element: name,
                  input,
                  parts,
                  failure: actionFailureOf({
                    action,
                    target: action.kind === 'state' ? action.state : '',
                    input,
                    outcome: { emitted: result.emitted, prevented: result.prevented, compare },
                  }),
                });
              } catch (error) {
                lines.push({
                  page: run.name,
                  element: name,
                  input,
                  parts,
                  failure: messageOf(error).split('\n')[0] ?? '',
                });
              }
            }),
          );

          if (rings.click !== null) {
            const { failure, warning } = pointerFocusVerdictOf(rings);

            lines.push({ page: run.name, element: `${name} pointer focus`, input: null, parts, failure, warning });
          }
        }),
      );

      return found;
    };

    await Promise.all(
      runs.map(async (run) => {
        try {
          const picture = await pictures.pictureOf({
            product: product.name,
            part: run.name,
            state: run.design,
            preset: presetName,
            width: null,
            sketch: null,
            interaction: null,
            pan: run.state.pan ?? null,
            emptySlots: slotFill !== null,
            slotFill,
            compose: run.state.compose ?? null,
            params: new URLSearchParams(),
          });
          const design = await designControlsOf({
            markup: picture.markup ?? '',
            frame: `[data-et-part~="${run.name}"]`,
            viewport: size,
          });
          const app = await queue.run(async (browser) => {
            const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });

            try {
              const { page, host } = await openLivePage({
                context,
                url,
                size,
                spec,
                dir,
                page: run.page,
                state: run.state,
                server: base,
                checkout: target,
                timeout: DRAW_TIMEOUT_MS,
              });

              await settle(page, DRAW_TIMEOUT_MS);

              return (await page.evaluate(
                liveControlsScriptOf({ roots: [host, OVERLAY_ROOTS], frame: host, shell }),
              )) as LiveControl[] | null;
            } finally {
              await context.close();
            }
          });

          if (app === null) {
            lines.push({
              page: run.name,
              element: `(no ${shell} on the page)`,
              input: null,
              parts: [run.name],
              failure: null,
            });

            return;
          }

          const relevant = (parts: string[]) => part === null || part === run.name || parts.includes(part);
          const controls = await Promise.all(
            app.map(async (control) => {
              const drawn = nearestControlOf(control, design);
              const parts = [run.name, ...(drawn?.parts ?? [])];
              const declared = drawn?.action ?? null;

              return {
                app: control,
                declared,
                owner: declared === null ? null : await ownerOf(declared.trim(), drawn?.parts ?? []),
                parts,
                opener: null,
              } satisfies Checked;
            }),
          );
          const reached = await check(
            run,
            controls.filter((control) => relevant(control.parts)),
          );
          const unique = [...new Map(reached.map((control) => [idOf(control.app), control])).values()];

          await check(
            run,
            unique.filter((control) => relevant(control.parts)),
          );
        } catch (error) {
          lines.push({
            page: run.name,
            element: '-',
            input: null,
            parts: [run.name],
            failure: error instanceof LiveError ? error.message : (messageOf(error).split('\n')[0] ?? ''),
          });
        }
      }),
    );

    const order = (line: LiveLine) =>
      `${line.page}\n${line.element}\n${line.input === null ? '' : ACTION_INPUTS.indexOf(line.input)}`;
    const kept = (line: LiveLine) => part === null || line.parts.includes(part);

    return {
      lines: [...lines.sort((a, b) => order(a).localeCompare(order(b))), ...liveDriftOf(presses)].filter(kept),
    };
  } catch (error) {
    return messageOf(error);
  } finally {
    await shooter?.close();
    await queue.close();
    await server.close();
  }
};
