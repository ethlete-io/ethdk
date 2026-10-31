import { computed, signal, untracked } from '@angular/core';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';

/** What the user looks at in Studio. Every field is `null` when the view has none. */
export type ViewContext = {
  product: string | null;
  part: string | null;
  sketch: string | null;
  /** The sketch's directory, relative to the checkout. */
  sketchDir: string | null;
  variant: string | null;
  /** The frame or state clicked on the canvas. */
  selection: string | null;
};

/** The view writing the fields: the system view, or the sketch view inside it, whose fields win. */
export type ViewContextOwner = 'system' | 'sketch';

const FIELDS = ['product', 'part', 'sketch', 'sketchDir', 'variant', 'selection'] as const;

const isEmpty = (context: ViewContext) => FIELDS.every((field) => context[field] === null);

/** The canvas frame `id` points at, as its column, row and label, or `null` without one. */
export const selectionOf = (frames: readonly CanvasFrame[], id: string | null | undefined) => {
  const frame = id ? frames.find((candidate) => candidate.id === id) : undefined;

  if (!frame) return null;

  const names = [frame.column, frame.rowLabel ?? frame.row, frame.label].map((name) => name?.trim() ?? '');

  return [...new Set(names.filter((name) => name !== ''))].join(' ');
};

/** The chip line: `Kit › components/button › sketch · variant b · frame hover`. */
export const chipOf = (context: ViewContext) => {
  const path = [context.product, context.part, context.sketch !== null ? 'sketch' : null].filter(
    (item) => item !== null,
  );
  const rest = [
    context.variant !== null ? `variant ${context.variant}` : null,
    context.selection !== null ? `frame ${context.selection}` : null,
  ].filter((item) => item !== null);

  return [path.join(' › '), ...rest].filter((item) => item !== '').join(' · ');
};

/** The line put in front of a prompt so the agent knows what the user looks at. */
export const preambleOf = (context: ViewContext) => {
  const items = [
    context.product !== null ? `product ${context.product}` : null,
    context.part !== null ? `part ${context.part}` : null,
    context.sketch !== null
      ? `sketch ${context.sketch}${context.sketchDir !== null ? ` (dir ${context.sketchDir})` : ''}`
      : null,
    context.variant !== null ? `variant ${context.variant}` : null,
    context.selection !== null ? `selected frame ${context.selection}` : null,
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
