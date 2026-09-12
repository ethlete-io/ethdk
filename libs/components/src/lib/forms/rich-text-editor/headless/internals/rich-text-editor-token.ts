import { RuntimeError } from '@ethlete/core';
import { isObservable, Observable, take } from 'rxjs';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../../rich-text-editor-errors';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from '../../rich-text-editor-trigger';
import { EditorRenderer } from './rich-text-editor-dom-core';

export const TOKEN_CHIP_CLASS = 'et-rte-token';
export const TOKEN_CHIP_ATTR = 'data-et-token';
export const TOKEN_TYPE_ATTR = 'data-token-type';
export const TOKEN_ID_ATTR = 'data-token-id';
export const TOKEN_PREFIX_CLASS = 'et-rte-token-prefix';
export const TOKEN_LABEL_CLASS = 'et-rte-token-label';

export const TOKEN_TYPE_RE = /^[a-z][a-z0-9-]*$/;
/** Widening this breaks the round trip: an id must stay Markdown-inert so `{{type:id}}` survives it untouched. */
export const TOKEN_ID_RE = /^[A-Za-z0-9._:-]+$/;

const TOKEN_MARKDOWN_RE = /\{\{([a-z][a-z0-9-]*):([A-Za-z0-9._:-]+)\}\}/g;

export type RichTextEditorTokenChip = { type: string; id: string; label: string; prefix?: string };

/** @internal */
export const escapeHtmlText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const tokenMarkdown = (type: string, id: string) => `{{${type}:${id}}}`;

export const buildChipHtml = ({ type, id, label, prefix }: RichTextEditorTokenChip) =>
  `<span class="${TOKEN_CHIP_CLASS}" ${TOKEN_CHIP_ATTR} ${TOKEN_TYPE_ATTR}="${escapeHtmlText(type)}" ` +
  `${TOKEN_ID_ATTR}="${escapeHtmlText(id)}" contenteditable="false">` +
  (prefix ? `<span class="${TOKEN_PREFIX_CLASS}">${escapeHtmlText(prefix)}</span>` : '') +
  `<span class="${TOKEN_LABEL_CLASS}">${escapeHtmlText(label)}</span></span>`;

/**
 * The class/attr contract, prefix span and label span must stay identical to what
 * {@link buildChipHtml} serializes, or `serialize`/`render` round-trip inconsistently.
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
 * `serialize` must reconstruct a token purely from the chip's `type`/`id` attributes, never the
 * visible label: the editor relies on `serialize(render(md))` being byte-stable regardless of the
 * resolved label to avoid re-rendering - and resetting the caret - on every keystroke.
 */
export type RichTextEditorTokenCodec = {
  serialize: (root: HTMLElement) => void;
  render: (html: string) => string;
  hydrate: (root: HTMLElement) => void;
  resolveChip: (type: string, id: string) => RichTextEditorTokenChip;
  parseTokenText: (text: string) => string;
};

export const createRichTextEditorTokenCodec = (
  triggers: () => readonly RichTextEditorTrigger[],
): RichTextEditorTokenCodec => {
  const triggerFor = (type: string) => triggers().find((trigger) => trigger.type === type) ?? null;

  const resolveSyncLabel = (type: string, id: string): string | null => {
    const trigger = triggerFor(type);

    if (!trigger) return null;

    const resolved = trigger.resolveItem?.(id);

    if (resolved && !isPromiseLike<RichTextEditorTriggerItem | null>(resolved) && !isObservable(resolved)) {
      return resolved.label;
    }

    if (!Array.isArray(trigger.items)) return null;

    return trigger.items.find((item) => item.id === id)?.label ?? null;
  };

  const serialize = (root: HTMLElement) => {
    // eslint-disable-next-line ethlete/no-dom-query -- atomic chips carry no unique hook other than the marker attribute
    root.querySelectorAll(`[${TOKEN_CHIP_ATTR}]`).forEach((chip) => {
      const type = chip.getAttribute(TOKEN_TYPE_ATTR);
      const id = chip.getAttribute(TOKEN_ID_ATTR);

      if (!type || !id) return;

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

  const parseTokenText = (text: string) => {
    let out = text;

    for (const trigger of triggers()) {
      const items = Array.isArray(trigger.items) ? trigger.items : null;

      if (!items?.length) continue;

      const byText = new Map<string, string>();

      for (const item of items) {
        if (item.disabled) continue;

        for (const candidate of [item.label, item.id]) {
          const key = candidate?.trim().toLowerCase();

          if (key && !byText.has(key)) byText.set(key, item.id);
        }
      }

      if (byText.size === 0) continue;

      // Longest first, so `#User Name` wins over an item merely labelled `User`.
      const alternatives = [...byText.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
      const pattern = new RegExp(`(^|[^\\w])${escapeRegExp(trigger.char)}(${alternatives.join('|')})(?!\\w)`, 'gi');

      out = out.replace(pattern, (match, ...groups: string[]) => {
        const [before = '', matched = ''] = groups;
        const id = byText.get(matched.toLowerCase());

        return id ? `${before}${tokenMarkdown(trigger.type, id)}` : match;
      });
    }

    return out;
  };

  return { serialize, render, hydrate, resolveChip, parseTokenText };
};
