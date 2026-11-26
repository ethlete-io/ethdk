import { InjectionToken } from '@angular/core';
import { DEFAULT_KBD_LABELS, KbdKeyRendering, KbdLabels } from './kbd-labels';

export type KbdPlatform = 'apple' | 'other';

const KBD_KEY_ALIASES: Record<string, string> = {
  cmd: 'meta',
  command: 'meta',
  control: 'ctrl',
  option: 'alt',
  return: 'enter',
  escape: 'esc',
  del: 'delete',
  spacebar: 'space',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  pgup: 'pageup',
  pgdn: 'pagedown',
  plus: '+',
};

/**
 * Whether the current environment uses Apple's modifier glyphs. Returns `'other'` where there is no
 * `navigator`, so a server render and a non-Apple client agree.
 */
export const detectKbdPlatform = (): KbdPlatform => {
  if (typeof navigator === 'undefined') return 'other';

  // `platform` is deprecated but still the most reliable Apple signal; the UA string is the fallback.
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent) ? 'apple' : 'other';
};

/**
 * The platform whose key glyphs `et-kbd` renders. Defaults to detecting Apple platforms from the
 * browser; provide it to pin the rendering (useful for a server render or a visual test).
 */
export const KBD_PLATFORM = new InjectionToken<KbdPlatform>('KBD_PLATFORM', {
  providedIn: 'root',
  factory: detectKbdPlatform,
});

/**
 * The canonical name of a key, with spelling aliases resolved - `cmd` and `command` both give
 * `meta`, `escape` gives `esc`. An unknown key is returned lowercased and trimmed.
 */
export const canonicalKbdKey = (key: string) => {
  const normalized = key.trim().toLowerCase();

  return KBD_KEY_ALIASES[normalized] ?? normalized;
};

/** The platform to render for, or the platform plus a localized label set (see `provideKbdLabels`). */
export type KbdKeyContext = KbdPlatform | { platform: KbdPlatform; labels?: KbdLabels };

const resolveKey = (key: string, context: KbdKeyContext): KbdKeyRendering => {
  const { platform, labels = DEFAULT_KBD_LABELS } = typeof context === 'string' ? { platform: context } : context;
  const trimmed = key.trim();
  const canonical = canonicalKbdKey(trimmed);
  const labelKey = canonical === '+' ? 'plus' : canonical;
  const spec = Object.hasOwn(labels, labelKey) ? labels[labelKey as keyof KbdLabels] : undefined;

  if (spec) return spec[platform];

  const label = trimmed.length === 1 ? trimmed.toUpperCase() : trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  return { label, name: label };
};

/**
 * Splits a chord such as `mod+shift+k` into its keys. Whitespace around a key is ignored. The literal
 * `+` key is spelled `plus`, or written as a `+` standing alone in a key's place: `+`, `mod++`,
 * `mod+++shift`. Any other empty segment is dropped, so `mod++k` is `mod+k`.
 */
export const parseKbdKeys = (keys: string): string[] => {
  const segments = keys.split('+').map((key) => key.trim());
  const parsed: string[] = [];

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index] ?? '';

    if (segment) {
      parsed.push(segment);
    } else if (segments[index + 1] === '') {
      parsed.push('+');
      index++;
    }
  }

  return parsed;
};

/** The glyph or word printed on a key for the given platform, e.g. `mod` → `⌘` on Apple, `Ctrl` elsewhere. */
export const kbdKeyLabel = (key: string, context: KbdKeyContext) => resolveKey(key, context).label;

/** The spoken name of a key, for the text a screen reader reads in place of the glyph. */
export const kbdKeyName = (key: string, context: KbdKeyContext) => resolveKey(key, context).name;
