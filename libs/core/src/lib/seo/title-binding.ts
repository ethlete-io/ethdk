import { computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { injectLocale } from '../providers';
import { injectIsRouterInitialized, MaybeSignal } from '../signals';
import { createRootProvider, createStaticRootProvider } from '../utils';
import { applyHeadBinding } from './head-binding';

export type TitlePart = {
  /** The text to be displayed as the title */
  text: string;

  /** Whether this part should be used as the starting point for the title construction */
  useAsStart?: boolean;
};

export type TitleConfig = {
  /**
   * The divider string used between title parts
   * @default '|'
   */
  divider: string;

  /** The default title to use when no parts are available */
  defaultTitle: string;

  /**
   * A function to transform the title text based on locale.
   * Use `provideLocale()` to update the locale dynamically.
   */
  transformer: (title: string, locale: string) => string;

  /**
   * A title part to be prefixed to all titles
   */
  suffixPart?: TitlePart;

  /**
   * A title part to be suffixed to all titles
   */
  prefixPart?: TitlePart;
};

export const [provideTitleConfig, injectTitleConfig] = createStaticRootProvider<TitleConfig>(
  {
    divider: '|',
    defaultTitle: '',
    transformer: (title: string) => title,
  },
  { name: 'Title Config' },
);

export const [provideTitleStore, injectTitleStore] = createRootProvider(
  () => {
    const config = injectTitleConfig();
    const titleParts = signal<Map<symbol, TitlePart>>(new Map());
    const titleMarkers = signal<Map<symbol, string>>(new Map());
    const { currentLocale } = injectLocale();
    const titleService = inject(Title);
    const isRouterInitialized = injectIsRouterInitialized();

    // Falls back on an empty configured default too, so a store created lazily (e.g. by a title
    // marker) doesn't wipe a title that came from `index.html`.
    const defaultTitle = config.defaultTitle || titleService.getTitle();

    const composedTitle = computed(() => {
      const partsMap = titleParts();

      if (!partsMap.size || !isRouterInitialized()) {
        return config.transformer(defaultTitle, currentLocale());
      }

      const parts = Array.from(partsMap.values());
      const finalTextParts: string[] = [];

      for (let index = parts.length - 1; index > -1; index--) {
        const part = parts[index];
        if (!part) continue;

        const text = config.transformer(part.text, currentLocale());
        finalTextParts.unshift(text);

        if (part.useAsStart) break;
      }

      if (config.prefixPart?.text) {
        finalTextParts.unshift(config.transformer(config.prefixPart.text, currentLocale()));
      }

      if (config.suffixPart?.text) {
        finalTextParts.push(config.transformer(config.suffixPart.text, currentLocale()));
      }

      return finalTextParts.join(` ${config.divider} `);
    });

    /**
     * The composed title with any markers prefixed — what actually lands in `document.title`.
     * Markers sit outside the divider logic, so `● Page | App` rather than `● | Page | App`.
     */
    const title = computed(() => {
      // Deduplicated: two forms with unsaved changes should read as one marker, not two.
      const markers = Array.from(new Set(titleMarkers().values()));
      const composed = composedTitle();

      if (!markers.length) {
        return composed;
      }

      return `${markers.join(' ')} ${composed}`.trim();
    });

    const addPart = (id: symbol, part: TitlePart) => {
      titleParts.update((parts) => new Map(parts).set(id, part));
    };

    const removePart = (id: symbol) => {
      titleParts.update((parts) => {
        const newParts = new Map(parts);
        newParts.delete(id);
        return newParts;
      });
    };

    const addMarker = (id: symbol, marker: string) => {
      titleMarkers.update((markers) => new Map(markers).set(id, marker));
    };

    const removeMarker = (id: symbol) => {
      titleMarkers.update((markers) => {
        const newMarkers = new Map(markers);
        newMarkers.delete(id);
        return newMarkers;
      });
    };

    effect(() => {
      const titleText = title();
      titleService.setTitle(titleText);
    });

    return { title, addPart, removePart, addMarker, removeMarker };
  },
  { name: 'Title Store' },
);

export const applyHeadTitleBinding = (
  binding: MaybeSignal<string | number | null | undefined>,
  options?: Omit<TitlePart, 'text'>,
) => {
  const titleStore = injectTitleStore();
  const partId = Symbol('title-part');

  applyHeadBinding(
    binding,
    (value) => titleStore.addPart(partId, { text: `${value}`, ...options }),
    () => titleStore.removePart(partId),
    (value): value is string | number => value !== null && value !== undefined && value !== '',
  );
};

/**
 * Prefix the tab title with a short marker (`● Page | App`) while the binding has a value — the
 * unsaved-changes dot, a pending-count badge, and the like. The marker is removed when the binding
 * goes empty and on destroy. Unlike a title part, it is not joined by the divider.
 */
export const applyHeadTitleMarker = (binding: MaybeSignal<string | null | undefined>) => {
  const titleStore = injectTitleStore();
  const markerId = Symbol('title-marker');

  applyHeadBinding(
    binding,
    (value) => titleStore.addMarker(markerId, value),
    () => titleStore.removeMarker(markerId),
    (value): value is string => value !== null && value !== undefined && value !== '',
  );
};
