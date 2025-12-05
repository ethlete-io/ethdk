import { computed, effect, inject, isSignal, signal, untracked } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { injectLocale } from '../providers';
import { MaybeSignal } from '../signals';
import { createRootProvider, createStaticRootProvider } from '../utils';
import { applyHeadBinding, createArrayPropertyBinding, createPropertyBinding, toStringBinding } from './head-binding';
import { applyHeadTitleBinding } from './title-binding';

export type MetaTagConfig = {
  /** Unique identifier for the tag  */
  key?: string;

  /** Whether multiple instances of this tag are allowed */
  allowMultiple?: boolean;

  charset?: string;
  content?: string;
  httpEquiv?: string;
  id?: string;
  itemprop?: string;
  name?: string;
  property?: string;
  scheme?: string;
  url?: string;
};

type MetaTagBinding = {
  config: MetaTagConfig;
  priority: number;
};

export type MetaConfig = {
  /**
   * A function to transform meta tag content based on locale.
   * Use `provideLocale()` to update the locale dynamically.
   */
  transformer: (content: string, locale: string) => string;

  /**
   * Tags that are allowed to have multiple instances
   * If you want to override the default set, extend your set from {@link DEFAULT_MULTI_INSTANCE_TAGS}.
   * Otherwise, common multiple instance tags may be removed unintentionally.
   * @example
   * ```ts
   * import { DEFAULT_MULTI_INSTANCE_TAGS, provideMetaConfig } from '@ethlete/core';
   *
   * provideMetaConfig({
   *   multiInstanceTags: new Set([
   *     ...DEFAULT_MULTI_INSTANCE_TAGS,
   *     'name="custom-multiple-tag"',
   *   ]),
   * });
   * ```
   */
  multiInstanceTags: Set<string>;
};

export const DEFAULT_MULTI_INSTANCE_TAGS = new Set([
  // Open Graph - Media
  'property="og:image"',
  'property="og:image:url"',
  'property="og:image:secure_url"',
  'property="og:video"',
  'property="og:video:url"',
  'property="og:video:secure_url"',
  'property="og:audio"',
  'property="og:audio:url"',
  'property="og:audio:secure_url"',

  // Open Graph - Locale alternatives
  'property="og:locale:alternate"',

  // Twitter Card
  'name="twitter:image"',
  'name="twitter:player"',

  // Article tags (arrays)
  'property="article:author"',
  'property="article:tag"',

  // Music tags (arrays)
  'property="music:song"',
  'property="music:musician"',
  'property="music:album"',

  // Video tags (arrays)
  'property="video:actor"',
  'property="video:director"',
  'property="video:writer"',
  'property="video:tag"',

  // Book tags (arrays)
  'property="book:author"',
  'property="book:tag"',

  // Profile (arrays)
  'property="profile:username"',

  // Product tags (arrays)
  'property="product:category"',
  'property="product:retailer_item_id"',

  // App Links (multiple platforms)
  'property="al:ios:url"',
  'property="al:ios:app_store_id"',
  'property="al:ios:app_name"',
  'property="al:android:url"',
  'property="al:android:app_name"',
  'property="al:android:package"',
  'property="al:web:url"',
  'property="al:windows_phone:url"',
  'property="al:windows_phone:app_id"',
  'property="al:windows_phone:app_name"',
  'property="al:windows:url"',
  'property="al:windows:app_id"',
  'property="al:windows:app_name"',
  'property="al:windows_universal:url"',
  'property="al:windows_universal:app_id"',
  'property="al:windows_universal:app_name"',

  // Dublin Core (can have multiple)
  'name="DC.creator"',
  'name="DC.contributor"',
  'name="DC.subject"',

  // Schema.org (via meta tags - though JSON-LD is preferred)
  'itemprop="image"',
  'itemprop="author"',

  // Apple iOS
  'name="apple-itunes-app"', // Can have multiple app arguments

  // Verification tags (multiple services)
  'name="google-site-verification"',
  'name="msvalidate.01"',
  'name="yandex-verification"',
  'name="p:domain_verify"', // Pinterest
  'name="facebook-domain-verification"',
]);

export const [provideMetaConfig, injectMetaConfig] = createStaticRootProvider<MetaConfig>(
  {
    transformer: (content: string) => content,
    multiInstanceTags: DEFAULT_MULTI_INSTANCE_TAGS,
  },
  { name: 'Meta Config' },
);

export const [provideMetaStore, injectMetaStore] = createRootProvider(
  () => {
    const metaService = inject(Meta);
    const config = injectMetaConfig();
    const { currentLocale } = injectLocale();

    const metaTagsBySelector = signal<Map<string, Map<symbol, MetaTagBinding>>>(new Map());
    let priorityCounter = 0;

    const getSelector = (config: MetaTagConfig): string => {
      if (config.name) return `name="${config.name}"`;
      if (config.property) return `property="${config.property}"`;
      if (config.httpEquiv) return `http-equiv="${config.httpEquiv}"`;
      if (config.itemprop) return `itemprop="${config.itemprop}"`;
      return config.key ?? '';
    };

    const isMultiInstanceTag = (selector: string): boolean => {
      return config.multiInstanceTags.has(selector);
    };

    const applyTag = (rawConfig: MetaTagConfig, locale: string): HTMLMetaElement => {
      const transformedConfig = { ...rawConfig };

      if (transformedConfig.content) {
        transformedConfig.content = config.transformer(transformedConfig.content, locale);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { key, allowMultiple, ...metaConfig } = transformedConfig;

      return metaService.addTag(metaConfig) as HTMLMetaElement;
    };

    const applyActiveTag = (selector: string) => {
      const locale = currentLocale();
      const bindings = untracked(() => metaTagsBySelector().get(selector));

      if (!bindings || bindings.size === 0) {
        metaService.removeTag(selector);
        return;
      }

      const allowMultiple =
        isMultiInstanceTag(selector) || Array.from(bindings.values()).some((b) => b.config.allowMultiple);

      const existingTags = metaService.getTags(selector);
      existingTags.forEach((tag) => metaService.removeTagElement(tag));

      if (allowMultiple) {
        const sortedBindings = Array.from(bindings.values()).sort((a, b) => a.priority - b.priority);

        sortedBindings.forEach((binding) => {
          applyTag(binding.config, locale);
        });
      } else {
        const activeBinding = Array.from(bindings.values()).reduce((highest, current) =>
          current.priority > highest.priority ? current : highest,
        );

        applyTag(activeBinding.config, locale);
      }
    };

    const addTag = (id: symbol, rawConfig: MetaTagConfig) => {
      const selector = getSelector(rawConfig);
      const priority = priorityCounter++;

      metaTagsBySelector.update((tagsBySelector) => {
        const newTagsBySelector = new Map(tagsBySelector);
        const selectorBindings = newTagsBySelector.get(selector) || new Map();

        selectorBindings.set(id, { config: rawConfig, priority });
        newTagsBySelector.set(selector, new Map(selectorBindings));

        return newTagsBySelector;
      });

      applyActiveTag(selector);
    };

    const removeTag = (id: symbol, selector?: string) => {
      if (selector) {
        metaTagsBySelector.update((tagsBySelector) => {
          const newTagsBySelector = new Map(tagsBySelector);
          const selectorBindings = newTagsBySelector.get(selector);

          if (selectorBindings) {
            selectorBindings.delete(id);

            if (selectorBindings.size === 0) {
              newTagsBySelector.delete(selector);
            } else {
              newTagsBySelector.set(selector, new Map(selectorBindings));
            }
          }

          return newTagsBySelector;
        });

        applyActiveTag(selector);
        return;
      }

      metaTagsBySelector.update((tagsBySelector) => {
        const newTagsBySelector = new Map(tagsBySelector);
        let affectedSelector: string | undefined;

        for (const [sel, bindings] of newTagsBySelector) {
          if (bindings.has(id)) {
            bindings.delete(id);
            affectedSelector = sel;

            if (bindings.size === 0) {
              newTagsBySelector.delete(sel);
            } else {
              newTagsBySelector.set(sel, new Map(bindings));
            }
            break;
          }
        }

        if (affectedSelector) {
          queueMicrotask(() => applyActiveTag(affectedSelector));
        }

        return newTagsBySelector;
      });
    };

    effect(() => {
      currentLocale();
      const tagsBySelector = untracked(() => metaTagsBySelector());

      tagsBySelector.forEach((_, selector) => {
        applyActiveTag(selector);
      });
    });

    return { addTag, removeTag, getSelector };
  },
  { name: 'Meta Store' },
);

export const applyMetaBinding = (binding: MaybeSignal<MetaTagConfig | null | undefined>) => {
  const metaStore = injectMetaStore();
  const tagId = Symbol('meta-tag');
  let currentSelector: string | undefined;

  applyHeadBinding(
    binding,
    (config) => {
      currentSelector = metaStore.getSelector(config);
      metaStore.addTag(tagId, config);
    },
    () => metaStore.removeTag(tagId, currentSelector),
  );
};

export const applyDescriptionBinding = createPropertyBinding(
  (content) => ({ name: 'description', content }),
  applyMetaBinding,
);

export const applyKeywordsBinding = (binding: MaybeSignal<string[] | null | undefined>) => {
  applyMetaBinding(
    computed(() => {
      const keywords = untracked(() => (isSignal(binding) ? binding() : binding));
      return keywords && keywords.length > 0 ? { name: 'keywords', content: keywords.join(', ') } : null;
    }),
  );
};

export const applyAuthorBinding = createPropertyBinding((content) => ({ name: 'author', content }), applyMetaBinding);

export type RobotsConfig = {
  index?: boolean;
  follow?: boolean;
  noarchive?: boolean;
  nosnippet?: boolean;
  noimageindex?: boolean;
  maxSnippet?: number;
  maxImagePreview?: 'none' | 'standard' | 'large';
  maxVideoPreview?: number;
};

export const applyRobotsBinding = (binding: MaybeSignal<RobotsConfig | null | undefined>) => {
  applyMetaBinding(
    computed(() => {
      const config = untracked(() => (isSignal(binding) ? binding() : binding));
      if (!config) return null;

      const directives: string[] = [];

      if (config.index === false) directives.push('noindex');
      if (config.follow === false) directives.push('nofollow');
      if (config.noarchive) directives.push('noarchive');
      if (config.nosnippet) directives.push('nosnippet');
      if (config.noimageindex) directives.push('noimageindex');
      if (config.maxSnippet !== undefined) directives.push(`max-snippet:${config.maxSnippet}`);
      if (config.maxImagePreview) directives.push(`max-image-preview:${config.maxImagePreview}`);
      if (config.maxVideoPreview !== undefined) directives.push(`max-video-preview:${config.maxVideoPreview}`);

      return directives.length > 0 ? { name: 'robots', content: directives.join(', ') } : null;
    }),
  );
};

export const applyOgBinding = (property: string, binding: MaybeSignal<string | null | undefined>) => {
  createPropertyBinding((content) => ({ property: `og:${property}`, content }), applyMetaBinding)(binding);
};

const createOgArrayBinding = (property: string) =>
  createArrayPropertyBinding(
    (value, index) => ({
      property: `og:${property}`,
      content: value,
      allowMultiple: true,
      key: `og:${property}:${index}`,
    }),
    applyMetaBinding,
  );

export type OpenGraphConfig = {
  title?: MaybeSignal<string | null | undefined>;
  description?: MaybeSignal<string | null | undefined>;
  url?: MaybeSignal<string | null | undefined>;
  type?: MaybeSignal<string | null | undefined>;
  siteName?: MaybeSignal<string | null | undefined>;
  locale?: MaybeSignal<string | null | undefined>;
  image?: MaybeSignal<string | null | undefined>;
  images?: MaybeSignal<string[] | null | undefined>;
  imageUrl?: MaybeSignal<string | null | undefined>;
  imageSecureUrl?: MaybeSignal<string | null | undefined>;
  imageType?: MaybeSignal<string | null | undefined>;
  imageWidth?: MaybeSignal<string | number | null | undefined>;
  imageHeight?: MaybeSignal<string | number | null | undefined>;
  imageAlt?: MaybeSignal<string | null | undefined>;
  video?: MaybeSignal<string | null | undefined>;
  videos?: MaybeSignal<string[] | null | undefined>;
  videoUrl?: MaybeSignal<string | null | undefined>;
  videoSecureUrl?: MaybeSignal<string | null | undefined>;
  videoType?: MaybeSignal<string | null | undefined>;
  videoWidth?: MaybeSignal<string | number | null | undefined>;
  videoHeight?: MaybeSignal<string | number | null | undefined>;
  audio?: MaybeSignal<string | null | undefined>;
  audios?: MaybeSignal<string[] | null | undefined>;
};

export const applyOpenGraphBindings = (config: OpenGraphConfig) => {
  const applyOg = (property: string, binding?: MaybeSignal<string | null | undefined>) => {
    if (binding) applyOgBinding(property, binding);
  };

  applyOg('title', config.title);
  applyOg('description', config.description);
  applyOg('url', config.url);
  applyOg('type', config.type);
  applyOg('site_name', config.siteName);
  applyOg('locale', config.locale);
  applyOg('image', config.image);
  applyOg('image:url', config.imageUrl);
  applyOg('image:secure_url', config.imageSecureUrl);
  applyOg('image:type', config.imageType);
  applyOg('image:alt', config.imageAlt);
  applyOg('video', config.video);
  applyOg('video:url', config.videoUrl);
  applyOg('video:secure_url', config.videoSecureUrl);
  applyOg('video:type', config.videoType);
  applyOg('audio', config.audio);

  if (config.imageWidth) applyOg('image:width', toStringBinding(config.imageWidth));
  if (config.imageHeight) applyOg('image:height', toStringBinding(config.imageHeight));
  if (config.videoWidth) applyOg('video:width', toStringBinding(config.videoWidth));
  if (config.videoHeight) applyOg('video:height', toStringBinding(config.videoHeight));

  if (config.images) createOgArrayBinding('image')(config.images);
  if (config.videos) createOgArrayBinding('video')(config.videos);
  if (config.audios) createOgArrayBinding('audio')(config.audios);
};

export type TwitterCardConfig = {
  card?: MaybeSignal<'summary' | 'summary_large_image' | 'app' | 'player' | null | undefined>;
  site?: MaybeSignal<string | null | undefined>;
  siteId?: MaybeSignal<string | null | undefined>;
  creator?: MaybeSignal<string | null | undefined>;
  creatorId?: MaybeSignal<string | null | undefined>;
  title?: MaybeSignal<string | null | undefined>;
  description?: MaybeSignal<string | null | undefined>;
  image?: MaybeSignal<string | null | undefined>;
  images?: MaybeSignal<string[] | null | undefined>;
  imageAlt?: MaybeSignal<string | null | undefined>;
  player?: MaybeSignal<string | null | undefined>;
  playerWidth?: MaybeSignal<string | number | null | undefined>;
  playerHeight?: MaybeSignal<string | number | null | undefined>;
  playerStream?: MaybeSignal<string | null | undefined>;
};

const createTwitterArrayBinding = (property: string) =>
  createArrayPropertyBinding(
    (value, index) => ({
      name: `twitter:${property}`,
      content: value,
      allowMultiple: true,
      key: `twitter:${property}:${index}`,
    }),
    applyMetaBinding,
  );

export const applyTwitterCardBindings = (config: TwitterCardConfig) => {
  const applyTwitter = (property: string, binding?: MaybeSignal<string | null | undefined>) => {
    if (!binding) return;
    createPropertyBinding((content) => ({ name: `twitter:${property}`, content }), applyMetaBinding)(binding);
  };

  applyTwitter('card', config.card);
  applyTwitter('site', config.site);
  applyTwitter('site:id', config.siteId);
  applyTwitter('creator', config.creator);
  applyTwitter('creator:id', config.creatorId);
  applyTwitter('title', config.title);
  applyTwitter('description', config.description);
  applyTwitter('image', config.image);
  applyTwitter('image:alt', config.imageAlt);
  applyTwitter('player', config.player);
  applyTwitter('player:stream', config.playerStream);

  if (config.playerWidth) applyTwitter('player:width', toStringBinding(config.playerWidth));
  if (config.playerHeight) applyTwitter('player:height', toStringBinding(config.playerHeight));

  if (config.images) createTwitterArrayBinding('image')(config.images);
};

export type ArticleConfig = {
  publishedTime?: MaybeSignal<string | null | undefined>;
  modifiedTime?: MaybeSignal<string | null | undefined>;
  expirationTime?: MaybeSignal<string | null | undefined>;
  author?: MaybeSignal<string | null | undefined>;
  authors?: MaybeSignal<string[] | null | undefined>;
  section?: MaybeSignal<string | null | undefined>;
  tag?: MaybeSignal<string | null | undefined>;
  tags?: MaybeSignal<string[] | null | undefined>;
};

const createArticleArrayBinding = (property: string) =>
  createArrayPropertyBinding(
    (value, index) => ({
      property: `article:${property}`,
      content: value,
      allowMultiple: true,
      key: `article:${property}:${index}`,
    }),
    applyMetaBinding,
  );

export const applyArticleBindings = (config: ArticleConfig) => {
  const applyArticle = (property: string, binding?: MaybeSignal<string | null | undefined>) => {
    if (!binding) return;
    createPropertyBinding((content) => ({ property: `article:${property}`, content }), applyMetaBinding)(binding);
  };

  applyArticle('published_time', config.publishedTime);
  applyArticle('modified_time', config.modifiedTime);
  applyArticle('expiration_time', config.expirationTime);
  applyArticle('author', config.author);
  applyArticle('section', config.section);
  applyArticle('tag', config.tag);

  if (config.authors) createArticleArrayBinding('author')(config.authors);
  if (config.tags) createArticleArrayBinding('tag')(config.tags);
};

export type SocialMediaConfig = {
  title?: MaybeSignal<string | null | undefined>;
  description?: MaybeSignal<string | null | undefined>;
  image?: MaybeSignal<string | null | undefined>;
  url?: MaybeSignal<string | null | undefined>;
  openGraph?: Partial<OpenGraphConfig>;
  twitter?: Partial<TwitterCardConfig>;
  article?: Partial<ArticleConfig>;
};

export const applySocialMediaBindings = (config: SocialMediaConfig) => {
  if (config.title) applyHeadTitleBinding(config.title);
  if (config.description) applyDescriptionBinding(config.description);

  if (config.openGraph || config.title || config.description || config.image || config.url) {
    applyOpenGraphBindings({
      title: config.openGraph?.title ?? config.title,
      description: config.openGraph?.description ?? config.description,
      image: config.openGraph?.image ?? config.image,
      url: config.openGraph?.url ?? config.url,
      ...config.openGraph,
    });
  }

  if (config.twitter || config.title || config.description || config.image) {
    applyTwitterCardBindings({
      title: config.twitter?.title ?? config.title,
      description: config.twitter?.description ?? config.description,
      image: config.twitter?.image ?? config.image,
      ...config.twitter,
    });
  }

  if (config.article) applyArticleBindings(config.article);
};
