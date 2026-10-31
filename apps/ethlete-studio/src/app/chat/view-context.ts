import { computed, signal, untracked } from '@angular/core';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';

/** What the user looks at in Studio. Every field is `null` when the view has none. */
export type ViewContext = {
  product: string | null;
  part: string | null;
  /** The part's module file, relative to the checkout. */
  partFile: string | null;
  sketch: string | null;
  /** The sketch's directory, relative to the checkout. */
  sketchDir: string | null;
  /** The variant the user looks at. */
  variant: string | null;
  /** The variant picked as the sketch's decision. */
  picked: string | null;
  /** The frame clicked on the canvas. */
  selection: string | null;
  /** The state of the grid cell clicked on the canvas, with its interaction when it has one. */
  state: string | null;
};

/** The view writing the fields: the system view, or the sketch view inside it, whose fields win. */
export type ViewContextOwner = 'system' | 'sketch';

const FIELDS = [
  'product',
  'part',
  'partFile',
  'sketch',
  'sketchDir',
  'variant',
  'picked',
  'selection',
  'state',
] as const;

const isEmpty = (context: ViewContext) => FIELDS.every((field) => context[field] === null);

const SIZE_UNNAMED = 'fitted';

const sizeNameOf = (size: string | number) => (typeof size === 'number' ? `${size} px` : size);

const withoutContained = (names: string[]) => {
  const unique = [...new Set(names)];

  return unique.filter((name) => !unique.some((other) => other !== name && other.includes(name)));
};

/**
 * The canvas frame `id` points at, or `null` without one. A frame of a matrix reads `part · size (state)`, with
 * `context` for the state of a page that shows the part; any other frame joins its column, row and label.
 */
export const selectionOf = (frames: readonly CanvasFrame[], id: string | null | undefined) => {
  const frame = id ? frames.find((candidate) => candidate.id === id) : undefined;

  if (!frame) return null;

  const { place } = frame;

  if (place && frame.column !== undefined) {
    const inContext = frame.column.startsWith('in context');
    const where = [place.part, place.size === SIZE_UNNAMED ? '' : sizeNameOf(place.size)].filter((name) => name !== '');
    const what = inContext ? 'context' : [place.state, place.interaction].filter(Boolean).join(' · ');

    return `${where.join(' · ')}${what === '' ? '' : ` (${what})`}`;
  }

  const names = [frame.column, frame.rowLabel ?? frame.row, frame.label].map((name) => name?.trim() ?? '');

  return withoutContained(names.filter((name) => name !== '')).join(' ');
};

/** The state of the cell `cellId` in the grid frame `id`, with its interaction unless it is `rest`; `null` without one. */
export const stateOf = (frames: readonly CanvasFrame[], selected: { id?: string | null; cellId?: string | null }) => {
  const { id, cellId } = selected;
  const cell =
    id && cellId
      ? frames.find((frame) => frame.id === id)?.grid?.cells.find((entry) => entry.id === cellId)
      : undefined;

  if (!cell) return null;

  const state = cell.place?.state ?? cell.label;
  const interaction = cell.place?.interaction;

  return interaction ? `${state} · ${interaction}` : state;
};

const variantOfFrame = (frame: CanvasFrame, variants: readonly string[]) => {
  const variant = frame.place?.sketch?.variant ?? frame.column;

  return variant !== undefined && variants.includes(variant) ? variant : null;
};

/**
 * The variant the user looks at: the selected frame's, else the one whose frames fill most of the viewport,
 * else the only one, else `null`.
 */
export const lookedAtVariantOf = (options: {
  frames: readonly CanvasFrame[];
  selectedId: string | null;
  areasInView: ReadonlyMap<string, number>;
  variants: readonly string[];
}) => {
  const { frames, selectedId, areasInView, variants } = options;
  const byId = new Map(frames.map((frame) => [frame.id, frame]));
  const selected = selectedId === null ? undefined : byId.get(selectedId);

  if (selected) return variantOfFrame(selected, variants);

  const shown = new Map<string, number>();

  for (const [id, area] of areasInView) {
    const frame = byId.get(id);
    const variant = frame ? variantOfFrame(frame, variants) : null;

    if (variant !== null) shown.set(variant, (shown.get(variant) ?? 0) + area);
  }

  const [most] = [...shown].sort(([, a], [, b]) => b - a);

  return most?.[0] ?? (variants.length === 1 ? (variants[0] ?? null) : null);
};

const pickedOf = (context: ViewContext) =>
  context.picked !== null && context.picked !== context.variant ? `picked ${context.picked}` : null;

const framePartOf = (context: ViewContext) => {
  const { selection, part } = context;

  if (selection === null) return null;
  if (part !== null && (selection === part || selection.startsWith(`${part} ·`) || selection.startsWith(`${part} (`)))
    return null;

  return selection;
};

/** The chip line: `Kit › components/button › sketch · variant b · frame hover`. */
export const chipOf = (context: ViewContext) => {
  const path = [context.product, context.part, context.sketch !== null ? 'sketch' : null].filter(
    (item) => item !== null,
  );
  const rest = [
    context.variant !== null ? `variant ${context.variant}` : null,
    pickedOf(context),
    framePartOf(context) !== null ? `frame ${framePartOf(context)}` : null,
    context.state !== null ? `state ${context.state}` : null,
  ].filter((item) => item !== null);

  return [path.join(' › '), ...rest].filter((item) => item !== '').join(' · ');
};

/** The line put in front of a prompt so the agent knows what the user looks at. */
export const preambleOf = (context: ViewContext) => {
  const items = [
    context.product !== null ? `product ${context.product}` : null,
    context.part !== null
      ? `part ${context.part}${context.partFile !== null ? ` (file ${context.partFile})` : ''}`
      : null,
    context.sketch !== null
      ? `sketch ${context.sketch}${context.sketchDir !== null ? ` (dir ${context.sketchDir})` : ''}`
      : null,
    context.variant !== null ? `variant ${context.variant}` : null,
    pickedOf(context),
    framePartOf(context) !== null ? `selected frame ${framePartOf(context)}` : null,
    context.state !== null ? `selected state ${context.state}` : null,
  ].filter((item) => item !== null);

  return `Studio view: ${items.join(', ')}.`;
};

const sameContext = (a: Partial<ViewContext> | undefined, b: Partial<ViewContext>) =>
  FIELDS.every((field) => (a?.[field] ?? null) === (b[field] ?? null));

const VIEW_CONTEXT_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const sources = signal<Partial<Record<ViewContextOwner, Partial<ViewContext>>>>({});
  const removed = signal(false);

  const context = computed<ViewContext>(() => {
    const { system, sketch } = sources();

    return Object.fromEntries(
      FIELDS.map((field) => [field, sketch?.[field] ?? system?.[field] ?? null]),
    ) as ViewContext;
  });

  const shown = computed(() => {
    const current = context();

    return removed() || isEmpty(current) ? null : current;
  });

  const write = (owner: ViewContextOwner, fields: Partial<ViewContext> | null) =>
    untracked(() => {
      const previous = sources()[owner];

      if (fields === null ? previous === undefined : sameContext(previous, fields)) return;

      sources.update((all) => {
        const next = { ...all };

        if (fields === null) delete next[owner];
        else next[owner] = fields;

        return next;
      });
      removed.set(false);
    });

  return {
    /** The view as it is now, removed or not. */
    context,
    /** The context the next message carries, or `null` when it is empty or the user removed it. */
    shown,
    /** Sets the fields one view owns. A change brings a removed context back. */
    put: (owner: ViewContextOwner, fields: Partial<ViewContext>) => write(owner, fields),
    /** Drops the fields of a view that is gone. */
    drop: (owner: ViewContextOwner) => write(owner, null),
    /** Leaves the context out of the next message, until the view changes or a message is sent. */
    remove: () => removed.set(true),
    /** Brings a removed context back once a message went out. */
    sent: () => removed.set(false),
  };
});

/** What the user looks at in Studio, carried by every chat message. */
export const injectViewContext = /* @__PURE__ */ toInjectFn(VIEW_CONTEXT_DEF);
