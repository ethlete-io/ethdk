import { computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { injectLocale } from '../providers';
import { injectIsRouterInitialized, MaybeSignal } from '../signals';
import { defineRootProvider, defineStaticRootProvider, toInjectFn, toProvideFn } from '../utils';
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
   * A title part to be suffixed to all titles
   */
  suffixPart?: TitlePart;

  /**
   * A title part to be prefixed to all titles
   */
  prefixPart?: TitlePart;

  /**
   * The order of the bound parts. `'parent-first'` gives `Parent | Child`, `'child-first'` gives `Child | Parent`.
   * The prefix and suffix parts keep their place either way.
   * @default 'parent-first'
   */
  order?: 'parent-first' | 'child-first';
};

const TITLE_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<TitleConfig>(
  {
    divider: '|',
    defaultTitle: '',
    transformer: (title: string) => title,
  },
  { name: 'Title Config' },
);

export const provideTitleConfig = /* @__PURE__ */ toProvideFn(TITLE_CONFIG_DEF);
export const injectTitleConfig = /* @__PURE__ */ toInjectFn(TITLE_CONFIG_DEF);

const TITLE_STORE_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const config = injectTitleConfig();
    const titleParts = signal<Map<symbol, { part: TitlePart; priority: number }>>(new Map());
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

      const parts = Array.from(partsMap.values())
        .sort((a, b) => a.priority - b.priority)
        .map((entry) => entry.part);
      const finalTextParts: string[] = [];

      for (let index = parts.length - 1; index > -1; index--) {
        const part = parts[index];
        if (!part) continue;

        const text = config.transformer(part.text, currentLocale());
        finalTextParts.unshift(text);

        if (part.useAsStart) break;
      }

      if (config.order === 'child-first') finalTextParts.reverse();

      if (config.prefixPart?.text) {
        finalTextParts.unshift(config.transformer(config.prefixPart.text, currentLocale()));
      }

      if (config.suffixPart?.text) {
        finalTextParts.push(config.transformer(config.suffixPart.text, currentLocale()));
      }

      return finalTextParts.join(` ${config.divider} `);
    });

    /**
     * The composed title with any markers prefixed - what actually lands in `document.title`.
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

    let priorityCounter = 0;

    const claimPriority = () => priorityCounter++;

    const addPart = (id: symbol, part: TitlePart, priority = claimPriority()) => {
      titleParts.update((parts) => new Map(parts).set(id, { part, priority }));
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

    return { title, addPart, removePart, addMarker, removeMarker, claimPriority };
  },
  { name: 'Title Store' },
);

export const provideTitleStore = /* @__PURE__ */ toProvideFn(TITLE_STORE_DEF);
export const injectTitleStore = /* @__PURE__ */ toInjectFn(TITLE_STORE_DEF);

export const applyHeadTitleBinding = (
  binding: MaybeSignal<string | number | null | undefined>,
  options?: Omit<TitlePart, 'text'>,
) => {
  const titleStore = injectTitleStore();
  const partId = Symbol('title-part');
  const priority = titleStore.claimPriority();

  applyHeadBinding(
    binding,
    (value) => titleStore.addPart(partId, { text: `${value}`, ...options }, priority),
    () => titleStore.removePart(partId),
    (value): value is string | number => value !== null && value !== undefined && value !== '',
  );
};

/**
 * Prefix the tab title with a short marker (`● Page | App`) while the binding has a value - the
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
