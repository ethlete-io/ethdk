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
    const { currentLocale } = injectLocale();
    const titleService = inject(Title);
    const isRouterInitialized = injectIsRouterInitialized();

    const defaultTitle = config.defaultTitle ?? titleService.getTitle();

    const title = computed(() => {
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

    effect(() => {
      const titleText = title();
      titleService.setTitle(titleText);
    });

    return { title, addPart, removePart };
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
