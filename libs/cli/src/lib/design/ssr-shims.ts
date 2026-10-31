type ParsedStyles = { property: Record<string, string>; priority: Record<string, string> };

type DominoStyle = {
  _parsed: ParsedStyles;
  _serialize: () => void;
  cssText: string | null;
};

type StyleMethod = (this: DominoStyle, ...args: unknown[]) => unknown;

const CUSTOM_PROPERTY_NAME = /(?:^|;)\s*(--[^:;\s]+)\s*:/g;
const IMPORTANT = /\s*!\s*important$/i;

const isCustom = (property: string) => property.startsWith('--');

const foldedName = (name: string) => name.replace(/[a-z][A-Z]/g, (pair) => `${pair[0]}-${pair[1]}`).toLowerCase();

const renameKeys = (record: Record<string, string>, names: Map<string, string>) =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [names.get(key) ?? key, value]));

const removeCustom = (style: DominoStyle, property: string) => {
  const styles = style._parsed;

  if (!(property in styles.property)) return;

  delete styles.property[property];
  delete styles.priority[property];
  style._serialize();
};

// Domino defines every CSSStyleDeclaration member non-configurable on its prototype, so the
// case-keeping members go on each instance instead.
const keepCaseOn = (style: DominoStyle) => {
  const proto = Object.getPrototypeOf(style) as object;
  const descriptors = Object.getOwnPropertyDescriptors(proto);
  const parsed = descriptors['_parsed']?.get as ((this: DominoStyle) => ParsedStyles) | undefined;
  const method = (name: string) => descriptors[name]?.value as StyleMethod;

  if (!parsed || Object.getOwnPropertyDescriptor(style, '_parsed')) return style;

  const getPropertyValue = method('getPropertyValue');
  const getPropertyPriority = method('getPropertyPriority');
  const setProperty = method('setProperty');
  const removeProperty = method('removeProperty');

  Object.defineProperties(style, {
    _parsed: {
      configurable: true,
      get(this: DominoStyle) {
        const styles = parsed.call(this);
        const names = new Map<string, string>();

        for (const match of (this.cssText ?? '').matchAll(CUSTOM_PROPERTY_NAME)) {
          const name = match[1] ?? '';

          if (foldedName(name) !== name) names.set(foldedName(name), name);
        }

        if ([...names.keys()].some((key) => key in styles.property)) {
          styles.property = renameKeys(styles.property, names);
          styles.priority = renameKeys(styles.priority, names);
        }

        return styles;
      },
    },
    getPropertyValue: {
      value(this: DominoStyle, property: string) {
        return isCustom(property) ? (this._parsed.property[property] ?? '') : getPropertyValue.call(this, property);
      },
    },
    getPropertyPriority: {
      value(this: DominoStyle, property: string) {
        return isCustom(property) ? (this._parsed.priority[property] ?? '') : getPropertyPriority.call(this, property);
      },
    },
    setProperty: {
      // eslint-disable-next-line max-params -- the arity of CSSStyleDeclaration.setProperty
      value(this: DominoStyle, property: string, value?: unknown, priority?: string) {
        if (!isCustom(property)) return setProperty.call(this, property, value, priority);

        const text = String(value ?? '').trim();

        if (text === '') return removeCustom(this, property);
        if (priority && !/^important$/i.test(priority)) return undefined;

        const styles = this._parsed;

        styles.property[property] = text.replace(IMPORTANT, '');

        if (priority || IMPORTANT.test(text)) styles.priority[property] = 'important';
        else delete styles.priority[property];

        this._serialize();

        return undefined;
      },
    },
    removeProperty: {
      value(this: DominoStyle, property: string) {
        return isCustom(property) ? removeCustom(this, property) : removeProperty.call(this, property);
      },
    },
  });

  return style;
};

/**
 * Domino lowercases and hyphenates every property name its `CSSStyleDeclaration` parses or sets,
 * so `--accentDeep` serialises as `--accentdeep`. Custom properties are case-sensitive; this
 * makes the `style` of every element created from `elementProto` keep their case.
 */
export const keepCustomPropertyCase = (elementProto: object) => {
  if (Object.getOwnPropertyDescriptor(elementProto, '_style')) return;

  const styles = new WeakMap<object, DominoStyle>();

  // Domino caches each element's declaration in `this._style`; an accessor here sees it created.
  Object.defineProperty(elementProto, '_style', {
    configurable: true,
    get(this: object) {
      return styles.get(this);
    },
    set(this: object, style: DominoStyle) {
      styles.set(this, keepCaseOn(style));
    },
  });
};

class NoopMutationObserver {
  observe() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }

  takeRecords(): unknown[] {
    return [];
  }
}

/** Domino ships no `MutationObserver`; nothing mutates a server render after it is serialised, so one that never fires is exact. */
export const shimMutationObserver = (scope: { MutationObserver?: unknown }) => {
  scope.MutationObserver ??= NoopMutationObserver;
};

const DEV_MODE_NOTICE = 'Angular is running in development mode.';

/** Drops the line Angular logs on every bootstrap in development mode, which would repeat once per drawn frame. */
export const quietDevModeNotice = (target: Pick<Console, 'log'>) => {
  const log = target.log.bind(target);

  target.log = (...args: unknown[]) => {
    if (args.length === 1 && args[0] === DEV_MODE_NOTICE) return;

    log(...args);
  };
};
