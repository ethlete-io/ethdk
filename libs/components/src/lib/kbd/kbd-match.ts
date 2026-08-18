import { KbdPlatform, canonicalKbdKey, parseKbdKeys } from './kbd-keys';

/** The `event.key` a named key reports. Keys absent here are matched as written. */
const KEY_EVENT_NAMES: Record<string, string> = {
  esc: 'Escape',
  enter: 'Enter',
  tab: 'Tab',
  space: ' ',
  backspace: 'Backspace',
  delete: 'Delete',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
};

type ChordModifiers = {
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
};

type ParsedChord = {
  modifiers: ChordModifiers;
  key: string | null;
};

const parseChord = (keys: string, platform: KbdPlatform): ParsedChord => {
  const modifiers: ChordModifiers = { meta: false, ctrl: false, alt: false, shift: false };
  let key: string | null = null;

  for (const raw of parseKbdKeys(keys)) {
    const canonical = canonicalKbdKey(raw);

    if (canonical === 'mod') {
      if (platform === 'apple') {
        modifiers.meta = true;
      } else {
        modifiers.ctrl = true;
      }
    } else if (canonical === 'meta' || canonical === 'ctrl' || canonical === 'alt' || canonical === 'shift') {
      modifiers[canonical] = true;
    } else {
      key = canonical;
    }
  }

  return { modifiers, key };
};

const matchesEventKey = (event: KeyboardEvent, canonical: string) => {
  const named = KEY_EVENT_NAMES[canonical];

  if (named) {
    return event.key === named;
  }

  // A single letter or digit is matched on `event.code`, the physical key, before `event.key`: on
  // macOS, Option rewrites `key` to the layout's alternate glyph (Option+K is "˚" on a US layout),
  // so an `alt` chord would never fire on a `key` test alone.
  if (canonical.length === 1) {
    if (canonical >= 'a' && canonical <= 'z') {
      return event.code === `Key${canonical.toUpperCase()}` || event.key.toLowerCase() === canonical;
    }

    if (canonical >= '0' && canonical <= '9') {
      return event.code === `Digit${canonical}` || event.key === canonical;
    }
  }

  return event.key.toLowerCase() === canonical;
};

export type MatchesKbdChordOptions = {
  /** The chord, in the same syntax `et-kbd` prints. */
  keys: string;
  /** Which platform `mod` means Command on. Read it from `KBD_PLATFORM`. */
  platform: KbdPlatform;
};

/**
 * Whether a keydown event is the chord written in `et-kbd`'s syntax - `mod+k`, `shift+alt+up`. The
 * modifiers must match exactly, so `mod+k` does not fire on `Ctrl+Shift+K`, and `mod` resolves to
 * Command on Apple platforms and Control everywhere else.
 *
 * A chord of modifiers alone never matches; it needs one real key.
 *
 * @example
 * matchesKbdChord(event, { keys: 'mod+k', platform: inject(KBD_PLATFORM) });
 */
export const matchesKbdChord = (event: KeyboardEvent, options: MatchesKbdChordOptions) => {
  const { modifiers, key } = parseChord(options.keys, options.platform);

  if (!key) {
    return false;
  }

  if (event.metaKey !== modifiers.meta) return false;
  if (event.ctrlKey !== modifiers.ctrl) return false;
  if (event.altKey !== modifiers.alt) return false;

  // Punctuation is often typed *with* Shift - `?` is Shift+/ on a US layout - so for those keys Shift
  // held without being written is allowed. Everywhere else it is a modifier like any other, and
  // `mod+k` must not fire on Cmd+Shift+K.
  const shiftMayTypeTheKey = key.length === 1 && !(key >= 'a' && key <= 'z') && !(key >= '0' && key <= '9');

  if (shiftMayTypeTheKey ? modifiers.shift && !event.shiftKey : event.shiftKey !== modifiers.shift) {
    return false;
  }

  return matchesEventKey(event, key);
};
