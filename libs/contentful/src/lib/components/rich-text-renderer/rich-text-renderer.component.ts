import { DOCUMENT } from '@angular/common';
import {
  Component,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
  Type,
  ViewContainerRef,
  ViewEncapsulation,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  inputBinding,
  isDevMode,
  reflectComponentType,
  signal,
  untracked,
} from '@angular/core';
import { Block, Inline, Mark, Text } from '@contentful/rich-text-types';
import { getObjectProperty, injectRenderer, isObject } from '@ethlete/core';
import {
  ContentfulCollection,
  ContentfulEntry,
  ContentfulEntryLinkItem,
  ContentfulRestAsset,
  RichTextResponse,
} from '../../types';
import { injectContentfulConfig } from '../../utils/contentful-config';
import { isExternalWebHref } from '../link/contentful-link.util';
import { CF_BLOCKS, CF_INLINES } from './rich-text-node-types';
import { richTextRendererError } from './rich-text-renderer.errors';
import { isRichTextRootNode, translateContentfulNodeTypeToHtmlTag } from './rich-text-renderer.util';

type HtmlOpenRenderCommand = {
  kind: 'htmlOpen';
  nestingLevel: number;
  domPosition: number;
  parentId: string | null;
  attributes: Record<string, string>;
  tagName: keyof HTMLElementTagNameMap;
  id: string;
};

type HtmlCloseRenderCommand = {
  kind: 'htmlClose';
  nestingLevel: number;
  domPosition: number;
  parentId: string | null;
  tagName: keyof HTMLElementTagNameMap;
  id: string;
};

type TextRenderCommand = {
  kind: 'text';
  nestingLevel: number;
  domPosition: number;
  parentId: string | null;
  attributes: Record<string, string>;
  markTags: MarkTagName[];
  text: string;
  id: string;
};

type ComponentRenderCommand = {
  kind: 'component';
  nestingLevel: number;
  domPosition: number;
  parentId: string | null;
  component: Type<unknown>;
  inputs: Record<string, unknown>;
  id: string;
};

type RenderCommand = HtmlOpenRenderCommand | HtmlCloseRenderCommand | TextRenderCommand | ComponentRenderCommand;

type RenderInstruction = {
  type: 'create' | 'update' | 'move' | 'delete';
  command: RenderCommand;
};

type MarkTagName = 'strong' | 'em' | 'u' | 'code' | 's' | 'sub' | 'sup';

const DEFAULT_ANCHOR_CLASS = 'et-contentful-rich-text-default-element et-contentful-rich-text-default-a';

const MARK_TAG_MAP: Record<string, MarkTagName> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  code: 'code',
  strikethrough: 's',
  subscript: 'sub',
  superscript: 'sup',
};

/**
 * Translates contentful text marks into the semantic html elements the marked text is
 * wrapped in, outermost first. Unknown marks are skipped (with a dev-mode warning).
 */
export const marksToTags = (marks: Mark[]) => {
  const tags: MarkTagName[] = [];

  for (const mark of marks) {
    const tag = MARK_TAG_MAP[mark.type];

    if (!tag) {
      if (isDevMode()) {
        console.warn(`No element found for mark type "${mark.type}"! The mark is ignored.`, mark);
      }

      continue;
    }

    tags.push(tag);
  }

  return tags;
};

/**
 * The classes marked text inside a hyperlink is rendered with, since the link component
 * receives its text as a plain string.
 */
export const marksToClass = (marks: Mark[]) =>
  marks.map((mark) => `et-contentful-rich-text-mark-${mark.type}`).join(' ');

const LINK_COMPONENT_TYPE = '$$$_et-link';

const normalizeHref = (href: string): string | null => {
  if (!href.trim()) {
    return null;
  }

  try {
    const url = new URL(href, 'https://contentful.invalid');

    return ['http:', 'https:', 'mailto:', 'tel:', 'ftp:'].includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
};

type ExecutedCommandCacheItemBase = {
  element: HTMLElement;
};

type ExecutedComponentCommandCacheItem = {
  command: ComponentRenderCommand;
  componentRef: ComponentRef<unknown>;
  inputs: WritableSignal<Record<string, unknown>>;
} & ExecutedCommandCacheItemBase;

type ExecutedHtmlCommandCacheItem = {
  command: HtmlOpenRenderCommand | HtmlCloseRenderCommand;
} & ExecutedCommandCacheItemBase;

type ExecutedTextCommandCacheItem = {
  command: TextRenderCommand;
} & ExecutedCommandCacheItemBase;

type ExecutedCommandCacheItem =
  ExecutedComponentCommandCacheItem | ExecutedHtmlCommandCacheItem | ExecutedTextCommandCacheItem;

const isExecutedComponentCommandCacheItem = (
  cache: ExecutedCommandCacheItem,
): cache is ExecutedComponentCommandCacheItem => {
  return cache.command.kind === 'component';
};

export const ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID = '$$$_et-contentful-any-entry-content-type-sys-id';

export type ContentfulIncludeMap = {
  /**
   * Select an entry by its ID and content type ID.
   *
   * The content type ID can be found inside the entry -> sys -> contentType -> sys -> id property.
   *
   * You can provide the `ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID` constant to match any entry sys ID.
   * But be aware that this will return the entry as is without any type checking.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEntry: <T extends { [key: string]: any }>(id: string, contentTypeId: string) => ContentfulEntry<T> | null;

  /**
   * Select multiple entries by their IDs and content type ID.
   * If an entry is not found, it will be omitted from the result.
   *
   * The content type ID can be found inside the entry -> sys -> contentType -> sys -> id property.
   *
   * You can provide the `ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID` constant to match any entry sys ID.
   * But be aware that this will return the entry as is without any type checking.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEntries: <T extends { [key: string]: any }>(
    ids: string[] | ContentfulEntryLinkItem[],
    contentTypeId: string,
  ) => ContentfulEntry<T>[];

  /**
   * Select an asset by its ID.
   */
  getAsset: (id: string) => ContentfulRestAsset | null;

  /**
   * Select multiple assets by their IDs. If an asset is not found, it will be omitted from the result.
   */
  getAssets: (ids: string[]) => ContentfulRestAsset[];
};

export type CreateContentfulIncludeMapConfig = {
  /** The entries that should be present inside the map  */
  entries: ContentfulEntry[];

  /** The assets that should be present inside the map  */
  assets: ContentfulRestAsset[];
};

/**
 * Create a contentful include map using the provided entries and assets.
 */
export const createContentfulIncludeMap = (config: CreateContentfulIncludeMapConfig): ContentfulIncludeMap => {
  const { entries, assets } = config;

  const assetMap = new Map(assets.map((asset) => [asset.sys.id, asset]));
  const entryMap = new Map(entries.map((entry) => [entry.sys.id, entry]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getEntry = <T extends { [key: string]: any }>(id: string, contentTypeId: string) => {
    const entry = entryMap.get(id);

    if (!entry) {
      if (isDevMode()) {
        console.warn('Entry not found! Will return null. Is the include query param too low?', { id, entryMap });
      }

      return null;
    }

    if (contentTypeId === ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID) {
      return entry as ContentfulEntry<T>;
    }

    if (entry.sys.contentType.sys.id !== contentTypeId) {
      if (isDevMode()) {
        console.warn('Entry sys ID does not match the provided sys ID! Will return null.', {
          entry,
          sysId: contentTypeId,
        });
      }

      return null;
    }

    return entry as ContentfulEntry<T>;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getEntries = <T extends { [key: string]: any }>(
    ids: string[] | ContentfulEntryLinkItem[],
    contentTypeId: string,
  ) => {
    const entries = ids
      .map((id) => (typeof id === 'string' ? id : id.sys.id))
      .map((id) => getEntry<T>(id, contentTypeId))
      .filter((entry): entry is ContentfulEntry<T> => entry !== null);

    return entries;
  };

  const getAsset = (id: string) => {
    return assetMap.get(id) ?? null;
  };

  const getAssets = (ids: string[]) => {
    return ids.map((id) => getAsset(id)).filter((asset): asset is ContentfulRestAsset => asset !== null);
  };

  return {
    getEntry,
    getEntries,
    getAsset,
    getAssets,
  };
};

@Component({
  selector: 'et-contentful-rich-text-renderer',
  template: ``,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-contentful-rich-text-renderer',
  },
})
export class ContentfulRichTextRendererComponent {
  private viewContainerRef = inject(ViewContainerRef);
  private renderer = injectRenderer();
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private config = injectContentfulConfig();
  private document = inject(DOCUMENT);

  /**
   * The contentful response gotten via their REST api.
   * @see https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/entries/entries-collection
   */
  content = input.required<ContentfulCollection | null | undefined>();

  /**
   * The path to where the rich text field is inside the contentful response. Dot and array notation is allowed.
   * @example "items[0].fields.html"
   */
  richTextPath = input.required<string>();

  private readonly executedCommandsCache = new Map<string, ExecutedCommandCacheItem>();

  private contentIncludesMap = computed<ContentfulIncludeMap>(() => {
    const content = this.content();
    const assets = content?.includes?.Asset;
    const entries = content?.includes?.Entry;

    return createContentfulIncludeMap({ assets: assets ?? [], entries: entries ?? [] });
  });

  private richTextData = computed(() => {
    const content = this.content();
    const richTextPath = this.richTextPath();

    if (!content) {
      return null;
    }

    const richText = getObjectProperty(content as unknown as Record<string, unknown>, richTextPath);

    if (richText === null || richText === undefined) {
      return null;
    }

    if (!isObject(richText)) {
      throw richTextRendererError('rich_text_undefined', { content, richTextPath });
    }

    if (!isRichTextRootNode(richText)) {
      throw richTextRendererError('rich_text_wrong_type', { content, richTextPath });
    }

    return richText as RichTextResponse;
  });

  private renderCommands = computed(() => {
    const richTextData = this.richTextData();

    if (!richTextData) {
      return [];
    }

    return this.createRenderCommands(richTextData);
  });

  private renderInstructions = computed(() => {
    const commands = this.renderCommands();
    const previousRenderCommandMap = new Map(
      [...this.executedCommandsCache.entries()].map(([id, item]) => [id, item.command]),
    );

    const instructions: RenderInstruction[] = [];

    const preserved = new Set<string>();
    const needsReattach = new Set<string>();

    const markTagsEqual = (a: MarkTagName[], b: MarkTagName[]) =>
      a.length === b.length && a.every((tag, index) => tag === b[index]);

    const attributesEqual = (a: Record<string, string>, b: Record<string, string>) => {
      const aKeys = Object.keys(a);

      return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key]);
    };

    for (const command of commands) {
      if (command.kind === 'htmlClose') {
        continue;
      }

      const previous = previousRenderCommandMap.get(command.id);

      if (!previous || previous.kind !== command.kind) {
        continue;
      }

      if (previous.kind === 'component' && command.kind === 'component' && previous.component !== command.component) {
        continue;
      }

      const parentPreserved =
        previous.parentId === command.parentId && (command.parentId === null || preserved.has(command.parentId));

      if (command.kind === 'component') {
        preserved.add(command.id);

        const samePlace =
          parentPreserved &&
          previous.nestingLevel === command.nestingLevel &&
          previous.domPosition === command.domPosition;

        if (!samePlace) {
          needsReattach.add(command.id);
        }

        continue;
      }

      const sameOutput =
        previous.kind === command.kind &&
        (previous.kind !== 'htmlOpen' || previous.tagName === (command as HtmlOpenRenderCommand).tagName) &&
        (previous.kind !== 'text' ||
          (previous.text === (command as TextRenderCommand).text &&
            markTagsEqual(previous.markTags, (command as TextRenderCommand).markTags)));

      if (
        parentPreserved &&
        sameOutput &&
        previous.nestingLevel === command.nestingLevel &&
        previous.domPosition === command.domPosition &&
        attributesEqual(previous.attributes, command.attributes)
      ) {
        preserved.add(command.id);
      }
    }

    for (const [id, command] of previousRenderCommandMap) {
      if (command.kind !== 'htmlClose' && !preserved.has(id)) {
        instructions.push({ type: 'delete', command });
      }
    }

    for (const command of commands) {
      if (command.kind === 'htmlClose') {
        continue;
      }

      if (!preserved.has(command.id)) {
        instructions.push({ type: 'create', command });
      } else if (command.kind === 'component' && needsReattach.has(command.id)) {
        instructions.push({ type: 'move', command });
      } else {
        instructions.push({ type: 'update', command });
      }
    }

    return instructions;
  });

  constructor() {
    effect(() => {
      const instructions = this.renderInstructions();

      untracked(() => this.execInstructions(instructions));
    });
  }

  private createRenderCommands(richTextData: RichTextResponse) {
    const rootCommands: RenderCommand[] = [];
    let elementOpenId = 0;
    let elementCloseId = 0;
    const componentIdMap = new Map<string, number>();
    let nestingLevel = 0;
    let domPosition = 0;

    let textId = 0;

    const openElementIds: string[] = [];

    const traverse = (node: Block | Inline | Text) => {
      switch (node.nodeType) {
        case 'text': {
          const text = node.value;

          if (!text) break;

          const attributes: Record<string, string> = {
            class: 'et-contentful-rich-text-default-element et-contentful-rich-text-default-span',
          };

          rootCommands.push({
            kind: 'text',
            nestingLevel,
            domPosition,
            parentId: openElementIds.at(-1) ?? null,
            attributes,
            markTags: node.marks.length ? marksToTags(node.marks) : [],
            text,
            id: 't' + textId++,
          });

          domPosition++;

          break;
        }

        case CF_BLOCKS.EMBEDDED_ASSET: {
          const assetId = node.data['target']?.sys?.id;

          if (!assetId) {
            throw richTextRendererError('asset_id_not_found', { node });
          }

          const asset = this.contentIncludesMap().getAsset(assetId);

          if (!asset) {
            if (isDevMode()) {
              console.warn(
                'Embedded asset is missing from the includes! The asset will be skipped. Is it unpublished or deleted?',
                { assetId, node },
              );
            }

            break;
          }

          const contentType = asset.fields.file?.contentType;
          const assetComponents = this.config.components;

          const isMissing = !contentType && !asset.fields.file?.url;

          if (isMissing) {
            if (isDevMode()) {
              console.warn(
                'Asset is missing file data! Asset will be skipped. Did you forget to upload a file for the current translation in Contentful?',
                { asset },
              );
            }

            break;
          }

          const isImage = contentType?.startsWith('image/');
          const isVideo = contentType?.startsWith('video/');
          const isAudio = contentType?.startsWith('audio/');

          const component = isImage
            ? assetComponents.image
            : isVideo
              ? assetComponents.video
              : isAudio
                ? assetComponents.audio
                : assetComponents.file;

          if (!component) {
            if (isDevMode()) {
              console.warn(
                'No component registered for this embedded asset! The asset will be skipped. Provide one via provideContentfulConfig({ components: … }).',
                { asset },
              );
            }

            break;
          }

          const occurrenceKey = 'asset:' + assetId;
          const occurrence = (componentIdMap.get(occurrenceKey) ?? -1) + 1;
          componentIdMap.set(occurrenceKey, occurrence);
          const id = occurrence === 0 ? occurrenceKey : `${occurrenceKey}:${occurrence}`;

          rootCommands.push({
            kind: 'component',
            nestingLevel,
            domPosition,
            parentId: openElementIds.at(-1) ?? null,
            component,
            inputs: { asset },
            id,
          });

          domPosition++;

          break;
        }

        case CF_INLINES.HYPERLINK:
        case CF_INLINES.ASSET_HYPERLINK:
        case CF_INLINES.ENTRY_HYPERLINK: {
          let href: string | null = null;

          if (node.nodeType === CF_INLINES.HYPERLINK) {
            href = normalizeHref((node.data['uri'] as string) ?? '');
          } else if (node.nodeType === CF_INLINES.ASSET_HYPERLINK) {
            const assetId = node.data['target']?.sys?.id;
            const asset = assetId ? this.contentIncludesMap().getAsset(assetId) : null;
            const url = asset?.fields.file?.url;
            href = url ? normalizeHref(url) : null;
          }

          const linkTexts = node.content.filter(
            (child): child is Text => child.nodeType === 'text' && Boolean(child.value),
          );
          const linkText = linkTexts.map((child) => child.value).join('');
          const linkComponent = href ? this.config.components.link : null;

          if (href && !linkComponent) {
            const attributes: Record<string, string> = { class: DEFAULT_ANCHOR_CLASS, href };

            if (
              isExternalWebHref(href, { location: this.document.location, internalHosts: this.config.internalHosts })
            ) {
              attributes['target'] = '_blank';
              attributes['rel'] = 'noopener noreferrer';
            }

            rootCommands.push({
              kind: 'htmlOpen',
              nestingLevel,
              domPosition,
              parentId: openElementIds.at(-1) ?? null,
              attributes,
              tagName: 'a',
              id: 'e-o' + elementOpenId++,
            });

            const anchorDomPosition = domPosition;

            openElementIds.push('e-o' + (elementOpenId - 1));
            nestingLevel++;
            domPosition = 0;

            for (const child of linkTexts) {
              traverse(child);
            }

            openElementIds.pop();
            nestingLevel--;
            domPosition = anchorDomPosition;

            rootCommands.push({
              kind: 'htmlClose',
              nestingLevel,
              domPosition,
              parentId: openElementIds.at(-1) ?? null,
              tagName: 'a',
              id: 'e-c' + elementCloseId++,
            });

            domPosition++;

            break;
          }

          if (!href) {
            for (const child of linkTexts) {
              traverse(child);
            }

            break;
          }

          if (!linkComponent) {
            break;
          }

          const sharedMarks =
            linkTexts[0]?.marks.filter((mark) =>
              linkTexts.every((child) => child.marks.some((other) => other.type === mark.type)),
            ) ?? [];
          const textClass = marksToClass(sharedMarks);

          let linkComponentId = componentIdMap.get(LINK_COMPONENT_TYPE) ?? -1;
          const linkId = LINK_COMPONENT_TYPE + ++linkComponentId;
          componentIdMap.set(LINK_COMPONENT_TYPE, linkComponentId);

          rootCommands.push({
            kind: 'component',
            nestingLevel,
            domPosition,
            parentId: openElementIds.at(-1) ?? null,
            component: linkComponent,
            inputs: { href, text: linkText, textClass, anchorClass: DEFAULT_ANCHOR_CLASS },
            id: linkId,
          });

          domPosition++;

          break;
        }

        case CF_BLOCKS.EMBEDDED_ENTRY:
        case CF_INLINES.EMBEDDED_ENTRY: {
          const entryId = node.data['target']?.sys?.id;

          if (!entryId) {
            throw richTextRendererError('entry_id_not_found', { node });
          }

          const entry = this.contentIncludesMap().getEntry(entryId, ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID);

          if (!entry) {
            if (isDevMode()) {
              console.warn(
                'Embedded entry is missing from the includes! The entry will be skipped. Is it unpublished or deleted?',
                { entryId, node },
              );
            }

            break;
          }

          const componentType = entry.sys.contentType.sys.id;

          const component = this.config.customComponents[componentType];

          if (!component) {
            if (isDevMode()) {
              console.warn(
                'No custom component registered for this embedded entry type! The entry will be skipped. Provide one via provideContentfulConfig({ customComponents: … }).',
                { componentType, customComponents: this.config.customComponents, entry },
              );
            }

            break;
          }

          const occurrenceKey = 'entry:' + entryId;
          const occurrence = (componentIdMap.get(occurrenceKey) ?? -1) + 1;
          componentIdMap.set(occurrenceKey, occurrence);
          const id = occurrence === 0 ? occurrenceKey : `${occurrenceKey}:${occurrence}`;

          rootCommands.push({
            kind: 'component',
            nestingLevel,
            domPosition,
            parentId: openElementIds.at(-1) ?? null,
            component,
            inputs: {
              fields: entry.fields,
              metadata: entry.metadata,
              sys: entry.sys,
              includes: this.contentIncludesMap(),
            },
            id,
          });

          domPosition++;

          break;
        }

        default: {
          const tag = translateContentfulNodeTypeToHtmlTag(node.nodeType);
          const attributes: Record<string, string> = {
            class: `et-contentful-rich-text-default-element et-contentful-rich-text-default-${tag}`,
          };

          rootCommands.push({
            kind: 'htmlOpen',
            nestingLevel,
            domPosition,
            parentId: openElementIds.at(-1) ?? null,
            attributes,
            tagName: tag,
            id: 'e-o' + elementOpenId++,
          });

          const domPositionAtThisLevel = domPosition;
          openElementIds.push('e-o' + (elementOpenId - 1));
          nestingLevel++;
          domPosition = 0;

          for (const child of node.content) {
            traverse(child);
          }

          openElementIds.pop();
          nestingLevel--;
          domPosition = domPositionAtThisLevel;

          const lastCommand = rootCommands[rootCommands.length - 1];

          if (
            lastCommand?.kind === 'htmlOpen' &&
            lastCommand.tagName !== 'td' &&
            lastCommand.tagName !== 'th' &&
            lastCommand.tagName !== 'hr'
          ) {
            rootCommands.pop();
            elementOpenId--;
          } else {
            rootCommands.push({
              kind: 'htmlClose',
              nestingLevel,
              domPosition,
              parentId: openElementIds.at(-1) ?? null,
              tagName: tag,
              id: 'e-c' + elementCloseId++,
            });

            domPosition++;
          }

          break;
        }
      }
    };

    for (const node of richTextData.content) {
      traverse(node);
    }

    return rootCommands;
  }

  private execInstructions(instructions: RenderInstruction[]) {
    const lastPlacedChild = new Map<string | null, HTMLElement>();

    for (const { type, command } of instructions) {
      if (type === 'delete') {
        this.runDeleteInstruction(command);

        continue;
      }

      const previousSibling = lastPlacedChild.get(command.parentId) ?? null;

      switch (type) {
        case 'create':
          this.runCreateInstruction(command, previousSibling);
          break;
        case 'update':
          this.runUpdateInstruction(command);
          break;
        case 'move':
          this.runMoveInstruction(command, previousSibling);
          break;
      }

      const element = this.executedCommandsCache.get(command.id)?.element;

      if (element) {
        lastPlacedChild.set(command.parentId, element);
      }
    }
  }

  private runCreateInstruction(command: RenderCommand, previousSibling: HTMLElement | null) {
    const parentElement = this.findParent(command);

    if (command.kind === 'component') {
      const inputs = signal(command.inputs);

      const declaredInputs = reflectComponentType(command.component)?.inputs ?? [];
      const bindings = declaredInputs
        .filter((declared) => declared.propName in command.inputs)
        .map((declared) => inputBinding(declared.templateName, () => inputs()[declared.propName]));

      const componentRef = this.viewContainerRef.createComponent(command.component, { bindings });

      const rootNode = this.getComponentRootNode(componentRef);

      this.renderInsertAfter(rootNode, { parentElement, previousSibling });

      this.executedCommandsCache.set(command.id, {
        command,
        componentRef,
        inputs,
        element: rootNode,
      });
    } else if (command.kind === 'text') {
      const span = this.renderer.createElement('span');
      const textSplitInLineBreaks = command.text.split('\n');

      for (const [key, value] of Object.entries(command.attributes)) {
        this.renderer.setAttribute(span, key, value);
      }

      let textContainer = span;

      for (const tag of command.markTags) {
        const markElement = this.renderer.createElement(tag);

        this.renderer.appendChild(textContainer, markElement);
        textContainer = markElement;
      }

      for (const [textPartIndex, textPart] of textSplitInLineBreaks.entries()) {
        if (textPartIndex > 0) {
          const brNode = this.renderer.createElement('br');
          this.renderer.appendChild(textContainer, brNode);
        }

        if (textPart) {
          const textNode = this.renderer.createText(textPart);

          this.renderer.appendChild(textContainer, textNode);
        }
      }

      this.renderInsertAfter(span, { parentElement, previousSibling });

      this.executedCommandsCache.set(command.id, {
        command,
        element: span,
      });
    } else if (command.kind === 'htmlOpen') {
      const element = this.renderer.createElement(command.tagName);

      for (const [key, value] of Object.entries(command.attributes)) {
        this.renderer.setAttribute(element, key, value);
      }

      this.renderInsertAfter(element, { parentElement, previousSibling });

      this.executedCommandsCache.set(command.id, {
        command,
        element,
      });
    }
  }

  private runUpdateInstruction(command: RenderCommand) {
    const cached = this.executedCommandsCache.get(command.id);

    if (!cached) {
      throw richTextRendererError('cached_command_not_found', { command });
    }

    if (command.kind === 'component') {
      if (!isExecutedComponentCommandCacheItem(cached)) {
        throw richTextRendererError('cached_command_not_component', { command });
      }

      cached.inputs.set(command.inputs);
    }

    this.executedCommandsCache.set(command.id, {
      ...cached,
      command,
    } as ExecutedCommandCacheItem);
  }

  private runMoveInstruction(command: RenderCommand, previousSibling: HTMLElement | null) {
    const cached = this.executedCommandsCache.get(command.id);

    if (!cached) {
      throw richTextRendererError('cached_command_not_found', { command });
    }

    if (command.kind === 'component') {
      if (!isExecutedComponentCommandCacheItem(cached)) {
        throw richTextRendererError('cached_command_not_component', { command });
      }

      const rootNode = cached.element;
      const oldParentElement = cached.element.parentElement;

      if (oldParentElement) {
        this.renderer.removeChild(oldParentElement, rootNode);
      }

      this.renderInsertAfter(rootNode, { parentElement: this.findParent(command), previousSibling });

      cached.inputs.set(command.inputs);

      this.executedCommandsCache.set(command.id, {
        ...cached,
        command,
      } as ExecutedCommandCacheItem);
    }
  }

  private runDeleteInstruction(command: RenderCommand) {
    const cached = this.executedCommandsCache.get(command.id);

    if (!cached) {
      if (command.kind === 'htmlClose') {
        return;
      }

      throw richTextRendererError('cached_command_not_found', { command });
    }

    if (command.kind === 'component') {
      if (!isExecutedComponentCommandCacheItem(cached)) {
        throw richTextRendererError('cached_command_not_component', { command });
      }

      cached.componentRef.destroy();
    } else if (command.kind === 'text' || command.kind === 'htmlOpen') {
      if (cached.element.parentElement) {
        this.renderer.removeChild(cached.element.parentElement, cached.element);
      }
    }

    this.executedCommandsCache.delete(command.id);
  }

  private getComponentRootNode(componentRef: ComponentRef<unknown>): HTMLElement {
    return (componentRef.hostView as EmbeddedViewRef<unknown>).rootNodes[0] as HTMLElement;
  }

  private findParent(command: RenderCommand) {
    if (command.parentId === null) {
      return this.elementRef.nativeElement;
    }

    const parentElement = this.executedCommandsCache.get(command.parentId)?.element;

    if (!parentElement) {
      throw richTextRendererError('text_parent_not_found', { command });
    }

    return parentElement;
  }

  private renderInsertAfter(
    node: HTMLElement,
    { parentElement, previousSibling }: { parentElement: HTMLElement; previousSibling: HTMLElement | null },
  ) {
    this.renderer.insertBefore(
      parentElement,
      node,
      previousSibling ? previousSibling.nextSibling : parentElement.firstChild,
    );
  }
}
