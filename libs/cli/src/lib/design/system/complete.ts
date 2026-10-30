import { AddressInfo } from 'net';
import { dirname } from 'path';
import { chromiumOf } from '../browser';
import { INTERACTIONS } from '../force-interactions';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { partFrameOf, viewportOf } from '../shot';
import { Browser, createDrawQueue, openFrame, settled, ThumbUnavailableError } from '../thumb';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { readMerged } from './sketch/merged-parts';
import { createSystemModules, productModuleIdOf } from './system-modules';

/** One requirement of a part that `design complete` finds without evidence. `target` is `<part>[.<control>[.<requirement>]]`. */
export type CompletenessGap = { code: string; target: string; detail: string };

/** What one drawn frame of a state shows of the controls and surfaces its markup marks. */
export type SeenFrame = {
  state: string;
  interaction: string | null;
  controls: { id: string; forced: { interaction: string; differs: boolean; still?: string[] }[] }[];
  surfaces: { id: string; shown: boolean }[];
};

type DeclaredControl = { kind: string; input: string[]; part: string | null; surfaces: Record<string, string> };

/** The gaps of each part a control names in `part`, or why it could not be checked. */
export type ReferencedParts = Record<string, CompletenessGap[] | string>;

const CHECKED_KINDS = ['disclosure'];

const INPUT_INTERACTIONS: Record<string, string[]> = { pointer: ['hover', 'active'], keyboard: ['focus-visible'] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const requiredInteractionsOf = (control: DeclaredControl) =>
  control.input.flatMap((input) => INPUT_INTERACTIONS[input] ?? []);

const gridGapOf = (options: { grid: unknown; states: string[]; interactions: string[] }) => {
  const { grid, states, interactions } = options;
  const fix = `draw its states with interactionRows, which gives the grid a column per interaction (${interactions.join(', ')})`;

  if (!isRecord(grid) || !Array.isArray(grid['columns']) || !isRecord(grid['rows']))
    return `the part has no grid - ${fix}`;

  const columns = grid['columns'];
  const missing = interactions.filter((interaction) => !columns.includes(interaction));

  if (missing.length > 0) return `its grid has no column ${missing.join(', ')} - ${fix}`;

  const holes = Object.entries(grid['rows']).flatMap(([row, cells]) =>
    interactions
      .filter((interaction) => {
        const state = isRecord(cells) ? cells[interaction] : undefined;

        return typeof state !== 'string' || !states.includes(state);
      })
      .map((interaction) => `${row} ${interaction}`),
  );

  return holes.length > 0 ? `its grid draws no state in ${holes.join(', ')} - ${fix}` : null;
};

const declaredControlsOf = (value: unknown): Record<string, DeclaredControl> | null =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).map(([id, control]) => {
          const declared = isRecord(control) ? control : {};

          return [
            id,
            {
              kind: typeof declared['kind'] === 'string' ? declared['kind'] : '',
              part: typeof declared['part'] === 'string' ? declared['part'] : null,
              input: Array.isArray(declared['input'])
                ? declared['input'].filter((input): input is string => typeof input === 'string')
                : [],
              surfaces: isRecord(declared['surfaces'])
                ? Object.fromEntries(
                    Object.entries(declared['surfaces']).filter(
                      (entry): entry is [string, string] => typeof entry[1] === 'string',
                    ),
                  )
                : {},
            },
          ];
        }),
      )
    : null;

const interactionGapOf = (options: { frames: SeenFrame[]; id: string; interaction: string }) => {
  const { frames, id, interaction } = options;
  const forced = frames.flatMap((frame) =>
    frame.controls
      .filter((control) => control.id === id)
      .flatMap((control) => control.forced.filter((force) => force.interaction === interaction))
      .map((force) => ({ state: frame.state, differs: force.differs })),
  );

  if (forced.some((force) => force.differs)) return null;
  if (forced.length > 0)
    return `state ${forced[0]?.state} forces ${interaction} on it, but its box draws no different pixel than at rest`;

  return `no state draws it ${interaction} - draw a state that forces ${interaction} on the data-et-control element, e.g. with forceInteraction`;
};

const stillGapOf = (options: { frames: SeenFrame[]; id: string; interaction: string }) => {
  const { frames, id, interaction } = options;

  for (const frame of frames)
    for (const control of frame.controls.filter((seen) => seen.id === id))
      for (const force of control.forced.filter((seen) => seen.interaction === interaction && seen.still?.length))
        return `state ${frame.state} changes ${force.still?.join(', ')} in one frame - give them a transition with the product's motion tokens`;

  return null;
};

const disclosureGapsOf = (options: {
  frames: SeenFrame[];
  id: string;
  control: DeclaredControl;
  states: string[];
}): [string, string][] => {
  const { frames, id, control, states } = options;
  const rest = frames.filter((frame) => frame.interaction === null);
  const body = control.surfaces['body'];
  const bodyId = `${id}.body`;
  const showsBody = (frame: SeenFrame) => frame.surfaces.some((surface) => surface.id === bodyId && surface.shown);
  const drawsControl = (frame: SeenFrame) => frame.controls.some((seen) => seen.id === id);
  const gaps: [string, string][] = [];

  for (const interaction of control.part === null ? requiredInteractionsOf(control) : []) {
    const gap = interactionGapOf({ frames, id, interaction });

    if (gap) gaps.push([interaction, gap]);
  }

  if (!rest.some((frame) => drawsControl(frame) && !showsBody(frame)))
    gaps.push(['collapsed', `every state that draws it also shows its body - draw a state with ${bodyId} closed`]);

  if (body === undefined) gaps.push(['body', 'declares no surfaces.body - name the state that draws it open']);
  else if (!states.includes(body))
    gaps.push(['body', `surfaces.body names state ${body}, which the part does not declare`]);
  else if (!rest.some((frame) => frame.state === body && drawsControl(frame) && showsBody(frame)))
    gaps.push([
      'body',
      `state ${body} draws no visible, non-empty data-et-surface="${bodyId}" next to data-et-control="${id}"`,
    ]);

  return gaps;
};

/**
 * The gaps of one part, from its `controls` declaration, its state names and what each drawn frame showed.
 * A part that is not `reviewed` (its files differ from its merged.json hash) has no reviewed evidence at all.
 */
export const completenessGapsOf = (options: {
  part: string;
  controls: unknown;
  states: string[];
  frames: SeenFrame[];
  reviewed: boolean;
  grid?: unknown;
  referenced?: ReferencedParts;
}): CompletenessGap[] => {
  const { part, states, frames, reviewed, grid, referenced = {} } = options;
  const declared = declaredControlsOf(options.controls);

  if (declared === null)
    return [
      {
        code: 'CONTROLS-MISSING',
        target: part,
        detail:
          'declares no controls - list each control its drawing marks with data-et-control in definePart({ controls })',
      },
    ];

  const gaps: CompletenessGap[] = [];

  if (!reviewed)
    gaps.push({
      code: 'PART-UNREVIEWED',
      target: part,
      detail:
        'its files differ from the hash merged.json records for it, so no frame of it is reviewed - merge or accept it',
    });

  const seenIds = new Set(frames.flatMap((frame) => frame.controls.map((control) => control.id)));

  for (const id of [...seenIds].filter((seen) => !(seen in declared)).sort())
    gaps.push({
      code: 'CONTROL-UNKNOWN',
      target: `${part}.${id}`,
      detail: `data-et-control="${id}" is not in controls`,
    });

  const surfaceIds = new Set(frames.flatMap((frame) => frame.surfaces.map((surface) => surface.id)));

  for (const id of [...surfaceIds].sort()) {
    const [control = '', surface = ''] = id.split('.');

    if (!declared[control] || declared[control].surfaces[surface] === undefined)
      gaps.push({
        code: 'CONTROL-UNKNOWN',
        target: `${part}.${control}`,
        detail: `data-et-surface="${id}" names no surface its control declares`,
      });
  }

  for (const [id, control] of Object.entries(declared)) {
    if (!CHECKED_KINDS.includes(control.kind)) {
      gaps.push({
        code: 'CONTROL-KIND',
        target: `${part}.${id}`,
        detail: `kind "${control.kind}" is not checked yet - kinds are ${CHECKED_KINDS.join(', ')}`,
      });
      continue;
    }

    if (control.part === null && part.startsWith('pages/'))
      gaps.push({
        code: 'CONTROL-PART-MISSING',
        target: `${part}.${id}`,
        detail:
          "a page draws no interactions of its controls - name the part that draws them, e.g. part: 'components/disclosure'",
      });

    const used = control.part === null ? undefined : referenced[control.part];

    if (typeof used === 'string')
      gaps.push({ code: 'CONTROL-PART-INCOMPLETE', target: `${part}.${id}`, detail: `${control.part}: ${used}` });
    else if (used && used.length > 0)
      gaps.push({
        code: 'CONTROL-PART-INCOMPLETE',
        target: `${part}.${id}`,
        detail: `${control.part} is not design complete: ${used.length} gap(s) - run design complete ${control.part}`,
      });

    const interactions = control.part === null && !part.startsWith('pages/') ? requiredInteractionsOf(control) : [];
    const gridGap = interactions.length > 0 ? gridGapOf({ grid, states, interactions }) : null;

    if (gridGap) gaps.push({ code: 'CONTROL-GRID-MISSING', target: `${part}.${id}`, detail: gridGap });

    if (!seenIds.has(id)) {
      gaps.push({ code: 'CONTROL-UNDRAWN', target: `${part}.${id}`, detail: `no state draws data-et-control="${id}"` });
      continue;
    }

    for (const [requirement, detail] of disclosureGapsOf({ frames, id, control, states }))
      gaps.push({ code: 'REQUIREMENT-MISSING', target: `${part}.${id}.${requirement}`, detail });

    for (const interaction of interactions) {
      const gap = stillGapOf({ frames, id, interaction });

      if (gap) gaps.push({ code: 'CONTROL-TRANSITION-MISSING', target: `${part}.${id}.${interaction}`, detail: gap });
    }
  }

  return gaps;
};

export const completenessGapLineOf = (gap: CompletenessGap) => `${gap.code} ${gap.target} - ${gap.detail}`;

const NO_MOTION = '*, *::before, *::after { transition: none !important; animation: none !important; }';

const PAD = 8;

const COLOUR_PROPERTIES = [
  'background-color',
  'color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'box-shadow',
];

const COLOUR = COLOUR_PROPERTIES.indexOf('color');

const colourSnapshot = (at: number) => `((at) => {
  const control = document.querySelector('[data-et-complete="' + at + '"]');
  const motionOff = [...document.querySelectorAll('style')].find((style) => style.textContent === ${JSON.stringify(NO_MOTION)});
  const elements = [control, ...control.querySelectorAll('*')];
  const colours = elements.map((element) => {
    const style = getComputedStyle(element);
    return ${JSON.stringify(COLOUR_PROPERTIES)}.map((name) => {
      const side = name.match(/^border-(\\w+)-color$/);
      return side && parseFloat(style.getPropertyValue('border-' + side[1] + '-width')) === 0 ? '' : style.getPropertyValue(name);
    });
  });
  if (motionOff) motionOff.disabled = true;
  const transitions = elements.map((element) => {
    const style = getComputedStyle(element);
    return {
      properties: style.transitionProperty.split(',').map((name) => name.trim()),
      durations: style.transitionDuration.split(',').map((duration) => parseFloat(duration)),
    };
  });
  if (motionOff) motionOff.disabled = false;
  const parents = elements.map((element) => elements.indexOf(element.parentElement));
  const names = elements.map((element) => element.tagName.toLowerCase() + (element.classList[0] ? '.' + element.classList[0] : ''));
  return { colours, transitions, parents, names };
})(${JSON.stringify(at)})`;

type ColourSnapshot = {
  colours: string[][];
  transitions: { properties: string[]; durations: number[] }[];
  parents: number[];
  names: string[];
};

const coversOf = (property: string) => {
  if (property === 'background-color') return ['all', 'background', property];
  if (property.startsWith('border-'))
    return ['all', 'border', 'border-color', property.replace(/-color$/, ''), property];

  return ['all', property];
};

const stillChangesOf = (rest: ColourSnapshot, forced: ColourSnapshot) =>
  forced.names.flatMap((name, element) => {
    const { properties, durations } = forced.transitions[element] ?? { properties: [], durations: [] };
    const still = COLOUR_PROPERTIES.filter((property, at) => {
      const [before, after] = [rest.colours[element] ?? [], forced.colours[element] ?? []];

      if (before[at] === after[at]) return false;
      const parent = forced.parents[element] ?? -1;
      const inherited = parent >= 0 ? [rest.colours[parent]?.[at], forced.colours[parent]?.[at]] : [];

      if (property !== 'color' && before[at] === before[COLOUR] && after[at] === after[COLOUR]) return false;
      if (property === 'color' && before[at] === inherited[0] && after[at] === inherited[1]) return false;

      return !properties.some(
        (covered, index) => coversOf(property).includes(covered) && (durations[index % durations.length] ?? 0) > 0,
      );
    });

    return still.length > 0 ? [`${still.join(', ')} of ${name}`] : [];
  });

const seeFrame = `(() => {
  const root = document.getElementById('root');
  const refused = root.innerText.trim();
  if (refused.startsWith('design-explore:')) return { refused: refused.split('\\n')[0] };
  const shown = (element) => {
    const box = element.getBoundingClientRect();
    let { left, top, right, bottom } = box;
    if (box.width <= 0 || box.height <= 0) return false;
    if (['hidden', 'collapse'].includes(getComputedStyle(element).visibility)) return false;
    for (let at = element; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (Number(style.opacity) === 0) return false;
      if (at === element) continue;
      const clip = at.getBoundingClientRect();
      if (style.overflowX !== 'visible') [left, right] = [Math.max(left, clip.left), Math.min(right, clip.right)];
      if (style.overflowY !== 'visible') [top, bottom] = [Math.max(top, clip.top), Math.min(bottom, clip.bottom)];
      if (right <= left || bottom <= top) return false;
    }
    return element.innerText.trim() !== '' || !!element.querySelector('img, svg, canvas, video, iframe, input, select, textarea');
  };
  const controls = [...root.querySelectorAll('[data-et-control]')].map((element, at) => {
    element.setAttribute('data-et-complete', String(at));
    const box = element.getBoundingClientRect();
    const x = Math.max(0, box.x + scrollX - ${PAD});
    const y = Math.max(0, box.y + scrollY - ${PAD});
    return {
      id: element.getAttribute('data-et-control'),
      at,
      forced: (element.getAttribute('data-et-force') ?? '').split(' ').filter(Boolean),
      box: box.width > 0 && box.height > 0 ? { x, y, width: box.width + ${PAD * 2}, height: box.height + ${PAD * 2} } : null,
    };
  });
  const surfaces = [...root.querySelectorAll('[data-et-surface]')].map((element) => ({
    id: element.getAttribute('data-et-surface'),
    shown: shown(element),
  }));
  return { controls, surfaces };
})()`;

const forceOn = ({
  at,
  interaction,
  on,
}: {
  at: number;
  interaction: string;
  on: boolean;
}) => `((at, interaction, on) => {
  const element = document.querySelector('[data-et-complete="' + at + '"]');
  const tokens = new Set((element.getAttribute('data-et-force') ?? '').split(' ').filter(Boolean));
  if (on) tokens.add(interaction);
  else tokens.delete(interaction);
  if (tokens.size > 0) element.setAttribute('data-et-force', [...tokens].join(' '));
  else element.removeAttribute('data-et-force');
})(${JSON.stringify(at)}, ${JSON.stringify(interaction)}, ${JSON.stringify(on)})`;

type Seen =
  | { refused: string }
  | {
      controls: {
        id: string;
        at: number;
        forced: string[];
        box: { x: number; y: number; width: number; height: number } | null;
      }[];
      surfaces: { id: string; shown: boolean }[];
    };

type CompleteFrame = {
  state: string;
  interaction: string | null;
  search: string;
  size: { width: number; height?: number } | null;
};

const FORCEABLE = new Set(['hover', 'focus-visible', 'active']);

const seeFrames = async (options: { browser: Browser; base: string; frames: CompleteFrame[] }) => {
  const { browser, base, frames } = options;
  const context = await browser.newContext();
  const seen: SeenFrame[] = [];
  const refused: string[] = [];

  try {
    const page = await context.newPage();

    for (const frame of frames) {
      await page.setViewportSize(viewportOf(frame.size));
      await openFrame(page, `${base}/frame.html?${frame.search}`);
      await page.addStyleTag({ content: NO_MOTION });
      await page.evaluate(settled);

      const found = (await page.evaluate(seeFrame)) as Seen;

      if ('refused' in found) {
        refused.push(`${frame.state}: ${found.refused}`);
        continue;
      }

      const controls: SeenFrame['controls'] = [];

      for (const control of found.controls) {
        const forced: SeenFrame['controls'][number]['forced'] = [];

        for (const interaction of control.forced.filter((name) => FORCEABLE.has(name))) {
          if (!control.box) {
            forced.push({ interaction, differs: false });
            continue;
          }

          const shot = () =>
            page.screenshot({ type: 'png', fullPage: true, clip: control.box ?? undefined, animations: 'disabled' });
          const drawn = await shot();
          const drawnColours = (await page.evaluate(colourSnapshot(control.at))) as ColourSnapshot;

          await page.evaluate(forceOn({ at: control.at, interaction, on: false }));
          await page.evaluate(settled);

          const rest = await shot();
          const restColours = (await page.evaluate(colourSnapshot(control.at))) as ColourSnapshot;

          await page.evaluate(forceOn({ at: control.at, interaction, on: true }));
          forced.push({
            interaction,
            differs: !drawn.equals(rest),
            still: stillChangesOf(restColours, drawnColours),
          });
        }

        controls.push({ id: control.id, forced });
      }

      seen.push({ state: frame.state, interaction: frame.interaction, controls, surfaces: found.surfaces });
    }
  } finally {
    await context.close();
  }

  return { seen, refused };
};

type PartModule = {
  default?: { states?: unknown; interactions?: unknown; widths?: unknown; controls?: unknown; grid?: unknown };
};

/**
 * Draws every state of one part, at rest and in each interaction it declares, once at its first preset or width,
 * and answers the gaps of its `controls` declaration, or why it could not draw. A part a control names in `part`
 * is checked the same way, and its gaps fail the control.
 */
export const completenessOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  chromiumOf?: typeof chromiumOf;
}): Promise<{ gaps: CompletenessGap[] } | { unavailable: string } | { problem: string }> => {
  const { target, config, product, part } = options;
  const resolveChromium = options.chromiumOf ?? chromiumOf;

  if (!product.parts.some((candidate) => partKeyOf(candidate) === part))
    return { problem: `product "${product.name}" has no part "${part}"` };

  if (!(await resolveChromium(target)))
    return { unavailable: 'neither the checkout nor this package resolves playwright or playwright-core' };

  const queue = createDrawQueue({ target, chromiumOf: resolveChromium });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const system = createSystemModules({ target, config });
    const presets = Object.keys(system.drawnOf(product.name, null)?.presets ?? {});

    const gapsOfPart = async (key: string, chain: string[]): Promise<CompletenessGap[] | string> => {
      const resolved = product.parts.find((candidate) => partKeyOf(candidate) === key);

      if (!resolved) return `product "${product.name}" has no part "${key}"`;
      if (chain.includes(key)) return `its controls name each other in a cycle: ${[...chain, key].join(' > ')}`;

      const loaded = await server
        .ssrLoadModule(productModuleIdOf({ file: resolved.file, product: product.name, sketch: null }))
        .then((module) => ({ module: module as PartModule }))
        .catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));

      if ('error' in loaded) return [{ code: 'RENDER', target: key, detail: loaded.error.split('\n')[0] ?? '' }];

      const definition = loaded.module.default;
      const states = isRecord(definition?.states) ? Object.keys(definition.states) : [];
      const interactions = Array.isArray(definition?.interactions)
        ? definition.interactions.filter((name): name is string => INTERACTIONS.some((known) => known === name))
        : [];
      const widths = Array.isArray(definition?.widths)
        ? definition.widths.filter((width): width is number => typeof width === 'number')
        : [];
      const preset = resolved.layer === 'pages' ? (presets[0] ?? null) : null;
      const width = preset === null ? (widths[0] ?? null) : null;
      const frames: CompleteFrame[] = [];

      for (const state of states)
        for (const interaction of [null, ...interactions]) {
          const frame = partFrameOf({
            system,
            product: product.name,
            part: key,
            state,
            preset,
            width,
            sketch: null,
            interaction,
          });

          if (!(frame instanceof Error))
            frames.push({ state, interaction, search: frame.search.toString(), size: frame.size ?? null });
        }

      const { seen, refused } = await queue.run((browser) =>
        seeFrames({ browser, base: `http://localhost:${port}`, frames }),
      );
      const reviewed = readMerged(product.dir)[key] === partHashOf({ product, dir: dirname(resolved.file) });
      const referenced: ReferencedParts = {};

      for (const control of Object.values(declaredControlsOf(definition?.controls) ?? {}))
        if (control.part !== null && !(control.part in referenced))
          referenced[control.part] = await gapsOfPart(control.part, [...chain, key]);

      return [
        ...refused.map((detail) => ({ code: 'RENDER', target: key, detail })),
        ...completenessGapsOf({
          part: key,
          controls: definition?.controls,
          states,
          frames: seen,
          reviewed,
          grid: definition?.grid,
          referenced,
        }),
      ];
    };

    const gaps = await gapsOfPart(part, []);

    return typeof gaps === 'string' ? { problem: gaps } : { gaps };
  } catch (error) {
    if (error instanceof ThumbUnavailableError) return { unavailable: error.message };

    throw error;
  } finally {
    await Promise.all([queue.close(), server.close()]);
  }
};
