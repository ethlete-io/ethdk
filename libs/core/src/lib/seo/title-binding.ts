import { computed, effect, inject, isSignal, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { injectLocale } from '../providers';
import { injectIsRouterInitialized, MaybeSignal, previousSignalValue } from '../signals';
import { createRootProvider, createStaticRootProvider } from '../utils';

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
    const titleParts = signal<TitlePart[]>([]);
    const { currentLocale } = injectLocale();
    const titleService = inject(Title);
    const isRouterInitialized = injectIsRouterInitialized();

    const defaultTitle = config.defaultTitle ?? titleService.getTitle();

    const title = computed(() => {
      const parts = titleParts();

      if (!parts.length || !isRouterInitialized()) return config.transformer(defaultTitle, currentLocale());

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

    const addPart = (part: TitlePart) => {
      titleParts.update((parts) => [...parts, part]);
    };

    const removePart = (part: TitlePart) => {
      titleParts.update((parts) => parts.filter((p) => p.text !== part.text));
    };

    effect(() => {
      const titleText = title();
      titleService.setTitle(titleText);
    });

    return {
      title,
      addPart,
      removePart,
    };
  },
  {
    name: 'Title Store',
  },
);

export const applyHeadTitleBinding = (
  binding: MaybeSignal<string | number | null | undefined>,
  options?: Omit<TitlePart, 'text'>,
) => {
  const titleStore = injectTitleStore();

  const signalBinding = isSignal(binding) ? binding : signal(binding);
  const previousBinding = previousSignalValue(signalBinding);

  const update = () => {
    const value = signalBinding();
    untracked(() => {
      const prev = previousBinding();

      if (prev !== null && prev !== undefined && prev !== '') {
        titleStore.removePart({ text: `${prev}`, ...options });
      }

      if (value !== null && value !== undefined && value !== '') {
        titleStore.addPart({ text: `${value}`, ...options });
      }
    });
  };

  update();

  let isFirstRun = true;

  effect((cleanup) => {
    signalBinding();

    cleanup(() => {
      const val = signalBinding();
      if (val !== null && val !== undefined && val !== '') {
        titleStore.removePart({ text: `${val}`, ...options });
      }
    });

    if (isFirstRun) {
      isFirstRun = false;
      return;
    }

    update();
  });
};
