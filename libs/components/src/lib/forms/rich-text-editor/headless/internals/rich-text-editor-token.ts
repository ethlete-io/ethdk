import { RuntimeError } from '@ethlete/core';
import { isObservable, Observable, take } from 'rxjs';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../../rich-text-editor-errors';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from '../../rich-text-editor-trigger';
import { EditorRenderer } from './rich-text-editor-dom-core';

/** CSS class + attributes that mark an atomic token chip inside the contenteditable. */
export const TOKEN_CHIP_CLASS = 'et-rte-token';
export const TOKEN_CHIP_ATTR = 'data-et-token';
export const TOKEN_TYPE_ATTR = 'data-token-type';
export const TOKEN_ID_ATTR = 'data-token-id';
/** Inner spans of a chip: the (de-emphasized) trigger char and the resolved label. */
export const TOKEN_PREFIX_CLASS = 'et-rte-token-prefix';
export const TOKEN_LABEL_CLASS = 'et-rte-token-label';

/** A token `type` must be a lowercase, Markdown-inert slug. */
export const TOKEN_TYPE_RE = /^[a-z][a-z0-9-]*$/;
/** A token `id` must stay within a Markdown-inert subset so `{{type:id}}` round-trips untouched. */
export const TOKEN_ID_RE = /^[A-Za-z0-9._:-]+$/;

/** Matches a serialized token in the Markdown value / rendered HTML. */
const TOKEN_MARKDOWN_RE = /\{\{([a-z][a-z0-9-]*):([A-Za-z0-9._:-]+)\}\}/g;

/** The type, id and label needed to render a token chip, plus the optional trigger char to show. */
export type RichTextEditorTokenChip = { type: string; id: string; label: string; prefix?: string };

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The Markdown/text form of a token — inert to `markdownToHtml`/`htmlToMarkdown`. */
export const tokenMarkdown = (type: string, id: string) => `{{${type}:${id}}}`;

/** Builds the chip HTML string used when rendering a stored value into the editor. */
export const buildChipHtml = ({ type, id, label, prefix }: RichTextEditorTokenChip) =>
  `<span class="${TOKEN_CHIP_CLASS}" ${TOKEN_CHIP_ATTR} ${TOKEN_TYPE_ATTR}="${escapeHtml(type)}" ` +
  `${TOKEN_ID_ATTR}="${escapeHtml(id)}" contenteditable="false">` +
  (prefix ? `<span class="${TOKEN_PREFIX_CLASS}">${escapeHtml(prefix)}</span>` : '') +
  `<span class="${TOKEN_LABEL_CLASS}">${escapeHtml(label)}</span></span>`;

/**
 * Builds a live chip element (the DOM counterpart of {@link buildChipHtml}) for insertion into the
 * contenteditable. Kept as one shared builder so the trigger popup and the public insert API produce
 * byte-identical chips — the class/attr contract, prefix span and label span must match what
 * {@link buildChipHtml} serializes, or `serialize`/`render` would round-trip inconsistently.
 */
export const buildChipElement = (
  renderer: EditorRenderer,
  { type, id, label, prefix }: RichTextEditorTokenChip,
): HTMLElement => {
  const chip = renderer.createElement('span') as HTMLElement;

  renderer.addClass(chip, TOKEN_CHIP_CLASS);
  renderer.setAttribute(chip, TOKEN_CHIP_ATTR, '');
  renderer.setAttribute(chip, TOKEN_TYPE_ATTR, type);
  renderer.setAttribute(chip, TOKEN_ID_ATTR, id);
  renderer.setAttribute(chip, 'contenteditable', 'false');

  // keep the trigger char (e.g. `@`, `#`) visible ahead of the label, matching `buildChipHtml`
  if (prefix) {
    const prefixEl = renderer.createElement('span') as HTMLElement;

    renderer.addClass(prefixEl, TOKEN_PREFIX_CLASS);
    renderer.appendChild(prefixEl, renderer.createText(prefix));
    renderer.appendChild(chip, prefixEl);
  }

  const labelEl = renderer.createElement('span') as HTMLElement;

  renderer.addClass(labelEl, TOKEN_LABEL_CLASS);
  renderer.appendChild(labelEl, renderer.createText(label));
  renderer.appendChild(chip, labelEl);

  return chip;
};

/**
 * Validates a token `type`/`id` against the Markdown-inert grammar the `{{type:id}}` codec relies on,
 * throwing a {@link RuntimeError} otherwise. Called (dev-only) before building a chip so an invalid
 * token fails loudly at the insert site instead of silently corrupting the serialized value.
 */
export const assertValidToken = (type: string, id: string) => {
  if (!TOKEN_TYPE_RE.test(type)) {
    throw new RuntimeError(
      RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TOKEN_TYPE,
      `Invalid rich text editor token type "${type}". Types must match ${TOKEN_TYPE_RE}.`,
    );
  }

  if (!TOKEN_ID_RE.test(id)) {
    throw new RuntimeError(
      RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TOKEN_ID,
      `Invalid rich text editor token id "${id}" for type "${type}". Ids must match ${TOKEN_ID_RE} so the {{type:id}} token round-trips through Markdown.`,
    );
  }
};

const isPromiseLike = <T>(value: unknown): value is Promise<T> =>
  !!value && typeof (value as Promise<T>).then === 'function';

/**
 * Bridges token chips and their serialized `{{type:id}}` Markdown form. The
 * {@link RichTextEditorTokenCodec.serialize} direction reconstructs the token purely from the
 * chip's `type`/`id` data attributes (never the visible label), so `serialize(render(md))`
 * is byte-stable regardless of the resolved label — the base editor relies on this to avoid
 * re-rendering (and resetting the caret) on every keystroke.
 */
export type RichTextEditorTokenCodec = {
  /** In-place: replaces every `[data-et-token]` chip in `root` with a `{{type:id}}` text node. */
  serialize: (root: HTMLElement) => void;
  /** Replaces every `{{type:id}}` in `html` with chip HTML, resolving labels synchronously. */
  render: (html: string) => string;
  /** Asynchronously resolves chip labels in `root` and patches them in place. */
  hydrate: (root: HTMLElement) => void;
  /**
   * Resolves a `type`/`id` to the chip descriptor (label + trigger-char prefix) needed to build a
   * chip element for a programmatic insert. The label resolves synchronously (falling back to the
   * raw id); async resolvers are patched afterwards by {@link hydrate}. Powers the editor's public
   * `insertToken` API.
   */
  resolveChip: (type: string, id: string) => RichTextEditorTokenChip;
};

export const createRichTextEditorTokenCodec = (
  triggers: () => readonly RichTextEditorTrigger[],
): RichTextEditorTokenCodec => {
  const triggerFor = (type: string) => triggers().find((trigger) => trigger.type === type) ?? null;

  const resolveSyncLabel = (type: string, id: string): string | null => {
    const resolver = triggerFor(type)?.resolveItem;

    if (!resolver) return null;

    const resolved = resolver(id);

    if (isPromiseLike<RichTextEditorTriggerItem | null>(resolved) || isObservable(resolved)) {
      return null;
    }

    return resolved?.label ?? null;
  };

  const serialize = (root: HTMLElement) => {
    // eslint-disable-next-line ethlete/no-dom-query -- atomic chips carry no unique hook other than the marker attribute
    root.querySelectorAll(`[${TOKEN_CHIP_ATTR}]`).forEach((chip) => {
      const type = chip.getAttribute(TOKEN_TYPE_ATTR);
      const id = chip.getAttribute(TOKEN_ID_ATTR);

      if (!type || !id) return;

      // `replaceWith(string)` inserts a plain text node — no manual DOM node creation needed.
      chip.replaceWith(tokenMarkdown(type, id));
    });
  };

  const render = (html: string) =>
    html.replace(TOKEN_MARKDOWN_RE, (_match, ...groups: string[]) => {
      const [type = '', id = ''] = groups;

      return buildChipHtml({ type, id, label: resolveSyncLabel(type, id) ?? id, prefix: triggerFor(type)?.char ?? '' });
    });

  const hydrate = (root: HTMLElement) => {
    // eslint-disable-next-line ethlete/no-dom-query -- same marker-attribute lookup as serialize
    root.querySelectorAll<HTMLElement>(`[${TOKEN_CHIP_ATTR}]`).forEach((chip) => {
      const type = chip.getAttribute(TOKEN_TYPE_ATTR);
      const id = chip.getAttribute(TOKEN_ID_ATTR);
      const resolver = type ? triggerFor(type)?.resolveItem : null;

      if (!type || !id || !resolver) return;

      const resolved = resolver(id);
      const apply = (item: RichTextEditorTriggerItem | null) => {
        if (!item || !chip.isConnected) return;

        // Patch only the label span so the trigger-char prefix stays intact.
        // eslint-disable-next-line ethlete/no-dom-query -- structured chip, label span has no other hook
        const labelEl = chip.querySelector<HTMLElement>(`.${TOKEN_LABEL_CLASS}`);

        if (labelEl) labelEl.textContent = item.label;
        else chip.textContent = item.label;
      };

      if (isPromiseLike<RichTextEditorTriggerItem | null>(resolved)) {
        void resolved.then(apply);
      } else if (isObservable(resolved)) {
        (resolved as Observable<RichTextEditorTriggerItem | null>).pipe(take(1)).subscribe(apply);
      } else {
        apply(resolved);
      }
    });
  };

  const resolveChip = (type: string, id: string): RichTextEditorTokenChip => ({
    type,
    id,
    label: resolveSyncLabel(type, id) ?? id,
    prefix: triggerFor(type)?.char ?? '',
  });

  return { serialize, render, hydrate, resolveChip };
};
